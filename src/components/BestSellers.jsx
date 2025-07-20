import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const lastScrollTime = useRef(0);

  useEffect(() => {
    const fetchBestSellersAndTheme = async () => {
      try {
        setLoading(true);
        const [bestSellersResponse, themeResponse] = await Promise.all([
          api.get('/menu-items/best-sellers'),
          api.getTheme()
        ]);
        setBestSellers(bestSellersResponse.data?.slice(0, 8) || []);
        const updatedTheme = themeResponse.data || theme;
        setTheme(updatedTheme);
        applyTheme(updatedTheme);
      } catch (error) {
        console.error('Error fetching best sellers or theme:', error);
        toast.error(error.response?.data?.error || 'Failed to load best sellers or theme');
      } finally {
        setLoading(false);
      }
    };
    fetchBestSellersAndTheme();
  }, []);

  const applyTheme = useCallback((themeData) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', themeData.primary_color || '#ff6b35');
    root.style.setProperty('--secondary-color', themeData.secondary_color || '#ff8c42');
    root.style.setProperty('--background-color', themeData.background_color || '#faf8f5');
    root.style.setProperty('--text-color', themeData.text_color || '#1f2937');
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
    const now = performance.now();
    if (now - lastScrollTime.current < 16) return; // Throttle to ~60fps
    lastScrollTime.current = now;

    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
    }

    userInteractionRef.current = true;
    lastUserInteractionRef.current = now;

    requestAnimationFrame(() => {
      updateCenterItem();

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
        setTimeout(() => {
          userInteractionRef.current = false;
        }, 2000);
      }, 100);
    });
  }, [updateCenterItem]);

  const startAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current || bestSellers.length <= 1) return;

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

          requestAnimationFrame(() => {
            container.scrollTo({
              left: scrollLeft,
              behavior: 'auto', // Changed to auto for performance
            });
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
      const timer = setTimeout(startAutoScroll, 2000);
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

  const bestSellerItems = useMemo(() => {
    return bestSellers.map((item, index) => (
      <div
        key={item.id}
        ref={(el) => (itemRefs.current[index] = el)}
        style={{
          ...styles.bestSellerItem,
          transform: centerIndex === index ? 'scale(1.15)' : 'scale(1)',
          zIndex: centerIndex === index ? 10 : 1,
        }}
        className="best-sellers-item"
        onClick={() => handleItemClick(item.id)}
      >
        <div 
          style={{
            ...styles.bestSellerCard,
            ...(centerIndex === index ? { ...styles.centerItemCard, borderColor: theme.primary_color || '#ff6b35' } : {}),
            backgroundColor: (theme.background_color === '#ffffff' ? '#f0f0f0' : theme.background_color) || '#faf8f5',
          }}
        >
          <div 
            style={{
              ...styles.bestSellerImageContainer,
              ...(centerIndex === index ? styles.centerItemImageContainer : {}),
              backgroundColor: (theme.background_color === '#ffffff' ? '#f0f0f0' : theme.background_color) || '#faf8f5',
            }}
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                style={styles.bestSellerImage}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  console.error('Error loading best seller image:', item.image_url);
                  e.target.src = '/placeholder.jpg';
                }}
              />
            ) : (
              <div style={{ ...styles.bestSellerPlaceholder, backgroundColor: (theme.background_color === '#ffffff' ? '#f0f0f0' : theme.background_color) || '#faf8f5' }}>
                <Coffee size={centerIndex === index ? 36 : 32} color={theme.primary_color || '#ff6b35'} />
              </div>
            )}
            {centerIndex === index && (
              <div style={{ ...styles.highlightBadge, borderColor: theme.secondary_color || '#ff8c42' }}>
                <Star size={12} fill={theme.secondary_color || '#ff8c42'} color={theme.secondary_color || '#ff8c42'} />
              </div>
            )}
          </div>
          
          <div style={styles.itemInfo}>
            <h3 
              style={{
                ...styles.bestSellerName,
                ...(centerIndex === index ? { ...styles.centerItemName, color: (theme.background_color === '#ffffff' ? theme.primary_color : theme.text_color) || '#1f2937' } : { color: (theme.background_color === '#ffffff' ? theme.primary_color : theme.text_color) || '#1f2937' }),
              }}
            >
              {item.name}
            </h3>
            <div
              style={{
                ...styles.priceContainer,
                ...(centerIndex === index ? { ...styles.centerItemPriceContainer, backgroundColor: theme.primary_color || '#ff6b35' } : { backgroundColor: (theme.background_color === '#ffffff' ? '#f0f0f0' : theme.background_color) || '#faf8f5' }),
              }}
            >
              <span style={{ ...styles.currency, color: centerIndex === index ? '#FFFFFF' : ((theme.background_color === '#ffffff' ? theme.primary_color : theme.text_color) || '#1f2937') }}>$</span>
              <span style={{ ...styles.price, color: centerIndex === index ? '#FFFFFF' : ((theme.background_color === '#ffffff' ? theme.primary_color : theme.text_color) || '#1f2937') }}>
                {parseFloat(item.sale_price || item.regular_price).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    ));
  }, [bestSellers, centerIndex, theme, handleItemClick]);

  if (loading) {
    return (
      <div style={{ ...styles.loadingContainer, backgroundColor: theme.background_color || '#faf8f5' }}>
        <div style={{ ...styles.loadingSpinner, borderTopColor: theme.primary_color || '#ff6b35' }}></div>
        <p style={{ ...styles.loadingText, color: theme.text_color || '#1f2937' }}>Loading best sellers...</p>
      </div>
    );
  }

  if (bestSellers.length === 0) {
    return null;
  }

  return (
    <>
      <style>{cssStyles(theme)}</style>
      <div style={{ ...styles.bestSellersSection, backgroundColor: theme.background_color || '#faf8f5' }}>
        <div style={styles.bestSellersHeader}>
          <div style={styles.titleContainer}>
            <Star size={20} style={{ ...styles.starIcon, color: theme.primary_color || '#ff6b35' }} />
            <h2 style={{ ...styles.bestSellersTitle, color: theme.primary_color || '#ff6b35' }}>Best Sellers</h2>
          </div>
          <div style={styles.indicatorContainer}>
            {bestSellers.map((_, index) => (
              <div
                key={index}
                style={{
                  ...styles.indicator,
                  ...(centerIndex === index ? { ...styles.activeIndicator, backgroundColor: theme.primary_color || '#ff6b35' } : {}),
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
            {bestSellerItems}
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
    paddingTop: '8px',
  },
  bestSellersHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingLeft: '12px',
    paddingRight: '12px',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  starIcon: {
    filter: 'none',
  },
  bestSellersTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0,
    letterSpacing: '0',
    lineHeight: '1.2',
    fontFamily: "'Inter', sans-serif",
  },
  indicatorContainer: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  indicator: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#D1D5DB',
    transition: 'background-color 0.15s ease',
  },
  activeIndicator: {
    transform: 'scale(1.2)',
    boxShadow: 'none',
  },
  bestSellersScrollContainer: {
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    paddingTop: '20px',
    paddingBottom: '30px',
    paddingLeft: '0',
    paddingRight: '0',
    width: '100%',
    boxSizing: 'border-box',
  },
  bestSellersGrid: {
    display: 'flex',
    gap: '12px',
    minWidth: 'fit-content',
    alignItems: 'flex-start',
    paddingBottom: '8px',
    paddingLeft: 'calc(50% - 60px)',
    paddingRight: 'calc(50% - 60px)',
  },
  bestSellerItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    minWidth: '100px',
    maxWidth: '120px',
    flex: '0 0 auto',
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    scrollSnapAlign: 'center',
    willChange: 'transform',
  },
  bestSellerCard: {
    width: '100%',
    borderRadius: '12px',
    padding: '8px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    transition: 'all 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    opacity: 1,
  },
  centerItemCard: {
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.08)',
    transform: 'translateY(-2px)',
  },
  bestSellerImageContainer: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
    overflow: 'hidden',
    transition: 'all 0.15s ease',
    flexShrink: 0,
    position: 'relative',
  },
  centerItemImageContainer: {
    width: '60px',
    height: '60px',
    borderRadius: '12px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
  },
  bestSellerImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '10px',
  },
  bestSellerPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
  },
  highlightBadge: {
    position: 'absolute',
    top: '-3px',
    right: '-3px',
    width: '16px',
    height: '16px',
    backgroundColor: '#FFFFFF',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    width: '100%',
  },
  bestSellerName: {
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'center',
    margin: 0,
    lineHeight: '1.2',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s ease',
    width: '100%',
    maxWidth: '90px',
  },
  centerItemName: {
    fontSize: '14px',
    fontWeight: '600',
    maxWidth: '100px',
  },
  priceContainer: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    borderRadius: '6px',
    padding: '3px 6px',
    transition: 'all 0.15s ease',
    minWidth: '40px',
  },
  centerItemPriceContainer: {
    transform: 'scale(1.05)',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
  },
  currency: {
    fontSize: '10px',
    fontWeight: '600',
    transition: 'color 0.15s ease',
  },
  price: {
    fontSize: '13px',
    fontWeight: '600',
    transition: 'color 0.15s ease',
  },
  loadingContainer: {
    padding: '24px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    margin: '0 12px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    opacity: 1,
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(0, 0, 0, 0.2)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '13px',
    fontWeight: '500',
    margin: 0,
    fontFamily: "'Inter', sans-serif",
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
    scroll-behavior: auto;
    overscroll-behavior-x: contain;
  }

  .best-sellers-item {
    will-change: transform;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    opacity: 1;
  }

  .best-sellers-item:active {
    transform: scale(0.95) !important;
  }

  @media (max-width: 480px) {
    .best-sellers-scroll {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    
    .best-sellers-item {
      min-width: 90px !important;
      max-width: 110px !important;
    }
  }

  @media (max-width: 375px) {
    .best-sellers-scroll {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    
    .best-sellers-item {
      min-width: 80px !important;
      max-width: 100px !important;
    }
  }

  @media (max-width: 320px) {
    .best-sellers-scroll {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    
    .best-sellers-item {
      min-width: 70px !important;
      max-width: 90px !important;
    }
  }

  @media (min-width: 768px) {
    .best-sellers-item {
      min-width: 110px !important;
      max-width: 130px !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .best-sellers-item,
    .best-seller-card,
    .best-sellers-price-container {
      transition: none !important;
    }
    
    .best-sellers-scroll {
      scroll-behavior: auto !important;
    }
    
    .best-sellers-indicator {
      transition: none !important;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export default BestSellers;
