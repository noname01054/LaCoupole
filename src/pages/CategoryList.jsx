import { useState, useEffect } from 'react';
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

  useEffect(() => {
    window.scrollTo(0, 0);

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

  const handleCategoryClick = (id) => {
    navigate(`/category/${id}`);
  };

  const handleClose = () => {
    setShowCloseAnimation(true);
    setTimeout(() => {
      navigate(-1);
    }, 300);
  };

  if (error) {
    return (
      <div className="category-list-error-container">
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
      <div className="category-list-loading-container">
        <div className="category-list-loading-spinner"></div>
        <p className="category-list-loading-text">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className={`category-list-container ${showCloseAnimation ? 'category-list-container-closing' : ''}`}>
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
        
        <div className="category-list-grid">
          {categories.map((category, index) => (
            <div
              key={category.id}
              className="category-list-card"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => handleCategoryClick(category.id)}
            >
              <div className="category-list-image-container">
                {category.image_url ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${category.image_url}`}
                    alt={category.name}
                    className="category-list-image"
                    loading="lazy"
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
          ))}
        </div>
      </div>
    </div>
  );
}

export default CategoryList;