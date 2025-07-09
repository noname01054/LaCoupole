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
  const [breakfastItems, setBreakfastItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const navigate = useNavigate();
  const bannerContainerRef = useRef(null);
  const containerRef = useRef(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchCurrentX, setTouchCurrentX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchCurrentY, setTouchCurrentY] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const lastTouchTime = useRef(0);
  const isMounted = useRef(true);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query) => {
        if (!isMounted.current) return;
        if (query.trim() === '') {
          setFilteredItems([...menuItems, ...breakfastItems]);
          return;
        }
        try {
          const response = await api.searchMenuItems(query);
          const breakfastResponse = await api.searchBreakfasts(query);
          setFilteredItems([...(response.data || []), ...(breakfastResponse.data || [])]);
        } catch (error) {
          console.error('Erreur lors de la recherche des éléments du menu :', error);
          toast.error(error.response?.data?.error || 'Échec de la recherche des éléments du menu');
          setFilteredItems([]);
        }
      }, 500),
    [menuItems, breakfastItems]
  );

  useEffect(() => {
    let isActive = true;
    const fetchData = async () => {
      try {
        console.log('Récupération des données pour la page d\'accueil', { timestamp: new Date().toISOString() });
        setLoading(true);
        const [menuResponse, breakfastResponse, categoriesResponse, bannersResponse] = await Promise.all([
          api.get('/menu-items'),
          api.get('/breakfasts'),
          api.get('/categories'),
          api.getEnabledBanners(),
        ]);

        if (isActive) {
          const menuData = menuResponse.data || [];
          const breakfastData = (breakfastResponse.data || []).map(item => ({
            ...item,
            type: 'breakfast',
          }));
          const categoriesData = categoriesResponse.data || [];
          const bannersData = bannersResponse.data || [];

          setMenuItems(menuData);
          setBreakfastItems(breakfastData);
          setCategories([
            { id: 'all', name: 'Tout le menu', image_url: null },
            ...categoriesData,
          ]);
          setFilteredItems([...menuData, ...breakfastData]);
          setBanners(bannersData);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données :', error);
        if (isActive) {
          toast.error(error.response?.data?.error || 'Échec du chargement des données');
          setError('Échec du chargement des données.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
          console.log('Récupération des données terminée', { loading: false, timestamp: new Date().toISOString() });
        }
      }
    };
    fetchData();
    return () => {
      isActive = false;
      console.log('Nettoyage de l\'effet Home', { timestamp: new Date().toISOString() });
      debouncedSearch.cancel();
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      requestAnimationFrame(() => {
        setCurrentBannerIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % banners.length;
          if (bannerContainerRef.current) {
            bannerContainerRef.current.scrollTo({
              left: nextIndex * bannerContainerRef.current.offsetWidth,
              behavior: 'auto',
            });
          }
          return nextIndex;
        });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [banners.length]);

  const handleViewProduct = useCallback((id, type = 'menuItem') => {
    if (type === 'breakfast') {
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

  const handleTouchStart = useCallback((e) => {
    if (window.innerWidth > 768) return;
    const isScrollable = e.target.closest(
      '.home-categories-scroll-container, .home-banner-container, .home-sale-scroll-container, .home-category-scroll-container, [class*="top-categories"], [class*="best-sellers"]'
    );
    setSwipeEnabled(!isScrollable);
    if (!isScrollable) {
      setTouchStartX(e.touches[0].clientX);
      setTouchCurrentX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
      setTouchCurrentY(e.touches[0].clientY);
      setIsSwiping(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (!isSwiping || window.innerWidth > 768) return;
      const now = performance.now();
      if (now - lastTouchTime.current < 16) return;
      lastTouchTime.current = now;

      requestAnimationFrame(() => {
        setTouchCurrentX(e.touches[0].clientX);
        setTouchCurrentY(e.touches[0].clientY);
        const deltaX = touchCurrentX - touchStartX;
        const deltaY = touchCurrentY - touchStartY;

        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          setSwipeEnabled(false);
          return;
        }

        if (swipeEnabled && containerRef.current) {
          const boundedDeltaX = Math.max(Math.min(deltaX, 150), -150);
          containerRef.current.style.transform = `translateX(${boundedDeltaX}px)`;
          containerRef.current.style.transition = 'none';
        }
      });
    },
    [isSwiping, touchStartX, touchCurrentX, touchStartY, touchCurrentY, swipeEnabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping || window.innerWidth > 768) return;
    setIsSwiping(false);
    const deltaX = touchCurrentX - touchStartX;
    const swipeThreshold = 80;

    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      containerRef.current.style.transform = 'translateX(0)';
    }

    if (swipeEnabled && Math.abs(deltaX) > swipeThreshold) {
      navigate('/categories');
    }

    setTouchStartX(null);
    setTouchCurrentX(null);
    setTouchStartY(null);
    setTouchCurrentY(null);
    setSwipeEnabled(true);
  }, [isSwiping, touchCurrentX, touchStartX, swipeEnabled, navigate]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      containerRef.current.style.transform = 'translateX(0)';
    }
    setIsSwiping(false);
    setTouchStartX(null);
    setTouchCurrentX(null);
    setTouchStartY(null);
    setTouchCurrentY(null);
    setSwipeEnabled(true);
  }, []);

  const getBaseUrl = useCallback(() => import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000', []);

  const categoryItems = useMemo(() => {
    return categories.slice(0, 6).map((category, index) => (
      <div
        key={category.id}
        className="home-category-item"
        style={{ animationDelay: `${index * 0.08}s` }}
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
    ));
  }, [categories, handleCategoryClick, getBaseUrl]);

  const bannerItems = useMemo(() => {
    return banners.map((banner) => (
      <div key={banner.id} className="home-banner-item">
        <Banner banner={banner} />
      </div>
    ));
  }, [banners]);

  const saleItems = useMemo(() => {
    return [...menuItems, ...breakfastItems]
      .filter((item) => item.sale_price && item.sale_price < item.regular_price)
      .map((item) => (
        <div key={`${item.type || 'menuItem'}-${item.id}`} className="home-sale-item">
          <MenuItemCard
            item={item}
            onAddToCart={addToCart}
            onView={() => handleViewProduct(item.id, item.type || 'menuItem')}
          />
        </div>
      ));
  }, [menuItems, breakfastItems, addToCart, handleViewProduct]);

  const categorySections = useMemo(() => {
    return categories
      .filter((category) => category.id !== 'all')
      .map((category) => {
        const items = [...menuItems, ...breakfastItems].filter((item) => item.category_id === category.id);
        if (items.length === 0) return null;
        return (
          <div key={category.id} className="home-category-section">
            <div sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <h2 className="home-category-section-title">{category.name}</h2>
              <button
                className="home-see-all-button"
                onClick={() => handleCategoryClick(category.id)}
              >
                Voir tout
              </button>
            </div>
            <div className="home-category-scroll-container">
              <div className="home-category-grid">
                {items.map((item) => (
                  <div key={`${item.type || 'menuItem'}-${item.id}`} className="home-category-item-scroll">
                    <MenuItemCard
                      item={item}
                      onAddToCart={addToCart}
                      onView={() => handleViewProduct(item.id, item.type || 'menuItem')}
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
      <div
        className="home-error-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="home-error-content">
          <p className="home-error-text">Erreur: {error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="home-loading-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="home-loading-spinner"></div>
        <p className="home-loading-text">Chargement du menu...</p>
      </div>
    );
  }

  return (
    <div
      className="home-container"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
          <button
            className="home-filter-button"
            onClick={() => navigate('/categories')}
          >
            <ChevronDown size={18} color="#8e8e93" />
          </button>
        </div>

        <div className="home-categories-section">
          <div className="home-categories-header">
            <h2 className="home-categories-title">Catégories</h2>
            <button
              className="home-see-all-button"
              onClick={() => navigate('/categories')}
            >
              Voir tout
            </button>
          </div>

          <div className="home-categories-scroll-container">
            <div className="home-categories-grid">
              {categoryItems}
            </div>
          </div>
        </div>
      </div>

      <div className="home-action-section">
        {banners.length > 0 && (
          <div className="home-banner-container" ref={bannerContainerRef}>
            <div className="home-banner-grid">
              {bannerItems}
            </div>
          </div>
        )}
        <TopCategories />
        {saleItems.length > 0 && (
          <div className="home-sale-section">
            <div className="home-sale-header">
              <h2 className="home-sale-title">En promotion</h2>
              <button
                className="home-see-all-button"
                onClick={() => navigate('/sale')}
              >
                Voir tout
              </button>
            </div>
            <div className="home-sale-scroll-container">
              <div className="home-sale-grid">
                {saleItems}
              </div>
            </div>
          </div>
        )}
        {categorySections}
        <BestSellers addToCart={addToCart} />
      </div>

      <style>
        {`
          .home-categories-scroll-container,
          .home-banner-container,
          .home-sale-scroll-container,
          .home-category-scroll-container {
            scroll-behavior: auto;
            scroll-snap-type: x mandatory;
            will-change: scroll-position;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: contain;
          }

          .home-categories-scroll-container::-webkit-scrollbar,
          .home-banner-container::-webkit-scrollbar,
          .home-sale-scroll-container::-webkit-scrollbar,
          .home-category-scroll-container::-webkit-scrollbar {
            display: none;
          }

          .home-categories-scroll-container,
          .home-banner-container,
          .home-sale-scroll-container,
          .home-category-scroll-container {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .home-category-item,
          .home-sale-item,
          .home-category-item-scroll {
            will-change: transform, opacity;
            opacity: 1;
          }

          .home-banner-item {
            will-change: transform;
            opacity: 1;
          }

          @media (prefers-reduced-motion: reduce) {
            .home-categories-scroll-container,
            .home-banner-container,
            .home-sale-scroll-container,
            .home-category-scroll-container,
            .home-category-item,
            .home-sale-item,
            .home-category-item-scroll {
              scroll-behavior: auto !important;
              transition: none !important;
            }
          }
        `}
      </style>
    </div>
  );
}

export default Home;
