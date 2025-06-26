import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { Search, ChevronDown, Coffee } from 'lucide-react';
import MenuItemCard from '../components/MenuItemCard';
import Banner from '../components/Banner';
import TopCategories from '../components/TopCategories';
import BestSellers from '../components/BestSellers';
import debounce from 'lodash/debounce';
import './css/Home.css';

function Home({ addToCart }) {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const navigate = useNavigate();
  const menuSectionRef = useRef(null);
  const bannerContainerRef = useRef(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query) => {
        if (query.trim() === '') {
          setFilteredItems(menuItems);
          return;
        }
        try {
          const response = await api.searchMenuItems(query);
          setFilteredItems(response.data || []);
        } catch (error) {
          console.error('Error searching menu items:', error);
          toast.error(error.response?.data?.error || 'Failed to search menu items');
          setFilteredItems([]);
        }
      }, 500),
    [menuItems]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [menuResponse, categoriesResponse, bannersResponse] = await Promise.all([
          api.get('/menu-items'),
          api.get('/categories'),
          api.getEnabledBanners(),
        ]);

        const menuData = menuResponse.data || [];
        const categoriesData = categoriesResponse.data || [];
        const bannersData = bannersResponse.data || [];

        setMenuItems(menuData);
        setCategories([
          { id: 'all', name: 'All Menu', image_url: null },
          ...categoriesData,
        ]);
        setFilteredItems(menuData);
        setBanners(bannersData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(error.response?.data?.error || 'Failed to load data');
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentBannerIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % banners.length;
        if (bannerContainerRef.current) {
          bannerContainerRef.current.scrollTo({
            left: nextIndex * bannerContainerRef.current.offsetWidth,
            behavior: 'smooth',
          });
        }
        return nextIndex;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [banners.length]);

  const handleViewProduct = useCallback((id) => {
    navigate(`/product/${id}`);
  }, [navigate]);

  const handleCategoryClick = useCallback((categoryId) => {
    if (categoryId === 'all') {
      navigate('/categories');
    } else {
      navigate(`/category/${categoryId}`);
    }
  }, [navigate]);

  const handleScrollToResults = useCallback(() => {
    menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const getBaseUrl = () => import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';

  if (error) {
    return (
      <div className="home-error-container">
        <div className="home-error-content">
          <p className="home-error-text">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="home-loading-container">
        <div className="home-loading-spinner"></div>
        <p className="home-loading-text">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <div className="home-welcome-section">
          <div className="home-welcome-content">
            <h1 className="home-welcome-title">Welcome Back!</h1>
            <p className="home-welcome-subtitle">What would you like to eat today?</p>
          </div>
          <div className="home-welcome-emoji">🍽️</div>
        </div>

        <div className="home-search-container">
          <div className="home-search-wrapper">
            <Search size={18} color="#8e8e93" className="home-search-icon" />
            <input
              type="text"
              placeholder="Search something"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="home-search-input"
            />
          </div>
          <button
            className="home-filter-button"
            onClick={handleScrollToResults}
          >
            <ChevronDown size={18} color="#8e8e93" />
          </button>
        </div>

        <div className="home-categories-section">
          <div className="home-categories-header">
            <h2 className="home-categories-title kleur">Categories</h2>
            <button
              className="home-see-all-button"
              onClick={() => navigate('/categories')}
            >
              See all
            </button>
          </div>

          <div className="home-categories-scroll-container">
            <div className="home-categories-grid">
              {categories.slice(0, 6).map((category, index) => (
                <div
                  key={category.id}
                  className="home-category-item"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  <div className="home-category-image-container">
                    {category.image_url ? (
                      <img
                        src={`${getBaseUrl()}${category.image_url}`}
                        srcSet={`
                          ${getBaseUrl()}${category.image_url}?w=72 1x,
                          ${getBaseUrl()}${category.image_url}?w=144 2x
                        `}
                        alt={category.name}
                        className="home-category-image"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="home-category-placeholder">
                        <Coffee size={24} color="#8e8e93" />
                      </div>
                    )}
                  </div>
                  <p className="home-category-name">{category.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="home-action-section">
        {banners.length > 0 && (
          <div className="home-banner-container" ref={bannerContainerRef}>
            <div className="home-banner-grid">
              {banners.map((banner) => (
                <div key={banner.id} className="home-banner-item">
                  <Banner banner={banner} />
                </div>
              ))}
            </div>
          </div>
        )}
        <TopCategories />
      </div>

      <div className="home-menu-section" ref={menuSectionRef}>
        <h2 className="home-menu-title">
          {searchQuery ? `Search Results (${filteredItems.length})` : 'Featured Menu'}
        </h2>

        {filteredItems.length === 0 && !loading && (
          <div className="home-empty-state">
            <Coffee size={40} color="#8e8e93" />
            <p className="home-empty-text">
              {searchQuery ? 'No items found for your search.' : 'No menu items available.'}
            </p>
          </div>
        )}

        <div className="home-menu-grid">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              onAddToCart={addToCart}
              onView={handleViewProduct}
            />
          ))}
        </div>

        <BestSellers addToCart={addToCart} />
      </div>
    </div>
  );
}

export default Home;
