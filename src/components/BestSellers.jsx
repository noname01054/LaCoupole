import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { Coffee, Star } from 'lucide-react';

function BestSellers({ addToCart }) {
  const [bestSellers, setBestSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerIndex, setCenterIndex] = useState(0);
  const [theme, setTheme] = useState({
    primary_color: '#ff6b35',
    secondary_color: '#ff8c42',
    background_color: '#faf8f5',
    text_color: '#1f2937',
  });
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const itemRefs = useRef([]);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const userInteractionRef = useRef(false);
  const lastUserInteractionRef = useRef(Date.now());

  useEffect(() => {
    const fetchBestSellersAndTheme = async () => {
      try {
        setLoading(true);
        const [bestSellersResponse, themeResponse] = await Promise.all([
          api.get('/menu-items/best-sellers'),
          api.getTheme()
        ]);
        setBestSellers(bestSellersResponse.data || []);
        const updatedTheme = themeResponse.data || theme;
        setTheme(updatedTheme);
        applyTheme(updatedTheme); // Apply theme immediately
      } catch (error) {
        console.error('Error fetching best sellers or theme:', error);
        toast.error(error.response?.data?.error || 'Failed to load best sellers or theme');
      } finally {
        setLoading(false);
      }
    };
    fetchBestSellersAndTheme();
  }, []);

  const applyTheme = (themeData) => {
    document.documentElement.style.setProperty('--primary-color', themeData.primary_color);
    document.documentElement.style.setProperty('--secondary-color', themeData.secondary_color);
    document.documentElement.style.setProperty('--background-color', themeData.background_color);
    document.documentElement.style.setProperty('--text-color', themeData.text_color);
  };

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
          const scrollLeft = elementRect.left - containerRect.left + container.scrollLeft - (containerRect.width - elementRect.width) / 2;

          container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth',
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
      <div style={{ ...styles.loadingContainer, backgroundColor: theme.background_color }}>
        <div style={{ ...styles.loadingSpinner, borderTopColor: theme.primary_color }}></div>
        <p style={{ ...styles.loadingText, color: theme.text_color }}>Loading best sellers...</p>
      </div>
    );
  }

  if (bestSellers.length === 0) {
    return null;
  }

  return (
    <>
      <style>{cssStyles(theme)}</style>
      <div style={{ ...styles.bestSellersSection, backgroundColor: theme.background_color }}>
        <div style={styles.bestSellersHeader}>
          <div style={styles.titleContainer}>
            <Star size={20} style={{ ...styles.starIcon, color: theme.primary_color }} />
            <h2 style={{ ...styles.bestSellersTitle, color: theme.primary_color }}>Best Sellers</h2>
          </div>
          <div style={styles.indicatorContainer}>
            {bestSellers.map((_, index) => (
              <div
                key={index}
                style={{
                  ...styles.indicator,
                  ...(centerIndex === index ? { ...styles.activeIndicator, backgroundColor: theme.primary_color } : {}),
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
                    ...(centerIndex === index ? { ...styles.centerItemCard, borderColor: theme.primary_color } : {}),
                    backgroundColor: theme.background_color === '#ffffff' ? '#f0f0f0' : theme.background_color,
                  }}
                >
                  <div 
                    style={{
                      ...styles.bestSellerImageContainer,
                      ...(centerIndex === index ? styles.centerItemImageContainer : {}),
                      backgroundColor: theme.background_color === '#ffffff' ? '#f0f0f0' : theme.background_color,
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
                      <div style={{ ...styles.bestSellerPlaceholder, backgroundColor: theme.background_color === '#ffffff' ? '#f0f0f0' : theme.background_color }}>
                        <Coffee size={centerIndex === index ? 36 : 32} color={theme.primary_color} />
                      </div>
                    )}
                    {centerIndex === index && (
                      <div style={{ ...styles.highlightBadge, borderColor: theme.secondary_color }}>
                        <Star size={12} fill={theme.secondary_color} color={theme.secondary_color} />
                      </div>
                    )}
                  </div>
                  
                  <div style={styles.itemInfo}>
                    <h3 
                      style={{
                        ...styles.bestSellerName,
                        ...(centerIndex === index ? { ...styles.centerItemName, color: theme.background_color === '#ffffff' ? theme.primary_color : theme.text_color } : { color: theme.background_color === '#ffffff' ? theme.primary_color : theme.text_color }),
                      }}
                    >
                      {item.name}
                    </h3>
                    <div
                      style={{
                        ...styles.priceContainer,
                        ...(centerIndex === index ? { ...styles.centerItemPriceContainer, backgroundColor: theme.primary_color } : { backgroundColor: theme.background_color === '#ffffff' ? '#f0f0f0' : theme.background_color }),
                      }}
                    >
                      <span style={{ ...styles.currency, color: centerIndex === index ? '#FFFFFF' : (theme.background_color === '#ffffff' ? theme.primary_color : theme.text_color) }}>$</span>
                      <span style={{ ...styles.price, color: centerIndex === index ? '#FFFFFF' : (theme.background_color === '#ffffff' ? theme.primary_color : theme.text_color) }}>
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
    filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4))',
  },
  bestSellersTitle: {
    fontSize: '26px',
    fontWeight: '700',
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
    transform: 'scale(1.3)',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
  },
  bestSellersScrollContainer: {
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    paddingTop: '30px',
    paddingBottom: '30px', // Increased height by adding more paddingBottom
    paddingLeft: '0',
    paddingRight: '0',
    width: '100%',
    boxSizing: 'border-box',
  },
  bestSellersGrid: {
    display: 'flex',
    gap: '20px',
    minWidth: 'fit-content',
    alignItems: 'flex-start',
    paddingBottom: '12px',
    paddingLeft: 'calc(50% - 75px)',
    paddingRight: 'calc(50% - 75px)',
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
    borderRadius: '20px',
    padding: '18px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
  },
  centerItemCard: {
    boxShadow: '0 10px 36px rgba(0, 0, 0, 0.2), 0 6px 18px rgba(0, 0, 0, 0.1)',
    transform: 'translateY(-6px)',
  },
  bestSellerImageContainer: {
    width: '50px',
    height: '50px',
    borderRadius: '18px',
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
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
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
    textAlign: 'center',
    margin: 0,
    lineHeight: '1.4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100',
    maxWidth: '110px',
  },
  centerItemName: {
    fontSize: '16px',
    fontWeight: '700',
    maxWidth: '120px',
  },
  priceContainer: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    borderRadius: '10px',
    padding: '6px 10px',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: '60px',
  },
  centerItemPriceContainer: {
    transform: 'scale(1.08)',
    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.4)',
  },
  currency: {
    fontSize: '12px',
    fontWeight: '600',
    transition: 'color 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  price: {
    fontSize: '15px',
    fontWeight: '700',
    transition: 'color 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  loadingContainer: {
    padding: '56px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '20px',
    margin: '0 24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(0, 0, 0, 0.2)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    marginBottom: '20px',
  },
  loadingText: {
    fontSize: '16px',
    fontWeight: '500',
    margin: 0,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};

const cssStyles = (theme) => `
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
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    
    .best-seller-item {
      min-width: 120px !important;
      max-width: 140px !important;
    }
  }

  @media (max-width: 375px) {
    .best-sellers-scroll {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    
    .best-seller-item {
      min-width: 110px !important;
      max-width: 130px !important;
    }
  }

  @media (max-width: 320px) {
    .best-sellers-scroll {
      padding-left: 0 !important;
      padding-right: 0 !important;
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
