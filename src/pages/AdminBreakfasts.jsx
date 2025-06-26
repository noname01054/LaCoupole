import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import {
  AddCircleOutline,
  DeleteOutline,
  Edit,
  Save,
  Cancel,
  ArrowBack,
  Restaurant,
  Coffee,
  Category as CategoryIcon
} from '@mui/icons-material';
import './css/AdminBreakfasts.css';

function AdminBreakfasts() {
  const [breakfasts, setBreakfasts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingBreakfast, setEditingBreakfast] = useState(null);
  const [newOption, setNewOption] = useState({ group_id: '', option_type: '', option_name: '', additional_price: '' });
  const [newOptionGroup, setNewOptionGroup] = useState({ title: '' });
  const [editingOptionGroup, setEditingOptionGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';

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
        setUserId(authRes.data.id);
        const [breakfastRes, categoriesRes] = await Promise.all([
          api.getBreakfasts(),
          api.get('/categories')
        ]);
        const breakfastsWithDetails = await Promise.all(
          breakfastRes.data.map(async (breakfast) => {
            const [optionsRes, groupsRes] = await Promise.all([
              api.getBreakfastOptions(breakfast.id),
              api.getBreakfastOptionGroups(breakfast.id)
            ]);
            return {
              ...breakfast,
              options: (optionsRes.data || []).map(opt => ({
                ...opt,
                additional_price: parseFloat(opt.additional_price) || 0
              })),
              optionGroups: groupsRes.data || []
            };
          })
        );
        setBreakfasts(breakfastsWithDetails || []);
        setCategories(categoriesRes.data || []);
      } catch (error) {
        toast.error('Failed to load data');
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };
    initializeData();
  }, [navigate]);

  const handleEdit = (breakfast) => {
    setEditingBreakfast({
      id: breakfast.id,
      name: breakfast.name || '',
      description: breakfast.description || '',
      price: parseFloat(breakfast.price) || '',
      availability: !!breakfast.availability,
      image: null,
      image_url: breakfast.image_url,
      category_id: breakfast.category_id || '',
      options: breakfast.options.map(opt => ({
        ...opt,
        additional_price: parseFloat(opt.additional_price) || 0
      })),
      optionGroups: breakfast.optionGroups || []
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setEditingBreakfast(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'file' ? files[0] : 
              type === 'number' ? (value === '' ? '' : parseFloat(value)) : 
              name === 'category_id' ? (value === '' ? '' : parseInt(value)) : 
              value
    }));
  };

  const handleOptionChange = (e) => {
    const { name, value } = e.target;
    setNewOption(prev => ({
      ...prev,
      [name]: name === 'additional_price' ? (value === '' ? '' : parseFloat(value)) : 
              name === 'group_id' ? (value === '' ? '' : parseInt(value)) : value
    }));
  };

  const handleOptionGroupChange = (e) => {
    const { value } = e.target;
    setNewOptionGroup({ title: value });
  };

  const handleEditOptionGroupChange = (e) => {
    const { value } = e.target;
    setEditingOptionGroup(prev => ({ ...prev, title: value }));
  };

  const handleAddOptionGroup = async () => {
    if (!newOptionGroup.title.trim()) {
      toast.error('Option group title is required');
      return;
    }
    try {
      setIsSubmitting(true);
      await api.addBreakfastOptionGroup(editingBreakfast.id, {
        user_id: userId,
        title: newOptionGroup.title
      });
      toast.success('Option group added');
      setNewOptionGroup({ title: '' });
      const groupsRes = await api.getBreakfastOptionGroups(editingBreakfast.id);
      setEditingBreakfast(prev => ({
        ...prev,
        optionGroups: groupsRes.data || []
      }));
      const breakfastRes = await api.getBreakfasts();
      const breakfastsWithDetails = await Promise.all(
        breakfastRes.data.map(async (breakfast) => {
          const [optionsRes, groupsRes] = await Promise.all([
            api.getBreakfastOptions(breakfast.id),
            api.getBreakfastOptionGroups(breakfast.id)
          ]);
          return {
            ...breakfast,
            options: (optionsRes.data || []).map(opt => ({
              ...opt,
              additional_price: parseFloat(opt.additional_price) || 0
            })),
            optionGroups: groupsRes.data || []
          };
        })
      );
      setBreakfasts(breakfastsWithDetails || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add option group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOptionGroup = (group) => {
    setEditingOptionGroup(group);
  };

  const handleUpdateOptionGroup = async (groupId) => {
    if (!editingOptionGroup.title.trim()) {
      toast.error('Option group title is required');
      return;
    }
    try {
      setIsSubmitting(true);
      await api.updateBreakfastOptionGroup(editingBreakfast.id, groupId, {
        user_id: userId,
        title: editingOptionGroup.title
      });
      toast.success('Option group updated');
      setEditingOptionGroup(null);
      const groupsRes = await api.getBreakfastOptionGroups(editingBreakfast.id);
      setEditingBreakfast(prev => ({
        ...prev,
        optionGroups: groupsRes.data || []
      }));
      const breakfastRes = await api.getBreakfasts();
      const breakfastsWithDetails = await Promise.all(
        breakfastRes.data.map(async (breakfast) => {
          const [optionsRes, groupsRes] = await Promise.all([
            api.getBreakfastOptions(breakfast.id),
            api.getBreakfastOptionGroups(breakfast.id)
          ]);
          return {
            ...breakfast,
            options: (optionsRes.data || []).map(opt => ({
              ...opt,
              additional_price: parseFloat(opt.additional_price) || 0
            })),
            optionGroups: groupsRes.data || []
          };
        })
      );
      setBreakfasts(breakfastsWithDetails || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update option group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveOptionGroup = async (groupId) => {
    if (!window.confirm('Remove this option group? This will also remove associated options.')) return;
    try {
      setIsSubmitting(true);
      await api.deleteBreakfastOptionGroup(editingBreakfast.id, groupId, { user_id: userId });
      toast.success('Option group removed');
      const [groupsRes, optionsRes] = await Promise.all([
        api.getBreakfastOptionGroups(editingBreakfast.id),
        api.getBreakfastOptions(editingBreakfast.id)
      ]);
      setEditingBreakfast(prev => ({
        ...prev,
        optionGroups: groupsRes.data || [],
        options: (optionsRes.data || []).map(opt => ({
          ...opt,
          additional_price: parseFloat(opt.additional_price) || 0
        }))
      }));
      const breakfastRes = await api.getBreakfasts();
      const breakfastsWithDetails = await Promise.all(
        breakfastRes.data.map(async (breakfast) => {
          const [optionsRes, groupsRes] = await Promise.all([
            api.getBreakfastOptions(breakfast.id),
            api.getBreakfastOptionGroups(breakfast.id)
          ]);
          return {
            ...breakfast,
            options: (optionsRes.data || []).map(opt => ({
              ...opt,
              additional_price: parseFloat(opt.additional_price) || 0
            })),
            optionGroups: groupsRes.data || []
          };
        })
      );
      setBreakfasts(breakfastsWithDetails || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove option group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddOption = async () => {
    if (!newOption.group_id || !newOption.option_type || !newOption.option_name || newOption.additional_price === '') {
      toast.error('All option fields, including option group, are required');
      return;
    }
    if (!editingBreakfast.optionGroups.length) {
      toast.error('Create at least one option group first');
      return;
    }
    try {
      setIsSubmitting(true);
      await api.addBreakfastOption(editingBreakfast.id, {
        user_id: userId,
        group_id: newOption.group_id,
        option_type: newOption.option_type,
        option_name: newOption.option_name,
        additional_price: newOption.additional_price
      });
      toast.success('Option added');
      setNewOption({ group_id: '', option_type: '', option_name: '', additional_price: '' });
      const optionsRes = await api.getBreakfastOptions(editingBreakfast.id);
      setEditingBreakfast(prev => ({
        ...prev,
        options: (optionsRes.data || []).map(opt => ({
          ...opt,
          additional_price: parseFloat(opt.additional_price) || 0
        }))
      }));
      const breakfastRes = await api.getBreakfasts();
      const breakfastsWithDetails = await Promise.all(
        breakfastRes.data.map(async (breakfast) => {
          const [optionsRes, groupsRes] = await Promise.all([
            api.getBreakfastOptions(breakfast.id),
            api.getBreakfastOptionGroups(breakfast.id)
          ]);
          return {
            ...breakfast,
            options: (optionsRes.data || []).map(opt => ({
              ...opt,
              additional_price: parseFloat(opt.additional_price) || 0
            })),
            optionGroups: groupsRes.data || []
          };
        })
      );
      setBreakfasts(breakfastsWithDetails || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add option');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveOption = async (optionId) => {
    if (!window.confirm('Remove this option?')) return;
    try {
      setIsSubmitting(true);
      await api.deleteBreakfastOption(editingBreakfast.id, optionId, { user_id: userId });
      toast.success('Option removed');
      const optionsRes = await api.getBreakfastOptions(editingBreakfast.id);
      setEditingBreakfast(prev => ({
        ...prev,
        options: (optionsRes.data || []).map(opt => ({
          ...opt,
          additional_price: parseFloat(opt.additional_price) || 0
        }))
      }));
      const breakfastRes = await api.getBreakfasts();
      const breakfastsWithDetails = await Promise.all(
        breakfastRes.data.map(async (breakfast) => {
          const [optionsRes, groupsRes] = await Promise.all([
            api.getBreakfastOptions(breakfast.id),
            api.getBreakfastOptionGroups(breakfast.id)
          ]);
          return {
            ...breakfast,
            options: (optionsRes.data || []).map(opt => ({
              ...opt,
              additional_price: parseFloat(opt.additional_price) || 0
            })),
            optionGroups: groupsRes.data || []
          };
        })
      );
      setBreakfasts(breakfastsWithDetails || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove option');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!editingBreakfast.name || !editingBreakfast.price) {
      toast.error('Name and price are required');
      return;
    }
    if (editingBreakfast.category_id && isNaN(parseInt(editingBreakfast.category_id))) {
      toast.error('Invalid category selected');
      return;
    }
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('name', editingBreakfast.name);
      formData.append('description', editingBreakfast.description || '');
      formData.append('price', editingBreakfast.price);
      formData.append('availability', editingBreakfast.availability);
      formData.append('category_id', editingBreakfast.category_id || '');
      if (editingBreakfast.image) formData.append('image', editingBreakfast.image);
      if (editingBreakfast.id) {
        await api.updateBreakfast(editingBreakfast.id, formData);
        toast.success('Breakfast updated');
      } else {
        await api.addBreakfast(formData);
        toast.success('Breakfast added');
      }
      setEditingBreakfast(null);
      const breakfastRes = await api.getBreakfasts();
      const breakfastsWithDetails = await Promise.all(
        breakfastRes.data.map(async (breakfast) => {
          const [optionsRes, groupsRes] = await Promise.all([
            api.getBreakfastOptions(breakfast.id),
            api.getBreakfastOptionGroups(breakfast.id)
          ]);
          return {
            ...breakfast,
            options: (optionsRes.data || []).map(opt => ({
              ...opt,
              additional_price: parseFloat(opt.additional_price) || 0
            })),
            optionGroups: groupsRes.data || []
          };
        })
      );
      setBreakfasts(breakfastsWithDetails || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save breakfast');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this breakfast?')) return;
    try {
      setIsSubmitting(true);
      await api.deleteBreakfast(id, { user_id: userId });
      toast.success('Breakfast deleted');
      const breakfastRes = await api.getBreakfasts();
      const breakfastsWithDetails = await Promise.all(
        breakfastRes.data.map(async (breakfast) => {
          const [optionsRes, groupsRes] = await Promise.all([
            api.getBreakfastOptions(breakfast.id),
            api.getBreakfastOptionGroups(breakfast.id)
          ]);
          return {
            ...breakfast,
            options: (optionsRes.data || []).map(opt => ({
              ...opt,
              additional_price: parseFloat(opt.additional_price) || 0
            })),
            optionGroups: groupsRes.data || []
          };
        })
      );
      setBreakfasts(breakfastsWithDetails || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete breakfast');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditingBreakfast(null);
    setNewOption({ group_id: '', option_type: '', option_name: '', additional_price: '' });
    setNewOptionGroup({ title: '' });
    setEditingOptionGroup(null);
  };

  if (isLoading) {
    return (
      <div className="admin-breakfasts__container">
        <div className="admin-breakfasts__loading">
          <Restaurant className="admin-breakfasts__loading-icon" />
          Loading breakfasts...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-breakfasts__container">
      <div className="admin-breakfasts__header">
        <h1 className="admin-breakfasts__header-title">
          <Coffee />
          Manage Breakfasts
        </h1>
        <p className="admin-breakfasts__header-subtitle">
          Create, update, and manage breakfast items, option groups, and their options
        </p>
        <button 
          className="admin-breakfasts__back-button"
          onClick={() => navigate('/admin')}
        >
          <ArrowBack />
          Back to Dashboard
        </button>
      </div>

      <div className="admin-breakfasts__controls-section">
        <button
          className="admin-breakfasts__primary-button"
          onClick={() => setEditingBreakfast({
            id: null,
            name: '',
            description: '',
            price: '',
            availability: true,
            image: null,
            image_url: null,
            category_id: '',
            options: [],
            optionGroups: []
          })}
        >
          <AddCircleOutline />
          Add New Breakfast
        </button>
      </div>

      {breakfasts.length === 0 && !editingBreakfast ? (
        <div className="admin-breakfasts__empty-state">
          <Coffee className="admin-breakfasts__empty-state-icon" />
          <h3>No breakfasts found</h3>
          <p>Add a new breakfast to get started.</p>
        </div>
      ) : (
        <div className="admin-breakfasts__items-grid">
          {editingBreakfast && (
            <div className="admin-breakfasts__item-card-editing">
              <form onSubmit={handleUpdate}>
                <div className="admin-breakfasts__form-section">
                  <div className="admin-breakfasts__form-group">
                    <label className="admin-breakfasts__form-label">
                      Breakfast Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={editingBreakfast.name || ''}
                      onChange={handleInputChange}
                      placeholder="Enter breakfast name"
                      required
                      className="admin-breakfasts__form-input"
                    />
                  </div>
                  <div className="admin-breakfasts__form-group">
                    <label className="admin-breakfasts__form-label">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={editingBreakfast.description || ''}
                      onChange={handleInputChange}
                      placeholder="Enter description"
                      className="admin-breakfasts__form-textarea"
                    />
                  </div>
                  <div className="admin-breakfasts__form-group">
                    <label className="admin-breakfasts__form-label">
                      Price *
                    </label>
                    <input
                      type="number"
                      name="price"
                      step="0.01"
                      min="0.01"
                      value={editingBreakfast.price || ''}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      required
                      className="admin-breakfasts__form-input"
                    />
                  </div>
                  <div className="admin-breakfasts__form-group">
                    <label className="admin-breakfasts__form-label">
                      <CategoryIcon fontSize="small" />
                      Category
                    </label>
                    <select
                      name="category_id"
                      value={editingBreakfast.category_id || ''}
                      onChange={handleInputChange}
                      className="admin-breakfasts__form-select"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-breakfasts__form-group">
                    <label className="admin-breakfasts__form-label">Image Upload</label>
                    <input
                      type="file"
                      name="image"
                      accept="image/jpeg,image/png"
                      onChange={handleInputChange}
                      className="admin-breakfasts__form-input"
                    />
                    {editingBreakfast.image_url && (
                      <img
                        src={`${API_BASE_URL}${editingBreakfast.image_url}`}
                        alt={editingBreakfast.name}
                        className="admin-breakfasts__item-image"
                      />
                    )}
                    <div className="admin-breakfasts__no-image" style={{ display: editingBreakfast.image_url ? 'none' : 'flex' }}>
                      No Image Available
                    </div>
                  </div>
                  <div className="admin-breakfasts__form-group">
                    <div className="admin-breakfasts__checkbox-container">
                      <input
                        type="checkbox"
                        name="availability"
                        checked={editingBreakfast.availability}
                        onChange={handleInputChange}
                        className="admin-breakfasts__checkbox"
                      />
                      <label className="admin-breakfasts__form-label">Available</label>
                    </div>
                  </div>
                  {editingBreakfast.id && (
                    <>
                      <div className="admin-breakfasts__option-section">
                        <label className="admin-breakfasts__form-label">Option Groups</label>
                        <div className="admin-breakfasts__option-grid admin-breakfasts__option-grid--group">
                          <input
                            type="text"
                            value={newOptionGroup.title}
                            onChange={handleOptionGroupChange}
                            placeholder="Option Group Title (e.g., Beverage)"
                            className="admin-breakfasts__form-input"
                          />
                          <button
                            type="button"
                            onClick={handleAddOptionGroup}
                            className="admin-breakfasts__primary-button"
                            disabled={isSubmitting}
                          >
                            <AddCircleOutline fontSize="small" />
                            Add Group
                          </button>
                        </div>
                        {editingBreakfast.optionGroups.map(group => (
                          <div key={group.id} className="admin-breakfasts__option-item">
                            {editingOptionGroup?.id === group.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editingOptionGroup.title}
                                  onChange={handleEditOptionGroupChange}
                                  className="admin-breakfasts__form-input"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOptionGroup(group.id)}
                                  className="admin-breakfasts__primary-button"
                                  disabled={isSubmitting}
                                >
                                  <Save fontSize="small" />
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingOptionGroup(null)}
                                  className="admin-breakfasts__secondary-button"
                                  disabled={isSubmitting}
                                >
                                  <Cancel fontSize="small" />
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <span>{group.title}</span>
                                <button
                                  type="button"
                                  onClick={() => handleEditOptionGroup(group)}
                                  className="admin-breakfasts__secondary-button"
                                  disabled={isSubmitting}
                                >
                                  <Edit fontSize="small" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOptionGroup(group.id)}
                                  className="admin-breakfasts__danger-button"
                                  disabled={isSubmitting}
                                >
                                  <DeleteOutline fontSize="small" />
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="admin-breakfasts__option-section">
                        <label className="admin-breakfasts__form-label">Options</label>
                        <div className="admin-breakfasts__option-grid">
                          <select
                            name="group_id"
                            value={newOption.group_id || ''}
                            onChange={handleOptionChange}
                            className="admin-breakfasts__form-select"
                          >
                            <option value="">Select Option Group</option>
                            {editingBreakfast.optionGroups.map(group => (
                              <option key={group.id} value={group.id}>{group.title}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            name="option_type"
                            value={newOption.option_type}
                            onChange={handleOptionChange}
                            placeholder="Option Type (e.g., Coffee)"
                            className="admin-breakfasts__form-input"
                          />
                          <input
                            type="text"
                            name="option_name"
                            value={newOption.option_name}
                            onChange={handleOptionChange}
                            placeholder="Option Name (e.g., Espresso)"
                            className="admin-breakfasts__form-input"
                          />
                          <input
                            type="number"
                            name="additional_price"
                            step="0.01"
                            min="0"
                            value={newOption.additional_price}
                            onChange={handleOptionChange}
                            placeholder="Additional Price"
                            className="admin-breakfasts__form-input"
                          />
                          <button
                            type="button"
                            onClick={handleAddOption}
                            className="admin-breakfasts__primary-button"
                            disabled={isSubmitting}
                          >
                            <AddCircleOutline fontSize="small" />
                            Add Option
                          </button>
                        </div>
                        {editingBreakfast.options.map(opt => (
                          <div key={opt.id} className="admin-breakfasts__option-item">
                            <span>{opt.group_title}: {opt.option_type}: {opt.option_name}</span>
                            <span>${(parseFloat(opt.additional_price) || 0).toFixed(2)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(opt.id)}
                              className="admin-breakfasts__danger-button"
                              disabled={isSubmitting}
                            >
                              <DeleteOutline fontSize="small" />
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="admin-breakfasts__button-group">
                  <button
                    type="submit"
                    className="admin-breakfasts__primary-button"
                    disabled={isSubmitting}
                  >
                    <Save fontSize="small" />
                    {isSubmitting ? 'Saving...' : editingBreakfast.id ? 'Update Breakfast' : 'Add Breakfast'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="admin-breakfasts__secondary-button"
                    disabled={isSubmitting}
                  >
                    <Cancel fontSize="small" />
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {breakfasts.map(breakfast => (
            <div key={breakfast.id} className="admin-breakfasts__item-card">
              {breakfast.image_url ? (
                <img
                  src={`${API_BASE_URL}${breakfast.image_url}`}
                  alt={breakfast.name}
                  className="admin-breakfasts__item-image"
                />
              ) : (
                <div className="admin-breakfasts__no-image">No Image Available</div>
              )}
              <h3 className="admin-breakfasts__item-title">{breakfast.name}</h3>
              <div className="admin-breakfasts__price-container">
                <span className="admin-breakfasts__sale-price">${(parseFloat(breakfast.price) || 0).toFixed(2)}</span>
              </div>
              <div className="admin-breakfasts__item-meta">
                <span
                  className={`admin-breakfasts__badge ${
                    breakfast.availability ? 'admin-breakfasts__available-badge' : 'admin-breakfasts__unavailable-badge'
                  }`}
                >
                  {breakfast.availability ? 'Available' : 'Unavailable'}
                </span>
                {breakfast.category_id && categories.find(cat => cat.id === breakfast.category_id) && (
                  <span className="admin-breakfasts__badge admin-breakfasts__category-badge">
                    {categories.find(cat => cat.id === breakfast.category_id).name}
                  </span>
                )}
              </div>
              {breakfast.description && (
                <p className="admin-breakfasts__item-description">{breakfast.description}</p>
              )}
              {breakfast.optionGroups.length > 0 && (
                <div className="admin-breakfasts__options-list">
                  <strong>Option Groups:</strong>
                  {breakfast.optionGroups.map(group => (
                    <div key={group.id} className="admin-breakfasts__option-item-display">
                      {group.title}
                    </div>
                  ))}
                </div>
              )}
              {breakfast.options.length > 0 && (
                <div className="admin-breakfasts__options-list">
                  <strong>Options:</strong>
                  {breakfast.options.map(opt => (
                    <div key={opt.id} className="admin-breakfasts__option-item-display">
                      {opt.group_title}: {opt.option_type}: {opt.option_name} (+${(parseFloat(opt.additional_price) || 0).toFixed(2)})
                    </div>
                  ))}
                </div>
              )}
              <div className="admin-breakfasts__button-group">
                <button
                  className="admin-breakfasts__primary-button"
                  onClick={() => handleEdit(breakfast)}
                >
                  <Edit fontSize="small" />
                  Edit
                </button>
                <button
                  className="admin-breakfasts__danger-button"
                  onClick={() => handleDelete(breakfast.id)}
                  disabled={isSubmitting}
                >
                  <DeleteOutline fontSize="small" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminBreakfasts;