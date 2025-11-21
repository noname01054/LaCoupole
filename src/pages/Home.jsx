import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { Search, Coffee } from 'lucide-react';
import MenuItemCard from '../components/MenuItemCard';
import Banner from '../components/Banner';
import TopCategories from '../components/TopCategories';
import BestSellers from '../components/BestSellers';
import debounce from 'lodash/debounce';
import './css/Home.css';

function Home({ addToCart }) {
  const [menuItems, setMenuItems] = useState([]);
  const [breakfastItems, setBreakfastItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const navigate = useNavigate();
  const bannerContainerRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const isMounted = useRef(true);

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      debounce(async (query) => {
        if (!isMounted.current) return;
        setSearchLoading(true);
        if (query.trim().length < 2) {
          setFilteredItems(menuItems);
          setSearchLoading(false);
          return;
        }
        try {
          const response = await api.searchMenuItems(query);
          setFilteredItems(response.data || []);
        } catch (error) {
          console.error('Erreur lors de la recherche :', error);
          toast.error(error.response?.data?.error || 'Échec de la recherche');
          setFilteredItems([]);
        } finally {
          setSearchLoading(false);
        }
      }, 500),
    [menuItems]
  );

  // Fetch all data
  useEffect(() => {
    let isActive = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [menuRes, breakfastRes, catRes, bannerRes] = await Promise.all([
          api.get('/menu-items'),
          api.getBreakfasts(),
          api.get('/categories'),
          api.getEnabledBanners(),
        ]);

        if (isActive) {
          setMenuItems(menuRes.data || []);
          setBreakfastItems(breakfastRes.data || []);
          setCategories([
            { id: 'all', name: 'Tout le menu', image_url: null },
            ...(catRes.data || []),
          ]);
          setFilteredItems(menuRes.data || []);
          setBanners(bannerRes.data || []);
        }
      } catch (err) {
        console.error('Erreur chargement données:', err);
        if (isActive) {
          toast.error('Impossible de charger les données');
          setError('Échec du chargement.');
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isActive = false;
      isMounted.current = false;
      debouncedSearch.cancel();
    };
  }, []);

  // Search effect
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  // ==================== AUTO SCROLL BANNERS ====================
  useEffect(() => {
    if (banners.length <= 1 || !bannerContainerRef.current) {
      return;
    }

    const container = bannerContainerRef.current;

    const startAutoScroll = () => {
      autoScrollIntervalRef.current = setInterval(() => {
        setCurrentBannerIndex((prev) => {
          const next = (prev + 1) % banners.length;
          container.scrollTo({
            left: next * container.offsetWidth,
            behavior: 'smooth',
          });
          return next;
        });
      }, 4000); // Change banner every 4 seconds
    };

    const stopAutoScroll = () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };

    startAutoScroll();

    // Pause on hover / touch
    container.addEventListener('mouseenter', stopAutoScroll);
    container.addEventListener('touchstart', stopAutoScroll);
    container.addEventListener('mouseleave', startAutoScroll);
    container.addEventListener('touchend', startAutoScroll);

    // Sync index when user manually scrolls
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const width = container.offsetWidth;
      const index = Math.round(scrollLeft / width);
      setCurrentBannerIndex(index % banners.length);
    };

    container.addEventListener('scroll', handleScroll);

    return () => {
      stopAutoScroll();
      container.removeEventListener('mouseenter', stopAutoScroll);
      container.removeEventListener('touchstart', stopAutoScroll);
      container.removeEventListener('mouseleave', startAutoScroll);
      container.removeEventListener('touchend', startAutoScroll);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [banners.length]);

  // Sync index on manual scroll snap (extra safety)
  useEffect(() => {
    const container = bannerContainerRef.current;
    if (!container) return;

    const syncIndex = () => {
      const index = Math.round(container.scrollLeft / container.offsetWidth);
      setCurrentBannerIndex(index % banners.length);
    };

    const id = setTimeout(syncIndex, 150); // after scroll ends
    return () => clearTimeout(id);
  }, [banners.length]);

  const handleViewProduct = useCallback((id, itemType = 'menuItem') => {
    if (itemType === 'breakfast') {
      navigate(`/breakfast/${id}`);
    } else {
      navigate(`/product/${id}`);
    }
  }, [navigate]);

  const handleCategoryClick = useCallback((categoryId) => {
    if (categoryId === 'all') {
      navigate('/categories');
    } else {
      navigate(`/category/${categoryId}`);
    }
  }, [navigate]);

  const categoryItems = useMemo(() => {
    return categories.slice(0, 6).map((cat, i) => (
      <div
        key={cat.id}
        className="home-category-item"
        style={{ animationDelay: `${i * 0.08}s` }}
        onClick={() => handleCategoryClick(cat.id)}
      >
        <div className="home-category-image-container">
          {cat.image_url ? (
            <img
              src={cat.image_url}
              srcSet={`${cat.image_url}?w=72 1x, ${cat.image_url}?w=144 2x`}
              alt={cat.name}
              className="home-category-image"
              loading="lazy"
            />
          ) : (
            <div className="home-category-placeholder">
              <Coffee size={24} color="#8e8e93" />
            </div>
          )}
        </div>
        <p className="home-category-name">{cat.name}</p>
      </div>
    ));
  }, [categories, handleCategoryClick]);

  const saleItems = useMemo(() => {
    return [...menuItems, ...breakfastItems.map(b => ({ ...b, type: 'breakfast' })]
      .filter(item => item.sale_price && item.sale_price < item.regular_price)
      .map(item => (
        <div key={`${item.type || 'menuItem'}-${item.id}`} className="home-sale-item">
          <MenuItemCard
            item={item} onAddToCart={addToCart} onView={() => handleViewProduct(item.id, item.type)} popupClassName="home-menu-item-popup" />
        </div>
      ));
  }, [menuItems, breakfastItems, addToCart, handleViewProduct]);

  const categorySections = useMemo(() => {
    return categories
      .filter(c => c.id !== 'all')
      .map(category => {
        const items = [
          ...menuItems.filter(i => i.category_id === category.id),
          ...breakfastItems
            .filter(b => b.category_id === category.id)
            .map(b => ...b, type: 'breakfast', category_name: category.name }),
        ];
        if (items.length === 0) return null;

        return (
          <div key={category.id} className="home-category-section">
            <div className="home-sale-header">
              <h2 className="home-category-section-title">{category.name}</h2>
              <button className="home-see-all-button" onClick={() => handleCategoryClick(category.id)}>
                Voir tout
              </button>
            </div>
            <div className="home-category-scroll-container">
              <div className="home-category-grid">
                {items.map(item => (
                  <div key={`${item.type || 'menuItem'}-${item.id}`} className="home-category-item-scroll">
                    <MenuItemCard
                      item={item}
                      onAddToCart={addToCart}
                      onView={() => handleViewProduct(item.id, item.type)}
                      popupClassName="home-menu-item-popup"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })
      .filter(Boolean);
  }, [categories, menuItems, breakfastItems, addToCart, handleViewProduct, handleCategoryClick]);

  if (error) {
    return (
      <div className="home-error-container">
        <div className="home-error-content">
          <p className="home-error-text">Erreur: {error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="home-loading-container">
        <div className="home-loading-spinner"></div>
        <p className="home-loading-text">Chargement du menu...</p>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <div className="home-welcome-section">
          <div className="home-welcome-content">
            <h1 className="home-welcome-title">Bon retour !</h1>
            <p className="home-welcome-subtitle">Que souhaitez-vous manger aujourd'hui ?</p>
          </div>
          <div className="home-welcome-emoji">🍽️</div>
        </div>

        <div className="home-search-container">
          <div className="home-search-wrapper">
            <Search size={18} color="#8e8e93" className="home-search-icon" />
            <input
              type="text"
              placeholder="Rechercher quelque chose"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="home-search-input"
            />
          </div>
          {searchQuery && filteredItems.length > 0 && !searchLoading && (
            <button className="home-clear-results-button" onClick={() => setSearchQuery('')}>
              Effacer
            </button>
          )}
        </div>

        {searchQuery.trim() ? (
          /* Search results - unchanged */
          <div className="home-search-results-section"> {/* ... your existing search UI ... */} </div>
        ) : (
          <div className="home-categories-section">
            <div className="home-categories-header">
              <h2 className="home-categories-title">Catégories</h2>
              <button className="home-see-all-button" onClick={() => navigate('/categories')}>
                Voir tout
              </button>
            </div>
            <div className="home-categories-scroll-container">
              <div className="home-categories-grid">{categoryItems}</div>
            </div>
          </div>
        )}
      </div>

      {!searchQuery.trim() && (
        <div className="home-action-section">
          {/* ==================== BANNER CAROUSEL ==================== */}
          {banners.length > 0 && (
            <>
              <div className="home-banner-container" ref={bannerContainerRef}>
                <div className="home-banner-grid">
                  {banners.map((banner) => (
                    <div key={banner.id} className="home-banner-item">
                      <Banner banner={banner} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Dots Indicator */}
              {banners.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', padding: '0 16px' }}>
                  {banners.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: i === currentBannerIndex ? 'var(--primary-color)' : 'rgba(255,255,255,0.5)',
                        transition: 'all 0.4s ease',
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <TopCategories />
          {saleItems.length > 0 && (
            <div className="home-sale-section">
              <div className="home-sale-header">
                <h2 className="home-sale-title">En promotion</h2>
                <button className="home-see-all-button" onClick={() => navigate('/sale')}>
                  Voir tout
                </button>
              </div>
              <div className="home-sale-scroll-container">
                <div className="home-sale-grid">{saleItems}</div>
              </div>
            </div>
          )}

          {categorySections}

          <BestSellers addToCart={addToCart} />
        </div>
      )}
    </div>
  );
}

export default Home;
