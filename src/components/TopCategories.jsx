import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { Coffee } from 'lucide-react';

function TopCategories() {
  const [topCategories, setTopCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerIndex, setCenterIndex] = useState(0);
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const categoryRefs = useRef([]);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const userInteractionRef = useRef(false);
  const lastUserInteractionRef = useRef(Date.now());

  useEffect(() => {
    const fetchTopCategories = async () => {
      try {
        setLoading(true);
        const response = await api.getTopCategories();
        setTopCategories(response.data || []);
      } catch (error) {
        console.error('Error fetching top categories:', error);
        toast.error(error.response?.data?.error || 'Failed to load top categories');
      } finally {
        setLoading(false);
      }
    };
    fetchTopCategories();
  }, []);

  const updateCenterCategory = useCallback(() => {
    if (!scrollContainerRef.current || topCategories.length === 0) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    categoryRefs.current.forEach((ref, index) => {
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
  }, [topCategories.length]);

  const handleScroll = useCallback(() => {
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
    }

    // Mark user interaction
    userInteractionRef.current = true;
    lastUserInteractionRef.current = Date.now();

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    updateCenterCategory();

    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      // Reset user interaction after scroll ends
      setTimeout(() => {
        userInteractionRef.current = false;
      }, 2000); // Wait 2 seconds after scroll ends before resuming auto-scroll
    }, 150);
  }, [updateCenterCategory]);

  // Auto-scroll functionality
  const startAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }

    autoScrollIntervalRef.current = setInterval(() => {
      if (!userInteractionRef.current && !isScrollingRef.current && topCategories.length > 0) {
        const container = scrollContainerRef.current;
        if (!container) return;

        const nextIndex = (centerIndex + 1) % topCategories.length;
        const targetElement = categoryRefs.current[nextIndex];
        
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
    }, 1000); // Auto-scroll every 1 second
  }, [centerIndex, topCategories.length]);

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
    
    // Resume auto-scroll after 3 seconds of no interaction
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
    
    setTimeout(updateCenterCategory, 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchstart', handleUserInteraction);
      container.removeEventListener('mousedown', handleUserInteraction);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll, updateCenterCategory, handleUserInteraction]);

  // Start auto-scroll when categories are loaded
  useEffect(() => {
    if (topCategories.length > 0 && !loading) {
      // Start auto-scroll after a brief delay
      const timer = setTimeout(() => {
        startAutoScroll();
      }, 2000);
      
      return () => {
        clearTimeout(timer);
        stopAutoScroll();
      };
    }
  }, [topCategories.length, loading, startAutoScroll, stopAutoScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoScroll();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [stopAutoScroll]);

  const handleCategoryClick = useCallback((categoryId) => {
    handleUserInteraction(); // Stop auto-scroll on click
    navigate(`/category/${categoryId}`);
  }, [navigate, handleUserInteraction]);

  const getBaseUrl = () => import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading top categories...</p>
      </div>
    );
  }

  if (topCategories.length === 0) {
    return null;
  }

  return (
    <>
      <style>{cssStyles}</style>
      <div style={styles.topCategoriesSection}>
        <div style={styles.topCategoriesHeader}>
          <h2 style={styles.topCategoriesTitle}>Top Categories</h2>
        </div>
        <div 
          style={styles.topCategoriesScrollContainer}
          ref={scrollContainerRef} 
          className="top-categories-scroll"
        >
          <div style={styles.topCategoriesGrid}>
            {topCategories.map((category, index) => (
              <div
                key={category.id}
                ref={(el) => (categoryRefs.current[index] = el)}
                style={{
                  ...styles.topCategoryItem,
                  transform: centerIndex === index ? 'scale(1.15)' : 'scale(1)',
                  zIndex: centerIndex === index ? 10 : 1,
                }}
                className="top-category-item"
                onClick={() => handleCategoryClick(category.id)}
              >
                <div 
                  style={{
                    ...styles.topCategoryImageContainer,
                    ...(centerIndex === index ? styles.centerCategoryImageContainer : {}),
                  }}
                >
                  {category.image_url ? (
                    <img
                      src={`${getBaseUrl()}${category.image_url}`}
                      srcSet={`
                        ${getBaseUrl()}${category.image_url}?w=120 1x,
                        ${getBaseUrl()}${category.image_url}?w=240 2x
                      `}
                      alt={category.name}
                      style={styles.topCategoryImage}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div style={styles.topCategoryPlaceholder}>
                      <Coffee size={centerIndex === index ? 32 : 24} color="#8e8e93" />
                    </div>
                  )}
                </div>
                <div 
                  style={{
                    ...styles.categoryLabel,
                    ...(centerIndex === index ? styles.centerCategoryLabel : {}),
                  }}
                >
                  <p 
                    style={{
                      ...styles.topCategoryName,
                      ...(centerIndex === index ? styles.centerCategoryName : {}),
                    }}
                  >
                    {category.name}
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
  topCategoriesSection: {
    marginBottom: '24px',
    width: '100%',
    boxSizing: 'border-box',
  },
  topCategoriesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingLeft: '16px',
    paddingRight: '16px',
  },
  topCategoriesTitle: {
    fontSize: '20px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #ff8c42 0%, #ff6b35 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  topCategoriesScrollContainer: {
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
  topCategoriesGrid: {
    display: 'flex',
    gap: '16px',
    minWidth: 'fit-content',
    alignItems: 'flex-start',
    paddingBottom: '8px',
  },
  topCategoryItem: {
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
  topCategoryImageContainer: {
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
  centerCategoryImageContainer: {
    width: '90px',
    height: '90px',
    border: '4px solid #ff8c42',
    boxShadow: '0 8px 24px rgba(255, 140, 66, 0.3)',
  },
  topCategoryImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  topCategoryPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
  },
  categoryLabel: {
    backgroundColor: '#ff8c42',
    padding: '6px 10px',
    borderRadius: '14px',
    minWidth: '50px',
    maxWidth: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    flexShrink: 0,
  },
  centerCategoryLabel: {
    backgroundColor: '#ff6b35',
    padding: '8px 12px',
    borderRadius: '16px',
    transform: 'translateY(-2px)',
    maxWidth: '110px',
  },
  topCategoryName: {
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
  centerCategoryName: {
    fontSize: '12px',
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
  .top-categories-scroll::-webkit-scrollbar {
    display: none;
  }

  .top-categories-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  .top-category-item {
    will-change: transform;
  }

  .top-category-item:active {
    transform: scale(0.95) !important;
  }

  /* Mobile-first responsive design */
  @media (max-width: 480px) {
    .top-categories-scroll {
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
    
    .top-category-item {
      min-width: 85px !important;
      max-width: 95px !important;
    }
  }

  @media (max-width: 375px) {
    .top-categories-scroll {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }
    
    .top-category-item {
      min-width: 80px !important;
      max-width: 90px !important;
    }
  }

  /* Small mobile devices */
  @media (max-width: 320px) {
    .top-categories-scroll {
      padding-left: 8px !important;
      padding-right: 8px !important;
    }
    
    .top-category-item {
      min-width: 75px !important;
      max-width: 85px !important;
    }
  }

  /* Tablet and larger screens */
  @media (min-width: 768px) {
    .top-category-item {
      min-width: 100px !important;
      max-width: 120px !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .top-category-item {
      transition: none;
    }
    
    .top-categories-scroll {
      scroll-behavior: auto;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .top-category-item {
    transform-style: preserve-3d;
    backface-visibility: hidden;
  }
`;

export default TopCategories;