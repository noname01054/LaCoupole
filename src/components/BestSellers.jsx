import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { Coffee, Star } from 'lucide-react';

function BestSellers({ addToCart }) {
  const [bestSellers, setBestSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerIndex, setCenterIndex] = useState(0);
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const itemRefs = useRef([]);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const userInteractionRef = useRef(false);
  const lastUserInteractionRef = useRef(Date.now());

  useEffect(() => {
    const fetchBestSellers = async () => {
      try {
        setLoading(true);
        const response = await api.get('/menu-items/best-sellers');
        setBestSellers(response.data || []);
      } catch (error) {
        console.error('Error fetching best sellers:', error);
        toast.error(error.response?.data?.error || 'Failed to load best sellers');
      } finally {
        setLoading(false);
      }
    };
    fetchBestSellers();
  }, []);

  const updateCenterItem = useCallback(() => {
    if (!scrollContainerRef.current || bestSellers.length === 0) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    itemRefs.current.forEach((ref, index) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const elementCenter = rect.left + rect.width / 2;
        const distance = Math.abs(containerCenter - elementCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      }
    });

    setCenterIndex(closestIndex);
  }, [bestSellers.length]);

  const handleScroll = useCallback(() => {
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
    }

    userInteractionRef.current = true;
    lastUserInteractionRef.current = Date.now();

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    updateCenterItem();

    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      setTimeout(() => {
        userInteractionRef.current = false;
      }, 2000);
    }, 150);
  }, [updateCenterItem]);

  const startAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }

    autoScrollIntervalRef.current = setInterval(() => {
      if (!userInteractionRef.current && !isScrollingRef.current && bestSellers.length > 0) {
        const container = scrollContainerRef.current;
        if (!container) return;

        const nextIndex = (centerIndex + 1) % bestSellers.length;
        const targetElement = itemRefs.current[nextIndex];
        
        if (targetElement) {
          const containerRect = container.getBoundingClientRect();
          const elementRect = targetElement.getBoundingClientRect();
          const scrollLeft = container.scrollLeft + elementRect.left - containerRect.left - (containerRect.width - elementRect.width) / 2;
          
          container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
          });
        }
      }
    }, 1000);
  }, [centerIndex, bestSellers.length]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  const handleUserInteraction = useCallback(() => {
    userInteractionRef.current = true;
    lastUserInteractionRef.current = Date.now();
    stopAutoScroll();
    
    setTimeout(() => {
      if (Date.now() - lastUserInteractionRef.current >= 3000) {
        userInteractionRef.current = false;
        startAutoScroll();
      }
    }, 3000);
  }, [startAutoScroll, stopAutoScroll]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('touchstart', handleUserInteraction, { passive: true });
    container.addEventListener('mousedown', handleUserInteraction, { passive: true });
    
    setTimeout(updateCenterItem, 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchstart', handleUserInteraction);
      container.removeEventListener('mousedown', handleUserInteraction);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll, updateCenterItem, handleUserInteraction]);

  useEffect(() => {
    if (bestSellers.length > 0 && !loading) {
      const timer = setTimeout(() => {
        startAutoScroll();
      }, 2000);
      
      return () => {
        clearTimeout(timer);
        stopAutoScroll();
      };
    }
  }, [bestSellers.length, loading, startAutoScroll, stopAutoScroll]);

  useEffect(() => {
    return () => {
      stopAutoScroll();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [stopAutoScroll]);

  const handleItemClick = useCallback((itemId) => {
    handleUserInteraction();
    navigate(`/product/${itemId}`);
  }, [navigate, handleUserInteraction]);

  const getBaseUrl = () => import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading best sellers...</p>
      </div>
    );
  }

  if (bestSellers.length === 0) {
    return null;
  }

  return (
    <>
      <style>{cssStyles}</style>
      <div style={styles.bestSellersSection}>
        <div style={styles.bestSellersHeader}>
          <div style={styles.titleContainer}>
            <Star size={20} style={styles.starIcon} />
            <h2 style={styles.bestSellersTitle}>Best Sellers</h2>
          </div>
          <div style={styles.indicatorContainer}>
            {bestSellers.map((_, index) => (
              <div
                key={index}
                style={{
                  ...styles.indicator,
                  ...(centerIndex === index ? styles.activeIndicator : {}),
                }}
              />
            ))}
          </div>
        </div>
        
        <div 
          style={styles.bestSellersScrollContainer}
          ref={scrollContainerRef} 
          className="best-sellers-scroll"
        >
          <div style={styles.bestSellersGrid}>
            {bestSellers.map((item, index) => (
              <div
                key={item.id}
                ref={(el) => (itemRefs.current[index] = el)}
                style={{
                  ...styles.bestSellerItem,
                  transform: centerIndex === index ? 'scale(1.08)' : 'scale(1)',
                  zIndex: centerIndex === index ? 10 : 1,
                }}
                className="best-seller-item"
                onClick={() => handleItemClick(item.id)}
              >
                <div 
                  style={{
                    ...styles.bestSellerCard,
                    ...(centerIndex === index ? styles.centerItemCard : {}),
                  }}
                >
                  <div 
                    style={{
                      ...styles.bestSellerImageContainer,
                      ...(centerIndex === index ? styles.centerItemImageContainer : {}),
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={`${getBaseUrl()}${item.image_url}`}
                        srcSet={`
                          ${getBaseUrl()}${item.image_url}?w=120 1x,
                          ${getBaseUrl()}${item.image_url}?w=240 2x
                        `}
                        alt={item.name}
                        style={styles.bestSellerImage}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div style={styles.bestSellerPlaceholder}>
                        <Coffee size={centerIndex === index ? 36 : 32} color="#F97316" />
                      </div>
                    )}
                    {centerIndex === index && (
                      <div style={styles.highlightBadge}>
                        <Star size={12} fill="#FBBF24" color="#FBBF24" />
                      </div>
                    )}
                  </div>
                  
                  <div style={styles.itemInfo}>
                    <h3 
                      style={{
                        ...styles.bestSellerName,
                        ...(centerIndex === index ? styles.centerItemName : {}),
                      }}
                    >
                      {item.name}
                    </h3>
                    <div
                      style={{
                        ...styles.priceContainer,
                        ...(centerIndex === index ? styles.centerItemPriceContainer : {}),
                      }}
                    >
                      <span style={styles.currency}>$</span>
                      <span style={styles.price}>
                        {parseFloat(item.sale_price || item.regular_price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  bestSellersSection: {
    marginBottom: '40px',
    width: '100%',
    boxSizing: 'border-box',
    paddingTop: '12px',
  },
  bestSellersHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingLeft: '24px',
    paddingRight: '24px',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  starIcon: {
    color: '#F97316',
    filter: 'drop-shadow(0 1px 3px rgba(249, 115, 22, 0.4))',
  },
  bestSellersTitle: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#1F2937',
    margin: 0,
    letterSpacing: '-0.5px',
    lineHeight: '1.2',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  indicatorContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  indicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#D1D5DB',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  activeIndicator: {
    backgroundColor: '#F97316',
    transform: 'scale(1.3)',
    boxShadow: '0 0 10px rgba(249, 115, 22, 0.5)',
  },
  bestSellersScrollContainer: {
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    paddingTop: '12px',
    paddingBottom: '28px',
    paddingLeft: '24px',
    paddingRight: '24px',
    width: '100%',
    boxSizing: 'border-box',
  },
  bestSellersGrid: {
    display: 'flex',
    gap: '20px',
    minWidth: 'fit-content',
    alignItems: 'flex-start',
    paddingBottom: '12px',
  },
  bestSellerItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    minWidth: '130px',
    maxWidth: '150px',
    flex: '0 0 auto',
    transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    scrollSnapAlign: 'center',
    willChange: 'transform',
  },
  bestSellerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    padding: '18px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
  },
  centerItemCard: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 10px 36px rgba(249, 115, 22, 0.2), 0 6px 18px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(249, 115, 22, 0.15)',
    transform: 'translateY(-6px)',
  },
  bestSellerImageContainer: {
    width: '76px',
    height: '76px',
    borderRadius: '18px',
    backgroundColor: '#FFF7ED',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px',
    overflow: 'hidden',
    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    flexShrink: 0,
    position: 'relative',
  },
  centerItemImageContainer: {
    width: '84px',
    height: '84px',
    borderRadius: '20px',
    backgroundColor: '#FFF7ED',
    boxShadow: '0 6px 20px rgba(249, 115, 22, 0.25)',
  },
  bestSellerImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '18px',
  },
  bestSellerPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: '18px',
  },
  highlightBadge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '24px',
    height: '24px',
    backgroundColor: '#FFFFFF',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
  },
  bestSellerName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    margin: 0,
    lineHeight: '1.4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%',
    maxWidth: '110px',
  },
  centerItemName: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#F97316',
    maxWidth: '120px',
  },
  priceContainer: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: '10px',
    padding: '6px 10px',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: '60px',
  },
  centerItemPriceContainer: {
    backgroundColor: '#F97316',
    transform: 'scale(1.08)',
    boxShadow: '0 3px 10px rgba(249, 115, 22, 0.4)',
  },
  currency: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6B7280',
    transition: 'color 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  price: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1F2937',
    transition: 'color 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  loadingContainer: {
    padding: '56px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: '20px',
    margin: '0 24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(249, 115, 22, 0.2)',
    borderTop: '3px solid #F97316',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    marginBottom: '20px',
  },
  loadingText: {
    fontSize: '16px',
    color: '#6B7280',
    fontWeight: '500',
    margin: 0,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};

const cssStyles = `
  .best-sellers-scroll::-webkit-scrollbar {
    display: none;
  }

  .best-sellers-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  .best-seller-item {
    will-change: transform;
  }

  .best-seller-item:active {
    transform: scale(0.95) !important;
    transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .best-seller-item .center-item-price-container .currency,
  .best-seller-item .center-item-price-container .price {
    color: #FFFFFF !important;
  }

  @media (max-width: 480px) {
    .best-sellers-scroll {
      padding-left: 20px !important;
      padding-right: 20px !important;
    }
    
    .best-seller-item {
      min-width: 120px !important;
      max-width: 140px !important;
    }
  }

  @media (max-width: 375px) {
    .best-sellers-scroll {
      padding-left: 16px !important;
      padding-right: 16px !important;
    }
    
    .best-seller-item {
      min-width: 110px !important;
      max-width: 130px !important;
    }
  }

  @media (max-width: 320px) {
    .best-sellers-scroll {
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
    
    .best-seller-item {
      min-width: 100px !important;
      max-width: 120px !important;
    }
  }

  @media (min-width: 768px) {
    .best-seller-item {
      min-width: 150px !important;
      max-width: 170px !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .best-seller-item {
      transition: none;
    }
    
    .best-sellers-scroll {
      scroll-behavior: auto;
    }
    
    .indicator {
      transition: none;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .best-seller-item {
    transform-style: preserve-3d;
    backface-visibility: hidden;
  }

  @media (hover: hover) {
    .best-seller-item:hover {
      transform: scale(1.03) translateY(-3px);
    }
    
    .best-seller-item:hover .best-seller-card {
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.15);
    }
  }
`;

export default BestSellers;
