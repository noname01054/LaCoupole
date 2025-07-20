import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { AlertTriangle, Coffee, ArrowRight, RotateCw, X } from 'lucide-react';
import './css/CategoryList.css';

function CategoryList() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCloseAnimation, setShowCloseAnimation] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchCurrentX, setTouchCurrentX] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const lastTouchTime = useRef(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });

    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await api.get('/categories');
        setCategories(response.data || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error(error.response?.data?.error || 'Failed to load categories');
        setError('Failed to load categories.');
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const handleCategoryClick = useCallback((id) => {
    navigate(`/category/${id}`);
  }, [navigate]);

  const handleClose = useCallback(() => {
    setShowCloseAnimation(true);
    setTimeout(() => {
      navigate(-1);
    }, 200);
  }, [navigate]);

  const handleTouchStart = useCallback((e) => {
    if (window.innerWidth > 768) return;
    setTouchStartX(e.touches[0].clientX);
    setTouchCurrentX(e.touches[0].clientX);
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (!isSwiping || window.innerWidth > 768) return;
      const now = performance.now();
      if (now - lastTouchTime.current < 16) return; // Throttle to ~60fps
      lastTouchTime.current = now;

      setTouchCurrentX(e.touches[0].clientX);
      const deltaX = touchCurrentX - touchStartX;
      const boundedDeltaX = Math.max(Math.min(deltaX, 150), -150);
      if (containerRef.current) {
        requestAnimationFrame(() => {
          containerRef.current.style.transform = `translateX(${boundedDeltaX}px)`;
          containerRef.current.style.transition = 'none';
        });
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
      requestAnimationFrame(() => {
        containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        containerRef.current.style.transform = 'translateX(0)';
      });
    }

    if (deltaX > swipeThreshold) {
      navigate('/');
    } else if (deltaX < -swipeThreshold && categories.length > 0) {
      navigate(`/category/${categories[0].id}`);
    }

    setTouchStartX(null);
    setTouchCurrentX(null);
  }, [isSwiping, touchCurrentX, touchStartX, navigate, categories]);

  const categoryItems = useMemo(() => {
    return categories.map((category, index) => (
      <div
        key={category.id}
        className="category-list-card"
        style={{ animationDelay: `${index * 0.05}s` }}
        onClick={() => handleCategoryClick(category.id)}
      >
        <div className="category-list-image-container">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name}
              className="category-list-image"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                console.error('Error loading category image:', category.image_url);
                e.target.src = '/placeholder.jpg';
              }}
            />
          ) : (
            <div className="category-list-placeholder-image">
              <Coffee size={40} color="#ff8c42" />
            </div>
          )}
          <div className="category-list-image-overlay"></div>
          <div className="category-list-card-badge">
            <ArrowRight size={16} color="#fff" />
          </div>
        </div>
        <div className="category-list-card-content">
          <h3 className="category-list-category-name">{category.name}</h3>
          <p className="category-list-category-description">
            {category.description || 'Explore delicious options in this category'}
          </p>
        </div>
      </div>
    ));
  }, [categories, handleCategoryClick]);

  if (error) {
    return (
      <div
        className="category-list-error-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="category-list-error-content">
          <AlertTriangle size={56} color="#ff6b35" className="category-list-error-icon" />
          <h3 className="category-list-error-title">Oops! Something went wrong</h3>
          <p className="category-list-error-text">{error}</p>
          <button className="category-list-retry-button" onClick={() => window.location.reload()}>
            <RotateCw size={18} style={{ marginRight: '8px' }} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="category-list-loading-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="category-list-loading-spinner"></div>
        <p className="category-list-loading-text">Loading categories...</p>
      </div>
    );
  }

  return (
    <div
      className={`category-list-container ${showCloseAnimation ? 'category-list-container-closing' : ''}`}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="category-list-header">
        <div className="category-list-header-content">
          <button 
            className="category-list-close-button"
            onClick={handleClose}
          >
            <X size={20} color="#fff" />
          </button>
          <div className="category-list-title-section">
            <h1 className="category-list-title">Our Categories</h1>
            <p className="category-list-subtitle">Discover what we have to offer</p>
          </div>
          <div className="category-list-header-emoji">🍴</div>
        </div>
      </div>
      <div className="category-list-content">
        {categories.length === 0 && !loading && (
          <div className="category-list-empty-state">
            <Coffee size={64} color="#ff8c42" className="category-list-empty-icon" />
            <h3 className="category-list-empty-title">No Categories Yet</h3>
            <p className="category-list-empty-text">Check back soon for new categories!</p>
          </div>
        )}
        <div className="category-list-grid">{categoryItems}</div>
      </div>
    </div>
  );
}

export default CategoryList;
