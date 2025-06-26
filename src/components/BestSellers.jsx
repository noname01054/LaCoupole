import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { Coffee } from 'lucide-react';

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
          <h2 style={styles.bestSellersTitle}>Best Sellers</h2>
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
                  transform: centerIndex === index ? 'scale(1.15)' : 'scale(1)',
                  zIndex: centerIndex === index ? 10 : 1,
                }}
                className="best-seller-item"
                onClick={() => handleItemClick(item.id)}
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
                      <Coffee size={centerIndex === index ? 32 : 24} color="#8e8e93" />
                    </div>
                  )}
                </div>
                <div 
                  style={{
                    ...styles.itemLabel,
                    ...(centerIndex === index ? styles.centerItemLabel : {}),
                  }}
                >
                  <p 
                    style={{
                      ...styles.bestSellerName,
                      ...(centerIndex === index ? styles.centerItemName : {}),
                    }}
                  >
                    {item.name}
                  </p>
                  <p
                    style={{
                      ...styles.bestSellerPrice,
                      ...(centerIndex === index ? styles.centerItemPrice : {}),
                    }}
                  >
                    ${parseFloat(item.sale_price || item.regular_price).toFixed(2)}
                  </p>
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
    marginBottom: '24px',
    width: '100%',
    boxSizing: 'border-box',
  },
  bestSellersHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingLeft: '16px',
    paddingRight: '16px',
  },
  bestSellersTitle: {
    fontSize: '20px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #ff8c42 0%, #ff6b35 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  bestSellersScrollContainer: {
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    paddingTop: '20px',
    paddingBottom: '30px',
    paddingLeft: '16px',
    paddingRight: '16px',
    width: '100%',
    boxSizing: 'border-box',
  },
  bestSellersGrid: {
    display: 'flex',
    gap: '16px',
    minWidth: 'fit-content',
    alignItems: 'flex-start',
    paddingBottom: '8px',
  },
  bestSellerItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    minWidth: '90px',
    maxWidth: '110px',
    flex: '0 0 auto',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    scrollSnapAlign: 'center',
    willChange: 'transform',
  },
  bestSellerImageContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10px',
    overflow: 'hidden',
    border: '3px solid #f0f0f0',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    flexShrink: 0,
  },
  centerItemImageContainer: {
    width: '90px',
    height: '90px',
    border: '4px solid #ff8c42',
    boxShadow: '0 8px 24px rgba(255, 140, 66, 0.3)',
  },
  bestSellerImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  bestSellerPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
  },
  itemLabel: {
    backgroundColor: '#ff8c42',
    padding: '6px 10px',
    borderRadius: '14px',
    minWidth: '50px',
    maxWidth: '100px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    flexShrink: 0,
  },
  centerItemLabel: {
    backgroundColor: '#ff6b35',
    padding: '8px 12px',
    borderRadius: '16px',
    transform: 'translateY(-2px)',
    maxWidth: '110px',
  },
  bestSellerName: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    margin: 0,
    lineHeight: '1.2',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%',
  },
  centerItemName: {
    fontSize: '12px',
    fontWeight: '700',
  },
  bestSellerPrice: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    margin: '2px 0 0 0',
    lineHeight: '1.2',
    transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%',
  },
  centerItemPrice: {
    fontSize: '11px',
    fontWeight: '700',
  },
  loadingContainer: {
    padding: '40px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255, 140, 66, 0.2)',
    borderTop: '3px solid #ff8c42',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    fontSize: '14px',
    color: '#8e8e93',
    margin: 0,
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
  }

  @media (max-width: 480px) {
    .best-sellers-scroll {
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
    
    .best-seller-item {
      min-width: 85px !important;
      max-width: 95px !important;
    }
  }

  @media (max-width: 375px) {
    .best-sellers-scroll {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }
    
    .best-seller-item {
      min-width: 80px !important;
      max-width: 90px !important;
    }
  }

  @media (max-width: 320px) {
    .best-sellers-scroll {
      padding-left: 8px !important;
      padding-right: 8px !important;
    }
    
    .best-seller-item {
      min-width: 75px !important;
      max-width: 85px !important;
    }
  }

  @media (min-width: 768px) {
    .best-seller-item {
      min-width: 100px !important;
      max-width: 120px !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .best-seller-item {
      transition: none;
    }
    
    .best-sellers-scroll {
      scroll-behavior: auto;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .best-seller-item {
    transform-style: preserve-3d;
    backface-visibility: hidden;
  }
`;

export default BestSellers;
