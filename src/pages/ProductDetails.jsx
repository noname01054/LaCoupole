import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import MenuItemCard from '../components/MenuItemCard';
import {
  ShoppingCartOutlined,
  FavoriteOutlined,
  ShareOutlined,
  RemoveOutlined,
  AddOutlined,
  CategoryOutlined,
  CheckCircleOutlined,
  ArrowBackIosOutlined,
  Star,
  RestaurantMenuOutlined,
} from '@mui/icons-material';
import './css/ProductDetails.css';

function ProductDetails({ addToCart }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [selectedSupplement, setSelectedSupplement] = useState('0');
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [rating, setRating] = useState(0);
  const [isRatingSubmitted, setIsRating] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchData = async () => {
      try {
        setLoading(true);
        const itemId = parseInt(id);
        if (isNaN(itemId) || itemId <= 0) {
          throw new Error('Invalid product ID');
        }
        const [productResponse, relatedResponse, supplementsResponse, ratingResponse] = await Promise.all([
          api.get(`/menu-items/${itemId}`),
          api.get(`/menu-items/${itemId}/related`),
          api.getSupplementsByMenuItem(itemId),
          api.getRatingsByItem(itemId),
        ]);
        setProduct(productResponse.data);
        setRelatedProducts(relatedResponse.data || []);
        setSupplements(supplementsResponse.data || []);
        if (ratingResponse.data?.length > 0) {
          setIsRating(true);
          setRating(parseInt(ratingResponse.data[0].rating) || 0);
        }
      } catch (error) {
        console.error('Error fetching product details:', error);
        toast.error(error.response?.data?.error || 'Failed to load product details');
        setError('Failed to load product details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const debouncedRatingSubmit = useMemo(
    () =>
      debounce(async (ratingValue) => {
        if (ratingValue < 1 || ratingValue > 5) {
          toast.error('Please select a rating between 1 and 5');
          return;
        }
        try {
          await api.submitRating({
            item_id: parseInt(id),
            rating: parseInt(ratingValue),
          });
          setIsRating(true);
          toast.success('Rating submitted!');
          const response = await api.get(`/menu-items/${id}`);
          setProduct(response.data);
        } catch (error) {
          console.error('Error posting rating:', error);
          toast.error(error.response?.data?.error || 'Failed to submit rating');
        }
      }, 500),
    [id]
  );

  const handleAddToCart = useCallback(async () => {
    if (!product) {
      toast.error('Product not loaded');
      return;
    }
    if (!product.availability) {
      toast.error('Item is not available');
      return;
    }
    try {
      const selectedSupplementData = selectedSupplement !== '0'
        ? supplements.find((s) => s.supplement_id === parseInt(selectedSupplement))
        : null;
      const itemToAdd = {
        item_id: parseInt(product.id),
        name: product.name || 'Unknown Product',
        unit_price: parseFloat(product.sale_price || product.regular_price) || 0,
        quantity: parseInt(quantity) || 1,
        image_url: product.image_url && product.image_url !== '/Uploads/undefined' && product.image_url !== 'null'
          ? product.image_url
          : '/placeholder.jpg',
        supplement_id: selectedSupplementData ? parseInt(selectedSupplementData.supplement_id) : null,
        supplement_name: selectedSupplementData ? selectedSupplementData.name : null,
        supplement_price: selectedSupplementData ? parseFloat(selectedSupplementData.additional_price) || 0 : 0,
        cartItemId: `${product.id}-${Date.now()}`,
      };
      await addToCart(itemToAdd);
      toast.success(`${product.name} added to cart!`);
      setSelectedSupplement('0');
      setQuantity(1);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error(error.response?.data?.error || 'Failed to add to cart');
    }
  }, [product, quantity, selectedSupplement, supplements, addToCart]);

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product?.name || 'Product',
          text: product?.description || 'Check out this product!',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share');
    }
  }, [product]);

  const handleStarClick = useCallback((star) => {
    if (!isRatingSubmitted) {
      setRating(star);
    }
  }, [isRatingSubmitted]);

  const handleViewProduct = useCallback((productId) => {
    navigate(`/product/${productId}`);
  }, [navigate]);

  const calculateTotalPrice = useCallback(() => {
    const basePrice = parseFloat(product?.sale_price || product?.regular_price) || 0;
    const supplementPrice = selectedSupplement !== '0'
      ? parseFloat(supplements.find((s) => s.supplement_id === parseInt(selectedSupplement))?.additional_price) || 0
      : 0;
    return ((basePrice + supplementPrice) * quantity).toFixed(2);
  }, [product, selectedSupplement, supplements, quantity]);

  if (error) {
    return (
      

      <div className="product-details-container">
        <div className="product-details-error-container">
          <div className="product-details-error-icon">🍽️</div>
          <p className="product-details-error-text">{error}</p>
          <button className="product-details-retry-button" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      
      <div className="product-details-container">
        <div className="product-details-loading-container">
          <div className="product-details-loading-spinner"></div>
          <p className="product-details-loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      
      <div className="product-details-container">
        <div className="product-details-error-container">
          <div className="product-details-error-icon">🔍</div>
          <p className="product-details-error-text">Product not found</p>
          <button className="product-details-retry-button" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const imageSrc = product.image_url && product.image_url !== '/Uploads/undefined' && product.image_url !== 'null'
    ? `${api.defaults.baseURL.replace('/api', '')}${product.image_url}`
    : '/placeholder.jpg';

  const regularPrice = parseFloat(product.regular_price) || 0;
  const salePrice = parseFloat(product.sale_price) || null;
  const averageRating = parseFloat(product.average_rating) || 0;
  const reviewCount = parseInt(product.review_count) || 0;

  return (
    <div className="product-details-container">
      <div className="product-details-header">
        <button className="product-details-header-button" onClick={() => navigate(-1)}>
          <ArrowBackIosOutlined style={{ fontSize: '18px' }} />
        </button>
        <h1 className="product-details-header-title">Product Details</h1>
        <button className="product-details-header-button" onClick={handleShare}>
          <ShareOutlined style={{ fontSize: '18px' }} />
        </button>
      </div>

      <div className="product-details-image-section">
        <div className="product-details-image-container">
          <img
            src={imageSrc}
            alt={product.name || 'Product'}
            className="product-details-product-image"
            loading="lazy"
            decoding="async"
            onError={(e) => (e.target.src = '/placeholder.jpg')}
          />
          <button
            className="product-details-favorite-button"
            style={{
              backgroundColor: isFavorite ? 'rgba(255, 107, 53, 0.1)' : 'rgba(255, 255, 255, 0.9)',
            }}
            onClick={() => setIsFavorite(!isFavorite)}
          >
            <FavoriteOutlined
              style={{
                fontSize: '20px',
                color: isFavorite ? '#ff6b35' : '#8e8e93',
              }}
            />
          </button>
        </div>
      </div>

      <div className="product-details-details-section">
        <h2 className="product-details-product-title">{product.name || 'Unknown Product'}</h2>
        <div className="product-details-rating-container">
          <div className="product-details-rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={star <= Math.round(averageRating) ? 'product-details-rating-star-filled' : 'product-details-rating-star'}
              />
            ))}
          </div>
          <span className="product-details-rating-text">
            {averageRating.toFixed(1)} ({reviewCount} reviews)
          </span>
        </div>

        <p className="product-details-product-description">
          {product.description || 'No description available.'}
        </p>

        <div className="product-details-price-section">
          <div className="product-details-price-container">
            {salePrice ? (
              <>
                <span className="product-details-original-price">${regularPrice.toFixed(2)}</span>
                <span className="product-details-sale-price">${salePrice.toFixed(2)}</span>
                <span className="product-details-save-badge">SAVE ${(regularPrice - salePrice).toFixed(2)}</span>
              </>
            ) : (
              <span className="product-details-regular-pricerect-price">${regularPrice.toFixed(2)}</span>
            )}
          </div>
          <div className="product-details-total-price">
            Total: <span className="product-details-total-amount">${calculateTotalPrice()}</span>
          </div>
        </div>

        <div className="product-details-options-card">
          <div className="product-details-option-row">
            <div className="product-details-option-left">
              <CheckCircleOutlined
                style={{
                  fontSize: '18px',
                  color: product.availability ? '#34d399' : '#ef4444',
                }}
              />
              <span className="product-details-option-label">Availability</span>
            </div>
            <span
              className="product-details-option-value"
              style={{
                color: product.availability ? '#34d399' : '#ef4444',
              }}
            >
              {product.availability ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>

          {product.dietary_tags && product.dietary_tags !== '[]' && (
            <div className="product-details-option-row">
              <div className="product-details-option-left">
                <RestaurantMenuOutlined style={{ fontSize: '18px', color: '#ff6b35' }} />
                <span className="product-details-option-label">Dietary Tags</span>
              </div>
              <span className="product-details-option-value">
                {JSON.parse(product.dietary_tags || '[]').join(', ') || 'None'}
              </span>
            </div>
          )}

          {supplements.length > 0 && (
            <div className="product-details-option-row">
              <div className="product-details-option-left">
                <CategoryOutlined style={{ fontSize: '18px', color: '#ff6b35' }} />
                <span className="product-details-option-label">Add Supplement</span>
              </div>
              <select
                value={selectedSupplement}
                onChange={(e) => setSelectedSupplement(e.target.value)}
                className="product-details-supplement-select"
              >
                <option value="0">None</option>
                {supplements.map((s) => (
                  <option key={s.supplement_id} value={s.supplement_id}>
                    {s.name} (+${parseFloat(s.additional_price || 0).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="product-details-option-row">
            <div className="product-details-option-left">
              <Star style={{ fontSize: '18px', color: '#fbbf24' }} />
              <span className="product-details-option-label">Rate this item</span>
            </div>
            <div className="product-details-user-rating-container">
              <div className="product-details-user-rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={star <= rating ? 'product-details-user-rating-star-filled' : 'product-details-user-rating-star'}
                    onClick={() => handleStarClick(star)}
                  />
                ))}
              </div>
              {!isRatingSubmitted && rating > 0 && (
                <button
                  className="product-details-rating-submit-button"
                  onClick={() => debouncedRatingSubmit(rating)}
                >
                  Submit
                </button>
              )}
              {isRatingSubmitted && <span className="product-details-rating-thank-you">Thank you!</span>}
            </div>
          </div>

          <div className="product-details-option-row">
            <div className="product-details-option-left">
              <span className="product-details-option-label">Quantity</span>
            </div>
            <div className="product-details-quantity-container">
              <button
                className="product-details-quantity-button"
                style={{
                  ...(quantity <= 1 || !product.availability ? { backgroundColor: '#e5e7eb', cursor: 'not-allowed', color: '#9ca3af' } : {}),
                }}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1 || !product.availability}
              >
                <RemoveOutlined style={{ fontSize: '14px' }} />
              </button>
              <span className="product-details-quantity-display">{quantity}</span>
              <button
                className="product-details-quantity-button"
                style={{
                  ...(!product.availability ? { backgroundColor: '#e5e7eb', cursor: 'not-allowed', color: '#9ca3af' } : {}),
                }}
                onClick={() => setQuantity(quantity + 1)}
                disabled={!product.availability}
              >
                <AddOutlined style={{ fontSize: '14px' }} />
              </button>
            </div>
          </div>
        </div>

        <button
          className="product-details-add-to-cart-button"
          style={{
            ...(!product.availability ? { background: '#e5e7eb', cursor: 'not-allowed', color: '#9ca3af' } : {}),
          }}
          onClick={handleAddToCart}
          disabled={!product.availability}
        >
          <ShoppingCartOutlined style={{ fontSize: '18px' }} />
          {product.availability ? `Add to Cart • $${calculateTotalPrice()}` : 'Unavailable'}
        </button>
      </div>

      {relatedProducts.length > .0 && (
        <div className="product-details-related-section">
          <h3 className="product-details-section-title">You might also like</h3>
          <div className="product-details-related-grid">
            {relatedProducts.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                onAddToCart={addToCart}
                onView={handleViewProduct}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetails;