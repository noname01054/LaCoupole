import { api } from '../services/api';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import { debounce } from 'lodash';

function MenuItemCard({ item, onAddToCart, onView }) {
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [supplements, setSupplements] = useState({ options: [], optionGroups: [] });
  const [selectedOptions, setSelectedOptions] = useState({});
  const [showOptionPopup, setShowOptionPopup] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const isMobile = screenSize.width <= 768;
  const isSmallMobile = screenSize.width <= 375;

  const handleResize = useCallback(
    debounce(() => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }, 100),
    []
  );

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (!item?.id) return;
    const fetchData = async () => {
      try {
        let data = { options: [], optionGroups: [] };
        if (item.type === 'breakfast') {
          const [optionsResponse, groupsResponse] = await Promise.all([
            api.getBreakfastOptions(item.id),
            api.getBreakfastOptionGroups(item.id),
          ]);
          data = {
            options: optionsResponse.data || [],
            optionGroups: groupsResponse.data || [],
          };
        } else {
          const response = await api.getSupplementsByMenuItem(item.id);
          data = {
            options: response.data || [],
            optionGroups: [],
          };
        }
        setSupplements(data);
      } catch (err) {
        console.error(`Failed to load ${item.type === 'breakfast' ? 'options' : 'supplements'} for item ${item.id}:`, err);
        setSupplements({ options: [], optionGroups: [] });
      }
    };
    fetchData();
  }, [item?.id, item?.type]);

  const imageSrc = useMemo(() => {
    return item?.image_url &&
      item.image_url !== '/Uploads/undefined' &&
      item.image_url !== 'null'
      ? `${api.defaults.baseURL.replace('/api', '')}${item.image_url}`
      : '/placeholder.jpg';
  }, [item?.image_url]);

  const handleOptionChange = useCallback((groupId, optionId) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupId]: optionId,
    }));
    setValidationErrors((prev) => ({
      ...prev,
      [groupId]: false,
    }));
  }, []);

  const handleAddToCart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item?.availability) return;

      if (item.type === 'breakfast' && supplements.optionGroups?.length > 0) {
        const requiredGroups = supplements.optionGroups.map((g) => g.id);
        const missingGroups = requiredGroups.filter((gId) => !selectedOptions[gId]);
        if (missingGroups.length > 0) {
          setValidationErrors((prev) => ({
            ...prev,
            ...missingGroups.reduce((acc, gId) => ({ ...acc, [gId]: true }), {}),
          }));
          setShowOptionPopup(true);
          return;
        }
      }

      if ((item.type === 'breakfast' && supplements.optionGroups?.length > 0) || (item.type !== 'breakfast' && supplements.options.length > 0)) {
        setShowOptionPopup(true);
      } else {
        if (item.type === 'breakfast') {
          onAddToCart({
            breakfast_id: item.id,
            unit_price: parseFloat(item.price || 0),
            quantity: 1,
            option_ids: [],
            cartItemId: `${item.id}-${Date.now()}`,
            name: item.name,
            image_url: imageSrc, // Use computed imageSrc
            type: 'breakfast',
            options: [],
          });
        } else {
          onAddToCart({
            ...item,
            item_id: item.id,
            unit_price: parseFloat(item.sale_price || item.regular_price) || 0,
            quantity: item.quantity || 1,
            supplement_id: null,
            supplement_name: null,
            supplement_price: 0,
            cartItemId: `${item.id}-${Date.now()}`,
            type: 'menuItem',
            image_url: imageSrc, // Use computed imageSrc
          });
        }
      }
    },
    [item, onAddToCart, supplements, selectedOptions, imageSrc]
  );

  const handleOptionSelection = useCallback(() => {
    if (item.type === 'breakfast') {
      const selectedOptionIds = Object.values(selectedOptions).filter((id) => id);
      const optionsPrice = supplements.options
        .filter((opt) => selectedOptionIds.includes(opt.id))
        .reduce((sum, opt) => sum + parseFloat(opt.additional_price || 0), 0);
      const totalPrice = (parseFloat(item.price || 0) + optionsPrice);

      onAddToCart({
        breakfast_id: item.id,
        unit_price: parseFloat(item.price || 0),
        total_price: totalPrice.toFixed(2),
        quantity: 1,
        option_ids: selectedOptionIds,
        name: item.name,
        image_url: imageSrc, // Use computed imageSrc
        type: 'breakfast',
        options: supplements.options
          .filter((opt) => selectedOptionIds.includes(opt.id))
          .map((opt) => ({
            ...opt,
            group_title: supplements.optionGroups.find((g) => g.id === opt.group_id)?.title || 'Unknown Group',
          })),
        cartItemId: `${item.id}-${Date.now()}`,
      });
    } else {
      const supplement = supplements.options.find(s => s.supplement_id === parseInt(Object.values(selectedOptions)[0] || '0'));
      onAddToCart({
        ...item,
        item_id: item.id,
        unit_price: parseFloat(item.sale_price || item.regular_price) || 0,
        quantity: item.quantity || 1,
        supplement_id: supplement ? parseInt(supplement.supplement_id) : null,
        supplement_name: supplement ? supplement.name : null,
        supplement_price: supplement ? parseFloat(supplement.additional_price || 0) : 0,
        cartItemId: `${item.id}-${Date.now()}`,
        type: 'menuItem',
        image_url: imageSrc, // Use computed imageSrc
      });
    }
    setShowOptionPopup(false);
    setSelectedOptions({});
    setValidationErrors({});
  }, [item, onAddToCart, supplements, selectedOptions, imageSrc]);

  const handleViewProduct = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onView && item?.id) {
        onView(item.id, item?.type);
      } else {
        console.warn('onView prop is missing or item ID is invalid');
      }
    },
    [onView, item?.id, item?.type]
  );

  const regularPrice = parseFloat(item?.type === 'breakfast' ? item.price : item.regular_price) || 0;
  const salePrice = parseFloat(item?.type === 'breakfast' ? null : item.sale_price) || null;
  const rating = parseFloat(item?.average_rating) || 0;
  const reviewCount = parseInt(item?.review_count) || 0;

  const discountPercentage = useMemo(() => {
    return salePrice && regularPrice > 0
      ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
      : 0;
  }, [salePrice, regularPrice]);

  const displayPrice = useMemo(() => {
    if (item.type === 'breakfast') {
      const optionsPrice = (supplements.options || []).filter((opt) => Object.values(selectedOptions).includes(opt.id))
        .reduce((sum, opt) => sum + parseFloat(opt.additional_price || 0), 0);
      return (regularPrice + optionsPrice).toFixed(2);
    }
    return (salePrice || regularPrice).toFixed(2);
  }, [item.type, regularPrice, salePrice, selectedOptions, supplements]);

  const renderStars = useMemo(() => {
    const stars = [];
    const fullStars = Math.floor(rating);
    for (let i = 0; i < 5; i++) {
      stars.push(
        i < fullStars ? (
          <StarIcon
            key={i}
            sx={{
              fontSize: isSmallMobile ? '11px' : '12px',
              color: '#FFD700',
            }}
          />
        ) : (
          <StarOutlineIcon
            key={i}
            sx={{
              fontSize: isSmallMobile ? '11px' : '12px',
              color: '#D1D5DB',
            }}
          />
        )
      );
    }
    return stars;
  }, [rating, isSmallMobile]);

  const styles = useMemo(
    () => ({
      card: {
        background: '#FFFFFF',
        borderRadius: isSmallMobile ? '12px' : '16px',
        overflow: 'hidden',
        boxShadow: isHovered ? '0 6px 16px rgba(0, 0, 0, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
        transform: isHovered && !isMobile ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'pointer',
        position: 'relative',
        width: '100%',
        maxWidth: isMobile ? '100%' : '280px',
        border: '1px solid #F3F4F6',
      },
      imageContainer: {
        position: 'relative',
        width: '100%',
        height: isSmallMobile ? '90px' : isMobile ? '100px' : '160px',
        background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
        overflow: 'hidden',
      },
      image: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
        opacity: imageLoaded ? 1 : 0,
        transition: 'opacity 0.3s ease',
      },
      imageOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isHovered && !isMobile ? 'rgba(0,0,0,0.1)' : 'transparent',
        transition: 'background 0.3s ease',
        zIndex: 1,
      },
      discountBadge: {
        position: 'absolute',
        top: '6px',
        left: '6px',
        background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        color: '#FFFFFF',
        padding: isSmallMobile ? '2px 5px' : '3px 6px',
        borderRadius: '8px',
        fontSize: isSmallMobile ? '8px' : '9px',
        fontWeight: '700',
        zIndex: 3,
      },
      actionButtons: {
        position: 'absolute',
        bottom: '6px',
        right: '6px',
        display: 'flex',
        gap: '4px',
        zIndex: 2,
      },
      actionButton: {
        background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
        border: 'none',
        borderRadius: '8px',
        width: isSmallMobile ? '30px' : '34px',
        height: isSmallMobile ? '30px' : '34px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
      },
      actionButtonDisabled: {
        background: 'rgba(156, 163, 175, 0.8)',
        cursor: 'not-allowed',
      },
      content: {
        padding: isSmallMobile ? '6px' : '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: isSmallMobile ? '2px' : '3px',
      },
      category: {
        fontSize: isSmallMobile ? '8px' : '9px',
        color: '#9CA3AF',
        fontWeight: '500',
        textTransform: 'uppercase',
      },
      title: {
        fontSize: isSmallMobile ? '12px' : '14px',
        fontWeight: '600',
        color: '#111827',
        lineHeight: '1.2',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        minHeight: '2.4em',
      },
      ratingContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
      },
      ratingStars: {
        display: 'flex',
        gap: '1px',
      },
      ratingText: {
        fontSize: isSmallMobile ? '8px' : '9px',
        color: '#6B7280',
        fontWeight: '500',
      },
      priceContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 'auto',
      },
      priceInfo: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '1px',
      },
      currentPrice: {
        fontSize: isSmallMobile ? '13px' : '15px',
        fontWeight: '700',
        color: salePrice ? '#059669' : '#111827',
      },
      originalPrice: {
        fontSize: isSmallMobile ? '9px' : '10px',
        color: '#9CA3AF',
        textDecoration: 'line-through',
      },
      mobileActionButtons: {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
      },
      mobileActionButton: {
        background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
        border: 'none',
        borderRadius: '6px',
        width: isSmallMobile ? '26px' : '28px',
        height: isSmallMobile ? '26px' : '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
      },
      mobileActionButtonDisabled: {
        background: 'rgba(156, 163, 175, 0.8)',
        cursor: 'not-allowed',
      },
      unavailableBadge: {
        background: 'rgba(107, 114, 128, 0.9)',
        color: '#FFFFFF',
        padding: isSmallMobile ? '2px 5px' : '2px 6px',
        borderRadius: '8px',
        fontSize: isSmallMobile ? '8px' : '9px',
        fontWeight: '600',
        marginBottom: '2px',
      },
      loadingPlaceholder: {
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      },
      overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease-out',
      },
      popup: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: isSmallMobile ? '12px' : '16px',
        maxWidth: isSmallMobile ? '90%' : '360px',
        width: '90%',
        zIndex: 1001,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
      },
      popupTitle: {
        fontSize: isSmallMobile ? '14px' : '16px',
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
        marginBottom: '10px',
      },
      popupSelect: {
        width: '100%',
        padding: '8px',
        fontSize: isSmallMobile ? '12px' : '14px',
        color: '#111827',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        background: '#FFFFFF',
        marginBottom: '10px',
        outline: 'none',
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        backgroundSize: '12px',
        paddingRight: '30px',
      },
      popupOptionsContainer: {
        maxHeight: '200px',
        overflowY: 'auto',
        marginBottom: '10px',
      },
      optionGroup: {
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '8px',
        marginBottom: '8px',
        border: '1px solid rgba(0, 0, 0, 0.05)',
      },
      groupTitle: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: '4px',
        paddingBottom: '2px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
      },
      optionItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0',
        fontSize: '12px',
        color: '#1f2937',
        cursor: 'pointer',
      },
      radioInput: {
        width: '16px',
        height: '16px',
        margin: '0',
        appearance: 'none',
        border: '2px solid #6b7280',
        borderRadius: '50%',
        outline: 'none',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: '#fff',
      },
      'radioInput:checked': {
        borderColor: '#ff6b35',
      },
      'radioInput:checked::after': {
        content: '""',
        width: '8px',
        height: '8px',
        backgroundColor: '#ff6b35',
        borderRadius: '50%',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      },
      optionText: {
        flexGrow: '1',
        fontSize: '12px',
        color: '#1f2937',
      },
      optionPrice: {
        color: '#6b7280',
        marginLeft: '4px',
      },
      optionSelected: {
        fontWeight: '600',
        color: '#ff6b35',
      },
      optionGroupError: {
        border: '1px solid #ef4444',
        borderRadius: '8px',
        padding: '6px',
      },
      popupButtons: {
        display: 'flex',
        gap: '6px',
        justifyContent: 'center',
      },
      popupButton: {
        flex: 1,
        padding: isSmallMobile ? '6px 12px' : '8px 14px',
        border: 'none',
        borderRadius: '8px',
        fontSize: isSmallMobile ? '12px' : '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
      },
      addButton: {
        background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
        color: '#FFFFFF',
      },
      cancelButton: {
        background: '#F3F4F6',
        color: '#6B7280',
      },
    }),
    [isHovered, isMobile, isSmallMobile, imageLoaded, selectedOptions, validationErrors]
  );

  const animations = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .action-btn:hover:not(:disabled) {
      transform: scale(1.05);
    }
    .mobile-action-btn:hover:not(:disabled) {
      transform: scale(1.05);
    }
    .popup-btn:hover:not(:disabled) {
      transform: scale(1.02);
    }
    .popup-select:focus {
      border-color: #FF6B35;
    }
    @media (max-width: 768px) {
      .action-btn:active:not(:disabled) {
        transform: scale(0.95);
      }
      .mobile-action-btn:active:not(:disabled) {
        transform: scale(0.95);
      }
      .popup-btn:active:not(:disabled) {
        transform: scale(0.98);
      }
    }
  `;

  if (!item) {
    return null;
  }

  return (
    <>
      <style>{animations}</style>
      <div
        style={styles.card}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        onClick={handleViewProduct}
      >
        <div style={styles.imageContainer}>
          {!imageLoaded && <div style={styles.loadingPlaceholder} />}
          <img
            src={imageSrc}
            alt={item.name || 'Item'}
            style={styles.image}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              e.target.src = '/placeholder.jpg';
              setImageLoaded(true);
            }}
          />
          <div style={styles.imageOverlay} />

          {discountPercentage > 0 && (
            <div style={styles.discountBadge}>-{discountPercentage}% OFF</div>
          )}

          {!isMobile && (
            <div style={styles.actionButtons}>
              <button
                style={styles.actionButton}
                className="action-btn"
                onClick={handleViewProduct}
                title="View Details"
              >
                <RemoveRedEyeIcon
                  sx={{ fontSize: isSmallMobile ? 16 : 18, color: '#FFFFFF' }}
                />
              </button>
              <button
                style={{
                  ...styles.actionButton,
                  ...(item.availability ? {} : styles.actionButtonDisabled),
                }}
                className="action-btn"
                onClick={handleAddToCart}
                title={item.availability ? 'Add to Cart' : 'Item Unavailable'}
                disabled={!item.availability}
              >
                <ShoppingCartIcon
                  sx={{ fontSize: isSmallMobile ? 16 : 18, color: '#FFFFFF' }}
                />
              </button>
            </div>
          )}
        </div>

        <div style={styles.content}>
          {!item.availability && (
            <div style={styles.unavailableBadge}>Unavailable</div>
          )}

          <div style={styles.category}>{item.category_name || (item.type === 'breakfast' ? 'Breakfast' : 'Uncategorized')}</div>

          <h3 style={styles.title}>{item.name || 'Unknown Item'}</h3>

          {(rating > 0 || reviewCount > 0) && (
            <div style={styles.ratingContainer}>
              <div style={styles.ratingStars}>{renderStars}</div>
              <span style={styles.ratingText}>
                {rating.toFixed(1)} ({reviewCount})
              </span>
            </div>
          )}

          <div style={styles.priceContainer}>
            <div style={styles.priceInfo}>
              <span style={styles.currentPrice}>
                ${displayPrice}
              </span>
              {salePrice && (
                <span style={styles.originalPrice}>${regularPrice.toFixed(2)}</span>
              )}
            </div>

            {isMobile && (
              <div style={styles.mobileActionButtons}>
                <button
                  style={styles.mobileActionButton}
                  className="mobile-action-btn"
                  onClick={handleViewProduct}
                  title="View Details"
                >
                  <RemoveRedEyeIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
                </button>
                <button
                  style={{
                    ...styles.mobileActionButton,
                    ...(item.availability ? {} : styles.mobileActionButtonDisabled),
                  }}
                  className="mobile-action-btn"
                  onClick={handleAddToCart}
                  title={item.availability ? 'Add to Cart' : 'Item Unavailable'}
                  disabled={!item.availability}
                >
                  <ShoppingCartIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showOptionPopup && (
        <>
          <div
            style={styles.overlay}
            onClick={() => {
              setShowOptionPopup(false);
              setSelectedOptions({});
              setValidationErrors({});
            }}
          />
          <div style={styles.popup}>
            <h3 style={styles.popupTitle}>
              Choose {item.type === 'breakfast' ? 'Options' : 'Supplement'} for<br />
              {item.name}
            </h3>
            {item.type === 'breakfast' && supplements.optionGroups?.length > 0 && (
              <div style={styles.popupOptionsContainer}>
                {supplements.optionGroups.map((group) => (
                  <div
                    key={group.id}
                    style={{
                      ...styles.optionGroup,
                      ...(validationErrors[group.id] ? styles.optionGroupError : {}),
                    }}
                  >
                    <div style={styles.groupTitle}>
                      {group.title}
                      {validationErrors[group.id] && <span style={{ color: '#ef4444' }}> (Required)</span>}
                    </div>
                    {supplements.options
                      .filter((opt) => opt.group_id === group.id)
                      .map((opt) => (
                        <label
                          key={opt.id}
                          style={styles.optionItem}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="radio"
                            name={`group-${item.id}-${group.id}`}
                            checked={selectedOptions[group.id] === opt.id}
                            onChange={() => handleOptionChange(group.id, opt.id)}
                            disabled={!item.availability}
                            style={styles.radioInput}
                          />
                          <span
                            style={{
                              ...styles.optionText,
                              ...(selectedOptions[group.id] === opt.id ? styles.optionSelected : {}),
                            }}
                          >
                            {opt.option_name}{' '}
                            <span style={styles.optionPrice}>
                              +${parseFloat(opt.additional_price || 0).toFixed(2)}
                            </span>
                          </span>
                        </label>
                      ))}
                  </div>
                ))}
              </div>
            )}
            {item.type !== 'breakfast' && supplements.options.length > 0 && (
              <select
                value={Object.values(selectedOptions)[0] || '0'}
                onChange={(e) => handleOptionChange('supplement', e.target.value)}
                style={styles.popupSelect}
                className="popup-select"
              >
                <option value="0">No Supplement</option>
                {supplements.options.map((supplement) => (
                  <option
                    key={supplement.supplement_id}
                    value={supplement.supplement_id}
                  >
                    {supplement.name} (+$
                    {parseFloat(supplement.additional_price || 0).toFixed(2)})
                  </option>
                ))}
              </select>
            )}
            <div style={styles.popupButtons}>
              <button
                style={{ ...styles.popupButton, ...styles.addButton }}
                className="popup-btn add-btn"
                onClick={() => handleOptionSelection()}
                disabled={!item.availability || (item.type === 'breakfast' && supplements.optionGroups?.length > 0 && Object.keys(selectedOptions).length < supplements.optionGroups.length)}
              >
                Add to Cart
              </button>
              <button
                style={{ ...styles.popupButton, ...styles.cancelButton }}
                className="popup-btn cancel-btn"
                onClick={() => {
                  setShowOptionPopup(false);
                  setSelectedOptions({});
                  setValidationErrors({});
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default MenuItemCard;