import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { ChevronLeft, Coffee, Search } from 'lucide-react';
import debounce from 'lodash/debounce';
import MenuItemCard from '../components/MenuItemCard';
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
  const [categories, setCategories] = useState([]);
  const containerRef = useRef(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchCurrentX, setTouchCurrentX] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);

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
        const [menuResponse, categoryResponse, breakfastResponse, categoriesResponse] = await Promise.all([
          api.get(`/menu-items?category_id=${id}`),
          api.get(`/categories/${id}`),
          api.getBreakfasts(),
          api.get('/categories'),
        ]);
        
        const menuData = menuResponse.data || [];
        const categoryData = categoryResponse.data;
        const breakfastData = breakfastResponse.data || [];
        const categoriesData = categoriesResponse.data || [];

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
        setCategories(categoriesData);
        
        setTimeout(() => setIsVisible(true), 100);
      } catch (error) {
        console.error('Error fetching category data:', error);
        toast.error(error.response?.data?.error || 'Failed to load menu or category');
        setError('Failed to load category or menu items.');
        setMenuItems([]);
        setFilteredItems([]);
        setCategoryName('Category');
        setCategories([]);
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

  const handleBack = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      navigate(-1);
    }, 300);
  }, [navigate]);

  const handleView = useCallback((itemId, itemType = 'menuItem') => {
    if (itemType === 'breakfast') {
      navigate(`/breakfast/${itemId}`);
    } else {
      navigate(`/product/${itemId}`);
    }
  }, [navigate]);

  const handleSearchFocus = useCallback(() => {}, []);

  const handleTouchStart = useCallback((e) => {
    if (window.innerWidth > 768) return;
    setTouchStartX(e.touches[0].clientX);
    setTouchCurrentX(e.touches[0].clientX);
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (!isSwiping || window.innerWidth > 768) return;
      setTouchCurrentX(e.touches[0].clientX);
      const deltaX = touchCurrentX - touchStartX;
      const boundedDeltaX = Math.max(Math.min(deltaX, 150), -150); // Limit swipe distance
      if (containerRef.current) {
        containerRef.current.style.transform = `translateX(${boundedDeltaX}px)`;
        containerRef.current.style.transition = 'none';
      }
    },
    [isSwiping, touchStartX, touchCurrentX]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping || window.innerWidth > 768) return;
    setIsSwiping(false);
    const deltaX = touchCurrentX - touchStartX;
    const swipeThreshold = 80;

    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      containerRef.current.style.transform = 'translateX(0)';
    }

    if (categories.length > 0) {
      const currentId = parseInt(id);
      const categoryIds = categories.map(cat => parseInt(cat.id)).sort((a, b) => a - b);
      const currentIndex = categoryIds.indexOf(currentId);

      if (deltaX > swipeThreshold) {
        // Left-to-right swipe: previous category or CategoryList if first
        if (currentIndex === 0) {
          navigate('/categories');
        } else {
          navigate(`/category/${categoryIds[currentIndex - 1]}`);
        }
      } else if (deltaX < -swipeThreshold) {
        // Right-to-left swipe: next category
        if (currentIndex < categoryIds.length - 1) {
          navigate(`/category/${categoryIds[currentIndex + 1]}`);
        }
      }
    }

    setTouchStartX(null);
    setTouchCurrentX(null);
  }, [isSwiping, touchCurrentX, touchStartX, navigate, categories, id]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      containerRef.current.style.transform = 'translateX(0)';
    }
    setIsSwiping(false);
    setTouchStartX(null);
    setTouchCurrentX(null);
  }, []);

  if (error) {
    return (
      <div
        className="category-menu-error-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
      <div
        className="category-menu-loading-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="category-menu-loading-spinner"></div>
        <p className="category-menu-loading-text">Chargement du délicieux menu...</p>
      </div>
    );
  }

  return (
    <div
      className={`category-menu-container ${isVisible ? 'category-menu-container--visible' : ''}`}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
                {filteredItems.length} Article Délicieux Disponible!
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
          <div className="category-menu-grid" style={{ position: 'static' }}>
            {filteredItems.map((item, index) => (
              <MenuItemCard
                key={`${item.type || 'menuItem'}-${item.id}`}
                item={item}
                onAddToCart={addToCart}
                onView={() => handleView(item.id, item.type || 'menuItem')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CategoryMenu;
