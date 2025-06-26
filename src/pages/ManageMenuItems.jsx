import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  AddCircleOutline,
  DeleteOutline,
  Edit,
  Close,
  Save,
  Cancel,
  ArrowBack,
  Search,
  FilterList,
  Add,
  Restaurant,
  AttachMoney,
  Category,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { createFormData } from '../utils/formDataHelper';
import './css/ManageMenuItems.css';

const safeParseDietaryTags = (tags) => {
  if (!tags || typeof tags !== 'string') return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error parsing dietary_tags:', error, { tags });
    return [];
  }
};

function ManageMenuItems() {
  const [menuItems, setMenuItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newSupplementId, setNewSupplementId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const navigate = useNavigate();

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        const authRes = await api.get('/check-auth');
        if (!authRes.data?.id || authRes.data.role !== 'admin') {
          toast.error('Admin access required');
          navigate('/login');
          return;
        }
        setUser(authRes.data);

        const [menuRes, catRes, supRes] = await Promise.all([
          api.get('/menu-items'),
          api.get('/categories'),
          api.get('/supplements'),
        ]);
        setMenuItems(menuRes.data || []);
        setFilteredItems(menuRes.data || []);
        setCategories(catRes.data || []);
        setSupplements(supRes.data || []);
      } catch (error) {
        console.error('Initialization error:', error);
        toast.error(error.response?.data?.error || 'Failed to load data');
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };
    initializeData();
  }, [navigate]);

  useEffect(() => {
    let filtered = menuItems;
    
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category_id === parseInt(selectedCategory));
    }
    
    setFilteredItems(filtered);
  }, [menuItems, searchTerm, selectedCategory]);

  const handleEdit = async (item) => {
    try {
      const supRes = await api.get(`/menu-items/${item.id}/supplements`);
      const regularPriceValue = parseFloat(item.regular_price);
      const salePriceValue = item.sale_price !== null ? parseFloat(item.sale_price) : '';
      setEditingItem({
        id: parseInt(item.id) || 0,
        name: item.name || '',
        description: item.description || '',
        regular_price: isNaN(regularPriceValue) ? '' : regularPriceValue,
        sale_price: isNaN(salePriceValue) ? '' : salePriceValue,
        category_id: parseInt(item.category_id) || '',
        availability: !!item.availability,
        dietary_tags: safeParseDietaryTags(item.dietary_tags).join(', ') || '',
        image: null,
        image_url: item.image_url,
        assignedSupplements: supRes.data.map(sup => ({
          supplement_id: parseInt(sup.supplement_id) || 0,
          name: sup.name || '',
          additional_price: parseFloat(sup.additional_price) || 0,
        })),
      });
      setNewSupplementId('');
    } catch (error) {
      console.error('Error fetching supplements:', error);
      toast.error('Failed to load supplement data');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    let newValue;
    if (type === 'checkbox') {
      newValue = checked;
    } else if (type === 'file') {
      newValue = files[0];
    } else if (type === 'number' && (name === 'regular_price' || name === 'sale_price')) {
      newValue = value === '' ? '' : parseFloat(value) || 0;
    } else {
      newValue = value;
    }
    setEditingItem(prev => (prev ? { ...prev, [name]: newValue } : null));
  };

  const handleSupplementChange = (supplementId, field, value) => {
    setEditingItem(prev => {
      if (!prev) return null;
      return {
        ...prev,
        assignedSupplements: prev.assignedSupplements.map(sup =>
          sup.supplement_id === supplementId
            ? { ...sup, [field]: field === 'additional_price' ? parseFloat(value) || 0 : value }
            : sup
        ),
      };
    });
  };

  const handleAddSupplement = () => {
    if (!newSupplementId) {
      toast.error('Please select a supplement');
      return;
    }
    const supplement = supplements.find(s => s.id === parseInt(newSupplementId));
    if (!supplement) {
      toast.error('Invalid supplement selected');
      return;
    }
    if (editingItem?.assignedSupplements.some(s => s.supplement_id === supplement.id)) {
      toast.warn('Supplement already assigned');
      return;
    }
    setEditingItem(prev => {
      if (!prev) return null;
      return {
        ...prev,
        assignedSupplements: [
          ...prev.assignedSupplements,
          {
            supplement_id: supplement.id,
            name: supplement.name,
            additional_price: parseFloat(supplement.price) || 0,
          },
        ],
      };
    });
    setNewSupplementId('');
  };

  const handleRemoveSupplement = async (supplementId) => {
    if (!user) {
      toast.error('You must be logged in to remove supplements');
      return;
    }
    if (!window.confirm('Remove this supplement from the menu item?')) return;
    try {
      setIsSubmitting(true);
      await api.deleteSupplementFromMenuItem(editingItem.id, supplementId, { user_id: user.id });
      setEditingItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          assignedSupplements: prev.assignedSupplements.filter(
            sup => sup.supplement_id !== supplementId
          ),
        };
      });
      toast.success('Supplement removed');
    } catch (error) {
      console.error('Error removing supplement:', error);
      toast.error(error.response?.data?.error || 'Failed to remove supplement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (isSubmitting) {
      toast.error('Update in progress, please wait');
      return;
    }
    if (!user || !user.id) {
      toast.error('User not authenticated');
      return;
    }
    if (!editingItem) {
      toast.error('No item selected for editing');
      return;
    }

    try {
      setIsSubmitting(true);

      const itemId = parseInt(editingItem.id);
      const userId = parseInt(user.id);
      const name = editingItem.name?.trim();
      const regularPrice = parseFloat(editingItem.regular_price);
      const salePrice = editingItem.sale_price !== '' ? parseFloat(editingItem.sale_price) : null;
      const categoryId = parseInt(editingItem.category_id);
      const dietaryTags = editingItem.dietary_tags?.trim();
      const description = editingItem.description?.trim();
      const availability = editingItem.availability;

      if (!itemId || isNaN(itemId) || itemId <= 0) {
        throw new Error('Invalid menu item ID');
      }
      if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID');
      }
      if (!name) {
        throw new Error('Name is required');
      }
      if (isNaN(regularPrice) || regularPrice <= 0) {
        throw new Error('Regular price must be a positive number');
      }
      if (salePrice !== null && (isNaN(salePrice) || salePrice < 0)) {
        throw new Error('Sale price must be a non-negative number');
      }
      if (!categoryId || isNaN(categoryId) || categoryId <= 0) {
        throw new Error('Category is required');
      }
      if (dietaryTags && !/^[a-zA-Z0-9\s,-]*$/.test(dietaryTags)) {
        throw new Error('Dietary tags must be a comma-separated list');
      }
      if (editingItem.image) {
        if (!['image/jpeg', 'image/png'].includes(editingItem.image.type)) {
          throw new Error('Image must be JPEG or PNG');
        }
        if (editingItem.image.size > 5 * 1024 * 1024) {
          throw new Error('Image size must be less than 5MB');
        }
      }

      const payload = {
        user_id: userId,
        name,
        regular_price: regularPrice,
        sale_price: salePrice,
        category_id: categoryId,
        availability,
        description: description || '',
        dietary_tags: dietaryTags ? dietaryTags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        image: editingItem.image,
      };

      console.log('Update payload:', payload);

      const formData = createFormData(payload);

      console.log('FormData entries before sending:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value instanceof File ? value.name : value}`);
      }

      await api.updateMenuItem(itemId, formData);

      const existingSups = (await api.getSupplementsByMenuItem(itemId)).data;
      for (const sup of editingItem.assignedSupplements) {
        const additionalPrice = parseFloat(sup.additional_price);
        if (isNaN(additionalPrice) || additionalPrice < 0) {
          throw new Error(`Invalid additional price for supplement ${sup.name}`);
        }
        if (!sup.supplement_id || !sup.name) {
          throw new Error(`Invalid supplement data for ${sup.name || 'unknown'}`);
        }
        const supPayload = {
          user_id: userId,
          name: sup.name.trim(),
          additional_price: additionalPrice,
          supplement_id: parseInt(sup.supplement_id),
        };
        const isAssigned = existingSups.some(s => s.supplement_id === sup.supplement_id);
        if (!isAssigned) {
          await api.addSupplementToMenuItem(itemId, supPayload);
        } else {
          await api.updateSupplementForMenuItem(itemId, sup.supplement_id, supPayload);
        }
      }

      toast.success('Menu item updated successfully');
      setEditingItem(null);
      setNewSupplementId('');
      const res = await api.get('/menu-items');
      setMenuItems(res.data || []);
    } catch (error) {
      console.error('Update error:', error);
      const serverErrors = error.response?.data?.errors;
      if (serverErrors?.length) {
        serverErrors.forEach(err => toast.error(`Validation error: ${err.msg} (${err.path})`));
      } else {
        toast.error(error.message || 'Failed to update menu item');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!user) {
      toast.error('You must be logged in to delete menu items');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      setIsSubmitting(true);
      await api.deleteMenuItem(id, { user_id: user.id });
      toast.success('Menu item deleted');
      const res = await api.get('/menu-items');
      setMenuItems(res.data || []);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.error || 'Failed to delete menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setNewSupplementId('');
  };

  if (isLoading) {
    return (
      <div className="manage-menu-items-container">
        <div className="manage-menu-items-loading">
          <Restaurant className="manage-menu-items-loading-icon" />
          Loading menu items...
        </div>
      </div>
    );
  }

  return (
    <div className="manage-menu-items-container">
      <div className="manage-menu-items-header">
        <h1 className="manage-menu-items-header-title">
          <Restaurant />
          Manage Menu Items
        </h1>
        <p className="manage-menu-items-header-subtitle">
          Edit, update, and manage your restaurant's menu items
        </p>
        <button 
          className="manage-menu-items-back-button"
          onClick={() => navigate('/admin')}
        >
          <ArrowBack />
          Back to Dashboard
        </button>
      </div>

      <div className="manage-menu-items-controls-section">
        <div className="manage-menu-items-controls-grid">
          <div className="manage-menu-items-search-container">
            <Search className="manage-menu-items-search-icon" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="manage-menu-items-search-input"
            />
          </div>
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="manage-menu-items-filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="manage-menu-items-empty-state">
          <Restaurant className="manage-menu-items-empty-state-icon" />
          <h3>No menu items found</h3>
          <p>Try adjusting your search criteria or add new menu items.</p>
        </div>
      ) : (
        <div className="manage-menu-items-grid">
          {filteredItems.map(item => (
            <div 
              key={item.id} 
              className={`manage-menu-items-card ${editingItem && editingItem.id === item.id ? 'manage-menu-items-card--editing' : ''}`}
            >
              {editingItem && editingItem.id === item.id ? (
                <form onSubmit={handleUpdate}>
                  <div className="manage-menu-items-form-section">
                    <div className="manage-menu-items-form-group">
                      <label className="manage-menu-items-form-label">Item Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={editingItem.name || ''}
                        onChange={handleInputChange}
                        placeholder="Enter item name"
                        required
                        className="manage-menu-items-form-input"
                      />
                    </div>

                    <div className="manage-menu-items-form-group">
                      <label className="manage-menu-items-form-label">Description</label>
                      <textarea
                        name="description"
                        value={editingItem.description || ''}
                        onChange={handleInputChange}
                        placeholder="Enter item description"
                        className="manage-menu-items-form-textarea"
                      />
                    </div>

                    <div className="manage-menu-items-form-group">
                      <label className="manage-menu-items-form-label">Regular Price *</label>
                      <input
                        type="number"
                        name="regular_price"
                        step="0.01"
                        min="0.01"
                        value={editingItem.regular_price || ''}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        required
                        className="manage-menu-items-form-input"
                      />
                    </div>

                    <div className="manage-menu-items-form-group">
                      <label className="manage-menu-items-form-label">Sale Price (Optional)</label>
                      <input
                        type="number"
                        name="sale_price"
                        step="0.01"
                        min="0"
                        value={editingItem.sale_price || ''}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        className="manage-menu-items-form-input"
                      />
                    </div>

                    <div className="manage-menu-items-form-group">
                      <label className="manage-menu-items-form-label">Category *</label>
                      <select
                        name="category_id"
                        value={editingItem.category_id || ''}
                        onChange={handleInputChange}
                        required
                        className="manage-menu-items-form-select"
                      >
                        <option value="">Select Category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="manage-menu-items-form-group">
                      <label className="manage-menu-items-form-label">Image Upload</label>
                      <input
                        type="file"
                        name="image"
                        accept="image/jpeg,image/png"
                        onChange={handleInputChange}
                        className="manage-menu-items-form-input"
                      />
                      {editingItem.image_url && (
                        <img
                          src={`${API_BASE_URL}${editingItem.image_url}`}
                          alt={editingItem.name}
                          className="manage-menu-items-item-image"
                        />
                      )}
                      <div className={`manage-menu-items-no-image ${editingItem.image_url ? 'manage-menu-items-no-image--hidden' : ''}`}>
                        No Image Available
                      </div>
                    </div>

                    <div className="manage-menu-items-form-group">
                      <div className="manage-menu-items-checkbox-container">
                        <input
                          type="checkbox"
                          name="availability"
                          checked={editingItem.availability}
                          onChange={handleInputChange}
                          className="manage-menu-items-checkbox"
                        />
                        <label className="manage-menu-items-form-label">Available</label>
                      </div>
                    </div>

                    <div className="manage-menu-items-form-group">
                      <label className="manage-menu-items-form-label">Dietary Tags</label>
                      <input
                        type="text"
                        name="dietary_tags"
                        value={editingItem.dietary_tags || ''}
                        onChange={handleInputChange}
                        placeholder="e.g., vegan, gluten-free"
                        className="manage-menu-items-form-input"
                      />
                    </div>

                    <div className="manage-menu-items-supplement-section">
                      <label className="manage-menu-items-form-label">Supplements</label>
                      <div className="manage-menu-items-supplement-grid">
                        <select
                          value={newSupplementId}
                          onChange={(e) => setNewSupplementId(e.target.value)}
                          className="manage-menu-items-form-select"
                        >
                          <option value="">Select Supplement</option>
                          {supplements
                            .filter(
                              s =>
                                !editingItem.assignedSupplements.some(
                                  as => as.supplement_id === s.id
                                )
                            )
                            .map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddSupplement}
                          className="manage-menu-items-primary-button"
                          disabled={isSubmitting}
                        >
                          <AddCircleOutline fontSize="small" />
                          Add Supplement
                        </button>
                      </div>
                      {editingItem.assignedSupplements.map(sup => (
                        <div key={sup.supplement_id} className="manage-menu-items-supplement-item">
                          <select
                            value={sup.supplement_id}
                            onChange={(e) =>
                              handleSupplementChange(
                                sup.supplement_id,
                                'supplement_id',
                                parseInt(e.target.value)
                              )
                            }
                            className="manage-menu-items-form-select"
                          >
                            {supplements
                              .filter(
                                s =>
                                  !editingItem.assignedSupplements.some(
                                    as =>
                                      as.supplement_id === s.id &&
                                      as.supplement_id !== sup.supplement_id
                                  )
                              )
                              .map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={sup.additional_price || ''}
                            onChange={(e) =>
                              handleSupplementChange(
                                sup.supplement_id,
                                'additional_price',
                                e.target.value
                              )
                            }
                            placeholder="Additional Price"
                            className="manage-menu-items-form-input"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveSupplement(sup.supplement_id)}
                            className="manage-menu-items-danger-button"
                            disabled={isSubmitting}
                          >
                            <Close fontSize="small" />
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="manage-menu-items-button-group">
                    <button
                      type="submit"
                      className="manage-menu-items-primary-button"
                      disabled={isSubmitting}
                    >
                      <Save fontSize="small" />
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="manage-menu-items-secondary-button"
                      disabled={isSubmitting}
                    >
                      <Cancel fontSize="small" />
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  {item.image_url ? (
                    <img
                      src={`${API_BASE_URL}${item.image_url}`}
                      alt={item.name}
                      className="manage-menu-items-item-image"
                    />
                  ) : null}
                  <div className={`manage-menu-items-no-image ${item.image_url ? 'manage-menu-items-no-image--hidden' : ''}`}>
                    No Image Available
                  </div>
                  <h3 className="manage-menu-items-item-title">{item.name}</h3>
                  <div className="manage-menu-items-price-container">
                    {item.sale_price !== null && (
                      <span className="manage-menu-items-regular-price">
                        ${isNaN(parseFloat(item.regular_price)) ? 'N/A' : parseFloat(item.regular_price).toFixed(2)}
                      </span>
                    )}
                    <span className="manage-menu-items-sale-price">
                      ${isNaN(parseFloat(item.sale_price ?? item.regular_price)) ? 'N/A' : parseFloat(item.sale_price ?? item.regular_price).toFixed(2)}
                    </span>
                  </div>
                  <div className="manage-menu-items-item-meta">
                    <span className="manage-menu-items-badge manage-menu-items-category-badge">
                      <Category fontSize="small" className="manage-menu-items-badge-icon" />
                      {item.category_name || 'N/A'}
                    </span>
                    <span className={`manage-menu-items-badge ${item.availability ? 'manage-menu-items-available-badge' : 'manage-menu-items-unavailable-badge'}`}>
                      {item.availability ? <Visibility fontSize="small" className="manage-menu-items-badge-icon" /> : <VisibilityOff fontSize="small" className="manage-menu-items-badge-icon" />}
                      {item.availability ? 'Available' : 'Unavailable'}
                    </span>
                    {safeParseDietaryTags(item.dietary_tags).map((tag, index) => (
                      <span key={index} className="manage-menu-items-badge manage-menu-items-dietary-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="manage-menu-items-item-description">{item.description || 'No description available'}</p>
                  <div className="manage-menu-items-button-group">
                    <button
                      className="manage-menu-items-primary-button"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit fontSize="small" />
                      Edit
                    </button>
                    <button
                      className="manage-menu-items-danger-button"
                      onClick={() => handleDelete(item.id)}
                      disabled={isSubmitting}
                    >
                      <DeleteOutline fontSize="small" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManageMenuItems;