import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import MenuItemCard from '../components/MenuItemCard';
import {
  ShoppingCartOutlined,
  RemoveOutlined,
  AddOutlined,
  CategoryOutlined,
  CheckCircleOutlined,
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
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [selectedSupplement, setSelectedSupplement] = useState('0');
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(0);
  const [isRatingSubmitted, setIsRating] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchCurrentX, setTouchCurrentX] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchData = async () => {
      try {
        setLoading(true);
        const itemId = parseInt(id);
        if (isNaN(itemId) || itemId <= 0) {
          throw new Error('ID de produit invalide');
        }

        const [productResponse, relatedResponse, supplementsResponse, ratingResponse, categoriesResponse] = await Promise.all([
          api.get(`/menu-items/${itemId}`),
          api.get(`/menu-items/${itemId}/related`),
          api.getSupplementsByMenuItem(itemId),
          api.getRatingsByItem(itemId),
          api.get('/categories'),
        ]);

        const categoryResponse = await api.get(`/menu-items?category_id=${productResponse.data.category_id}`);

        setProduct(productResponse.data);
        setRelatedProducts(relatedResponse.data || []);
        setSupplements(supplementsResponse.data || []);
        setCategoryProducts(categoryResponse.data || []);
        setCategories(categoriesResponse.data || []);
        if (ratingResponse.data?.length > 0) {
          setIsRating(true);
          setRating(parseInt(ratingResponse.data[0].rating) || 0);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des détails du produit:', error);
        toast.error(error.response?.data?.error || 'Échec du chargement des détails du produit');
        setError('Échec du chargement des détails du produit');
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
          toast.error('Veuillez sélectionner une note entre 1 et 5');
          return;
        }
        try {
          await api.submitRating({
            item_id: parseInt(id),
            rating: parseInt(ratingValue),
          });
          setIsRating(true);
          toast.success('Note soumise !');
          const response = await api.get(`/menu-items/${id}`);
          setProduct(response.data);
        } catch (error) {
          console.error('Erreur lors de la soumission de la note:', error);
          toast.error(error.response?.data?.error || 'Échec de la soumission de la note');
        }
      }, 500),
    [id]
  );

  const handleAddToCart = useCallback(async () => {
    if (!product) {
      toast.error('Produit non chargé');
      return;
    }
    if (!product.availability) {
      toast.error('Article non disponible');
      return;
    }
    try {
      const selectedSupplementData = selectedSupplement !== '0'
        ? supplements.find((s) => s.supplement_id === parseInt(selectedSupplement))
        : null;
      const itemToAdd = {
        item_id: parseInt(product.id),
        name: product.name || 'Produit inconnu',
        unit_price: parseFloat(product.sale_price || product.regular_price) || 0,
        quantity: parseInt(quantity) || 1,
        image_url: product.image_url && product.image_url !== 'null' ? product.image_url : '/placeholder.jpg',
        supplement_id: selectedSupplementData ? parseInt(selectedSupplementData.supplement_id) : null,
        supplement_name: selectedSupplementData ? selectedSupplementData.name : null,
        supplement_price: selectedSupplementData ? parseFloat(selectedSupplementData.additional_price) || 0 : 0,
        cartItemId: `${product.id}-${Date.now()}`,
      };
      await addToCart(itemToAdd);
      toast.success(`${product.name} ajouté au panier !`);
      setSelectedSupplement('0');
      setQuantity(1);
    } catch (error) {
      console.error('Erreur lors de l\'ajout au panier:', error);
      toast.error(error.response?.data?.error || 'Échec de l\'ajout au panier');
    }
  }, [product, quantity, selectedSupplement, supplements, addToCart]);

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
      const boundedDeltaX = Math.max(Math.min(deltaX, 150), -150); // Limite la distance de glissement
      if (containerRef.current) {
        containerRef.current.style.transform = `translateX(${boundedDeltaX}px)`;
        containerRef.current.style.transition = 'none';
      }
    },
    [isSwiping, touchStartX, touchCurrentX]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isSwiping || window.innerWidth > 768) return;
    setIsSwiping(false);
    const deltaX = touchCurrentX - touchStartX;
    const swipeThreshold = 80;
    const currentIndex = categoryProducts.findIndex((p) => p.id === parseInt(id));

    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      containerRef.current.style.transform = 'translateX(0)';
    }

    if (deltaX > swipeThreshold) {
      // Glissement de gauche à droite : aller au menu de la catégorie si premier produit, sinon produit précédent
      if (currentIndex === 0 && product?.category_id) {
        navigate(`/category/${product.category_id}`);
      } else if (currentIndex > 0) {
        const prevProduct = categoryProducts[currentIndex - 1];
        navigate(`/product/${prevProduct.id}`);
      }
    } else if (deltaX < -swipeThreshold) {
      // Glissement de droite à gauche : produit suivant ou catégorie suivante non vide si dernier produit
      if (currentIndex < categoryProducts.length - 1) {
        const nextProduct = categoryProducts[currentIndex + 1];
        navigate(`/product/${nextProduct.id}`);
      } else if (categories.length > 0 && product?.category_id) {
        const categoryIds = categories.map(cat => parseInt(cat.id)).sort((a, b) => a - b);
        let currentCategoryIndex = categoryIds.indexOf(parseInt(product.category_id));
        let nextCategoryId = null;

        // Trouver la prochaine catégorie non vide
        while (currentCategoryIndex < categoryIds.length - 1) {
          currentCategoryIndex += 1;
          const candidateCategoryId = categoryIds[currentCategoryIndex];
          try {
            const response = await api.get(`/menu-items?category_id=${candidateCategoryId}`);
            if (response.data && response.data.length > 0) {
              nextCategoryId = candidateCategoryId;
              break;
            }
          } catch (error) {
            console.error(`Erreur lors de la vérification de la catégorie ${candidateCategoryId}:`, error);
          }
        }

        if (nextCategoryId) {
          navigate(`/category/${nextCategoryId}`);
        }
      }
    }

    setTouchStartX(null);
    setTouchCurrentX(null);
  }, [isSwiping, touchCurrentX, touchStartX, categoryProducts, id, navigate, product, categories]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      containerRef.current.style.transform = 'translateX(0)';
    }
    setIsSwiping(false);
    setTouchStartX(null);
    setTouchCurrentX(null);
  }, [id]);

  if (error) {
    return (
      <div
        className="product-details-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="product-details-error-container">
          <div className="product-details-error-icon">🍽️</div>
          <p className="product-details-error-text">{error}</p>
          <button className="product-details-retry-button" onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="product-details-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="product-details-loading-container">
          <div className="product-details-loading-spinner"></div>
          <p className="product-details-loading-text">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className="product-details-container"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="product-details-error-container">
          <div className="product-details-error-icon">🔍</div>
          <p className="product-details-error-text">Produit non trouvé</p>
          <button className="product-details-retry-button" onClick={() => navigate('/')}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const imageSrc = product.image_url && product.image_url !== 'null' ? product.image_url : '/placeholder.jpg';

  const regularPrice = parseFloat(product.regular_price) || 0;
  const salePrice = parseFloat(product.sale_price) || null;
  const averageRating = parseFloat(product.average_rating) || 0;
  const reviewCount = parseInt(product.review_count) || 0;

  return (
    <div
      className="product-details-container"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="product-details-image-section">
        <div className="product-details-image-container">
          <img
            src={imageSrc}
            alt={product.name || 'Produit'}
            className="product-details-product-image"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              console.error('Erreur lors du chargement de l\'image du produit:', product.image_url);
              e.target.src = '/placeholder.jpg';
            }}
          />
        </div>
      </div>

      <div className="product-details-details-section">
        <h2 className="product-details-product-title">{product.name || 'Produit inconnu'}</h2>
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
            {averageRating.toFixed(1)} ({reviewCount} avis)
          </span>
        </div>

        <p className="product-details-product-description">
          {product.description || 'Aucune description disponible.'}
        </p>

        <div className="product-details-price-section">
          <div className="product-details-price-container">
            {salePrice ? (
              <>
                <span className="product-details-original-price">{regularPrice.toFixed(2)} DT</span>
                <span className="product-details-sale-price">{salePrice.toFixed(2)} DT</span>
                <span className="product-details-save-badge">ÉCONOMISEZ {(regularPrice - salePrice).toFixed(2)} DT</span>
              </>
            ) : (
              <span className="product-details-regular-price-only">{regularPrice.toFixed(2)} DT</span>
            )}
          </div>
          <div className="product-details-total-price">
            Total : <span className="product-details-total-amount">{calculateTotalPrice()} DT</span>
          </div>
        </div>

        <div className="product-details-options-card">
          <div className="product-details-option-row">
            <div className="product-details-option-left">
              <CheckCircleOutlined
                className={product.availability ? 'text-green-500' : 'text-red-500'}
              />
              <span className="product-details-option-label">Disponibilité</span>
            </div>
            <span
              className="product-details-option-value"
            >
              {product.availability ? 'En stock' : 'En rupture de stock'}
            </span>
          </div>

          {product.dietary_tags && product.dietary_tags !== '[]' && (
            <div className="product-details-option-row">
              <div className="product-details-option-left">
                <RestaurantMenuOutlined className="text-orange-500" />
                <span className="product-details-option-label">Étiquettes diététiques</span>
              </div>
              <span className="product-details-option-value">
                {JSON.parse(product.dietary_tags || '[]').join(', ') || 'Aucune'}
              </span>
            </div>
          )}

          {supplements.length > 0 && (
            <div className="product-details-option-row">
              <div className="product-details-option-left">
                <CategoryOutlined className="text-orange-500" />
                <span className="product-details-option-label">Ajouter un supplément</span>
              </div>
              <select
                value={selectedSupplement}
                onChange={(e) => setSelectedSupplement(e.target.value)}
                className="product-details-supplement-select"
              >
                <option value="0">Aucun</option>
                {supplements.map((s) => (
                  <option key={s.supplement_id} value={s.supplement_id}>
                    {s.name} (+{parseFloat(s.additional_price || 0).toFixed(2)} DT)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="product-details-option-row">
            <div className="product-details-option-left">
              <Star className="text-yellow-400" />
              <span className="product-details-option-label">Noter cet article</span>
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
                  Soumettre
                </button>
              )}
              {isRatingSubmitted && <span className="product-details-rating-thank-you">Merci !</span>}
            </div>
          </div>

          <div className="product-details-option-row">
            <div className="product-details-option-left">
              <span className="product-details-option-label">Quantité</span>
            </div>
            <div className="product-details-quantity-container">
              <button
                className="product-details-quantity-button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1 || !product.availability}
              >
                <RemoveOutlined />
              </button>
              <span className="product-details-quantity-display">{quantity}</span>
              <button
                className="product-details-quantity-button"
                onClick={() => setQuantity(quantity + 1)}
                disabled={!product.availability}
              >
                <AddOutlined />
              </button>
            </div>
          </div>
        </div>

        <button
          className="product-details-add-to-cart-button"
          onClick={handleAddToCart}
          disabled={!product.availability}
        >
          <ShoppingCartOutlined />
          {product.availability ? `Ajouter au panier • ${calculateTotalPrice()} DT` : 'Indisponible'}
        </button>
      </div>

      {relatedProducts.length > 0 && (
        <div className="product-details-related-section">
          <h3 className="product-details-section-title">Vous pourriez aussi aimer</h3>
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
