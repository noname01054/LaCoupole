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
  const [filteredItems, setFilteredItems] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  
  const navigate = useNavigate();
  const isMounted = useRef(true);
  const autoPlayRef = useRef(null);

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

  // Fetch all data on mount
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

        if (!isActive) return;

        setMenuItems(menuRes.data || []);
        setBreakfastItems(breakfastRes.data || []);
        setCategories([
          { id: 'all', name: 'Tout le menu', image_url: null },
          ...(catRes.data || []),
        ]);
        setFilteredItems(menuRes.data || []);
        setBanners(bannerRes.data || []);
      } catch (err) {
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
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, []);

  // Trigger search when query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  // Auto-play banner carousel
  useEffect(() => {
    if (banners.length <= 1) {
      setCurrentBannerIndex(0);
      return;
    }

    autoPlayRef.current = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000);

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [banners.length]);

  // Smooth sliding value
  const bannerTranslateX = -currentBannerIndex * 100;

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

  // Memoized category grid items
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
              src={category.image_url}
              srcSet={`${category.image_url}?w=72 1x, ${category.image_url}?w=144 2x`}
              alt={category.name}
              className="home-category-image"
              loading="lazy"
              decoding="async"
              onError={(e) => (e.target.src = '/placeholder.jpg')}
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
  }, [categories, handleCategoryClick]);

  // Sale items
  const saleItems = useMemo(() => {
    return [
      ...menuItems,
      ...breakfastItems.map((b) => ({ ...b, type: 'breakfast' })),
    ]
      .filter((item) => item.sale_price && item.sale_price < item.regular_price)
      .map((item) => (
        <div key={`${item.type || 'menuItem'}-${item.id}`} className="home-sale-item">
          <MenuItemCard
            item={item}
            onAddToCart={addToCart}
            onView={() => handleViewProduct(item.id, item.type || 'menuItem')}
            popupClassName="home-menu-item-popup"
          />
        </div>
      ));
  }, [menuItems, breakfastItems, addToCart, handleViewProduct]);

  // Category sections
  const categorySections = useMemo(() => {
    return categories
      .filter((c) => c.id !== 'all')
      .map((category) => {
        const itemsInCat = [
          ...menuItems.filter((i) => i.category_id === category.id),
          ...breakfastItems.filter((i) => i.category_id === category.id).map((i) => ({
            ...i,
            type: 'breakfast',
            category_name: category.name,
          })),
        ];

        if (itemsInCat.length === 0) return null;

        return (
          <div key={category.id} className="home-category-section">
            <div className="home-category-section-header">
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
                {itemsInCat.map((item) => (
                  <div key={`${item.type || 'menuItem'}-${item.id}`} className="home-category-item-scroll">
                    <MenuItemCard
                      item={item}
                      onAddToCart={addToCart}
                      onView={() => handleViewProduct(item.id, item.type || 'menuItem')}
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

  // Banner slides
  const bannerItems = useMemo(() => {
    return banners.map((banner) => (
      <div key={banner.id} className="home-banner-slide">
        <Banner banner={banner} />
      </div>
    ));
  }, [banners]);

  if (error) {
    return (
      <div className="home-error-container">
        <p className="home-error-text">Erreur: {error}</p>
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
          <div className="home-welcome-emoji">Plate</div>
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
          {searchQuery && !searchLoading && (
            <button className="home-clear-results-button" onClick={() => setSearchQuery('')}>
              Effacer
            </button>
          )}
        </div>

        {searchQuery.trim() ? (
          <div className="home-search-results-section">
            <div className="home-search-results-header">
              <h2 className="home-search-results-title">
                Résultats pour "{searchQuery}"
              </h2>
              <button className="home-see-all-button" onClick={() => navigate('/categories')}>
                Voir tout
              </button>
            </div>

            {searchLoading ? (
              <div className="home-search-loading">
                <div className="home-loading-spinner"></div>
                <p>Recherche...</p>
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="home-search-results-grid">
                {filteredItems.map((item, i) => (
                  <div
                    key={`search-${item.id}`}
                    className="home-search-result-item"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <MenuItemCard
                      item={item}
                      onAddToCart={addToCart}
                      onView={() => handleViewProduct(item.id)}
                      popupClassName="home-menu-item-popup"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="home-no-results-text">
                Aucun résultat pour "{searchQuery}"
              </p>
            )}
          </div>
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
          {/* SMOOTH AUTO-SCROLLING BANNER CAROUSEL */}
          {banners.length > 0 && (
            <div className="home-banner-carousel-wrapper">
              <div className="home-banner-carousel-container">
                <div
                  className="home-banner-carousel-track"
                  style={{
                    transform: `translateX(${bannerTranslateX}%)`,
                    transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {bannerItems}
                  {/* Seamless loop: duplicate first slide */}
                  {banners.length > 1 && (
                    <div className="home-banner-slide">
                      <Banner banner={banners[0]} />
                    </div>
                  )}
                </div>
              </div>

              {/* Dots */}
              {banners.length > 1 && (
                <div className="home-banner-dots">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      className={`home-banner-dot ${currentBannerIndex === idx ? 'active' : ''}`}
                      onClick={() => setCurrentBannerIndex(idx)}
                      aria-label={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
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
