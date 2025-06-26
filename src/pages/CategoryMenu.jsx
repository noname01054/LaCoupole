import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import MenuItemCard from '../components/MenuItemCard';
import { toast } from 'react-toastify';
import { ChevronLeft, Coffee, Search, Filter } from 'lucide-react';
import debounce from 'lodash/debounce';
import './css/CategoryMenu.css';

function CategoryMenu({ addToCart }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryImage, setCategoryImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = debounce((query) => {
    if (query.trim() === '') {
      setFilteredItems(menuItems);
      return;
    }
    
    const filtered = menuItems.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredItems(filtered);
  }, 300);

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchData = async () => {
      try {
        setLoading(true);
        const [menuResponse, categoryResponse, breakfastResponse] = await Promise.all([
          api.get(`/menu-items?category_id=${id}`),
          api.get(`/categories/${id}`),
          api.getBreakfasts(),
        ]);
        
        const menuData = menuResponse.data || [];
        const categoryData = categoryResponse.data;
        const breakfastData = breakfastResponse.data || [];

        const categoryBreakfasts = breakfastData
          .filter(breakfast => breakfast.category_id === parseInt(id))
          .map(breakfast => ({
            ...breakfast,
            type: 'breakfast',
            category_name: categoryData?.name || 'Breakfast',
          }));

        const combinedItems = [
          ...menuData,
          ...categoryBreakfasts,
        ];

        setMenuItems(combinedItems);
        setFilteredItems(combinedItems);
        setCategoryName(categoryData?.name || 'Category');
        setCategoryImage(categoryData?.image_url || null);
        
        setTimeout(() => setIsVisible(true), 100);
      } catch (error) {
        console.error('Error fetching category data:', error);
        toast.error(error.response?.data?.error || 'Failed to load menu or category');
        setError('Failed to load category or menu items.');
        setMenuItems([]);
        setFilteredItems([]);
        setCategoryName('Category');
        setTimeout(() => setIsVisible(true), 100);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchData();
    } else {
      setError('Invalid category ID.');
      setLoading(false);
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [id]);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, menuItems]);

  const handleBack = () => {
    setIsVisible(false);
    setTimeout(() => {
      navigate(-1);
    }, 300);
  };

  const handleView = (itemId, itemType = 'menuItem') => {
    if (itemType === 'breakfast') {
      navigate(`/breakfast/${itemId}`);
    } else {
      navigate(`/product/${itemId}`);
    }
  };

  const handleSearchFocus = () => {};

  if (error) {
    return (
      <div className="category-menu-error-container">
        <div className="category-menu-error-content">
          <Coffee size={64} color="#ff6b35" className="category-menu-error-icon" />
          <p className="category-menu-error-text">{error}</p>
          <button className="category-menu-retry-button" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="category-menu-loading-container">
        <div className="category-menu-loading-spinner"></div>
        <p className="category-menu-loading-text">Loading delicious menu...</p>
      </div>
    );
  }

  return (
    <div className={`category-menu-container ${isVisible ? 'category-menu-container--visible' : ''}`}>
      <div className="category-menu-header">
        <div className="category-menu-header-background">
          {categoryImage ? (
            <div 
              className="category-menu-header-image"
              style={{
                backgroundImage: `url(${import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000'}${categoryImage})`
              }}
            />
          ) : (
            <div className="category-menu-header-gradient" />
          )}
          <div className="category-menu-header-overlay" />
        </div>

        <div className="category-menu-header-content">
          <div className="category-menu-nav-bar">
            <button
              className="category-menu-back-button"
              onClick={handleBack}
            >
              <ChevronLeft size={24} color="white" />
            </button>
            <div className="category-menu-header-title">
              <h1 className="category-menu-category-title">{categoryName}</h1>
              <p className="category-menu-category-subtitle">
                {filteredItems.length} delicious item{filteredItems.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>

          <div className="category-menu-search-section">
            <div className="category-menu-search-container">
              <div className="category-menu-search-wrapper">
                <Search size={20} color="#8e8e93" className="category-menu-search-icon" />
                <input
                  type="text"
                  placeholder="Search in this category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  className="category-menu-search-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="category-menu-content">
        {searchQuery && (
          <div className="category-menu-search-results">
            <p className="category-menu-search-results-text">
              {filteredItems.length > 0 
                ? `Found ${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''} for "${searchQuery}"`
                : `No items found for "${searchQuery}"`
              }
            </p>
          </div>
        )}

        {filteredItems.length === 0 && !loading ? (
          <div className="category-menu-empty-state">
            <div className="category-menu-empty-state-icon">
              <Coffee size={64} color="#8e8e93" />
            </div>
            <h3 className="category-menu-empty-state-title">
              {searchQuery ? 'No items found' : 'No menu items available'}
            </h3>
            <p className="category-menu-empty-state-text">
              {searchQuery 
                ? 'Try adjusting your search terms or browse all items.'
                : 'This category is currently empty. Check back soon for new items!'
              }
            </p>
            {searchQuery && (
              <button 
                className="category-menu-clear-search-button"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="category-menu-grid">
            {filteredItems.map((item, index) => (
              <EnhancedMenuItemCard
                key={`${item.type || 'menuItem'}-${item.id}`}
                item={item}
                index={index}
                isVisible={isVisible}
                onAddToCart={addToCart}
                onView={handleView}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const EnhancedMenuItemCard = ({ item, index, isVisible, onAddToCart, onView }) => {
  const [cardVisible, setCardVisible] = useState(false);
  
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setCardVisible(true);
      }, index * 80);
      return () => clearTimeout(timer);
    }
  }, [isVisible, index]);

  return (
    <div
      className={`category-menu-item-wrapper ${cardVisible ? 'category-menu-item-wrapper--visible' : ''}`}
      style={{ transitionDelay: `${index * 0.08}s` }}
    >
      <MenuItemCard
        item={item}
        onAddToCart={onAddToCart}
        onView={() => onView(item.id, item.type || 'menuItem')}
      />
    </div>
  );
};

export default CategoryMenu;