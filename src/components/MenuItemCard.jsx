import { api } from '../services/api';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';

function MenuItemCard({ item, onAddToCart, onView, isManager }) {
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
        console.error(`Échec du chargement des ${item.type === 'breakfast' ? 'options' : 'suppléments'} pour l'article ${item.id}:`, err);
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
    setSelectedOptions((prev) => {
      const currentSelections = prev[groupId] || [];
      const group = supplements.optionGroups.find(g => g.id === groupId);
      const maxSelections = group?.max_selections || 0;
      let newSelections;

      if (Array.isArray(currentSelections)) {
        if (currentSelections.includes(optionId)) {
          newSelections = currentSelections.filter(id => id !== optionId);
        } else if (maxSelections === 0 || currentSelections.length < maxSelections) {
          newSelections = [...currentSelections, optionId];
        } else {
          newSelections = [...currentSelections.slice(1), optionId];
        }
      } else {
        newSelections = [optionId];
      }

      return {
        ...prev,
        [groupId]: newSelections,
      };
    });
    setValidationErrors((prev) => ({
      ...prev,
      [groupId]: false,
    }));
  }, [supplements.optionGroups]);

  const handleAddToCart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item?.availability) return;

      if (item.type === 'breakfast' && supplements.optionGroups?.length > 0) {
        const errors = {};
        let hasErrors = false;

        supplements.optionGroups.forEach((group) => {
          const selections = selectedOptions[group.id] || [];
          if (group.is_required && selections.length === 0) {
            errors[group.id] = true;
            hasErrors = true;
          }
          if (group.max_selections > 0 && selections.length > group.max_selections) {
            errors[group.id] = true;
            hasErrors = true;
          }
        });

        if (hasErrors) {
          setValidationErrors(errors);
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
            image_url: imageSrc,
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
            image_url: imageSrc,
          });
        }
      }
    },
    [item, onAddToCart, supplements, selectedOptions, imageSrc]
  );

  const handleOptionSelection = useCallback(() => {
    if (item.type === 'breakfast') {
      const selectedOptionIds = Object.values(selectedOptions).flat().filter(id => id);
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
        image_url: imageSrc,
        type: 'breakfast',
        options: supplements.options
          .filter((opt) => selectedOptionIds.includes(opt.id))
          .map((opt) => ({
            ...opt,
            group_title: supplements.optionGroups.find((g) => g.id === opt.group_id)?.title || 'Groupe inconnu',
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
        image_url: imageSrc,
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
        console.warn('La prop onView est manquante ou l\'ID de l\'article est invalide');
      }
    },
    [onView, item?.id, item?.type]
  );

  const handleEditProduct = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (item?.id) {
        window.location.href = `/edit-product/${item.id}`;
      } else {
        console.warn('L\'ID de l\'article est invalide');
      }
    },
    [item?.id]
  );

  const regularPrice = parseFloat(item?.type === 'breakfast' ? item.price : item.regular_price) || 0;
  const salePrice = parseFloat(item?.type === 'breakfast' ? null : item.sale_price) || null;
  const ratingValue = parseFloat(item?.average_rating) || 0;
  const reviewCount = parseInt(item?.review_count) || 0;

  const discountPercentage = useMemo(() => {
    return salePrice && regularPrice > 0
      ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
      : 0;
  }, [salePrice, regularPrice]);

  const displayPrice = useMemo(() => {
    if (item.type === 'breakfast') {
      const optionsPrice = (supplements.options || [])
        .filter((opt) => Object.values(selectedOptions).flat().includes(opt.id))
        .reduce((sum, opt) => sum + parseFloat(opt.additional_price || 0), 0);
      return (regularPrice + optionsPrice).toFixed(2);
    }
    return (salePrice || regularPrice).toFixed(2);
  }, [item.type, regularPrice, salePrice, selectedOptions, supplements]);

  const renderStars = useMemo(() => {
    const stars = [];
    const fullStars = Math.floor(ratingValue);
    for (let i = 0; i < 5; i++) {
      stars.push(
        i < fullStars ? (
          <StarIcon
            key={i}
            sx={{
              fontSize: isSmallMobile ? '11px' : '12px',
              color: '#000000',
            }}
          />
        ) : (
          <StarOutlineIcon
            key={i}
            sx={{
              fontSize: isSmallMobile ? '11px' : '12px',
              color: '#000000',
            }}
          />
        )
      );
    }
    return stars;
  }, [ratingValue, isSmallMobile]);

  const styles = useMemo(
    () => ({
      card: {
        background: 'var(--background-color)',
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
        background: `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)`,
        color: 'var(--background-color)',
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
        background: `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)`,
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
        color: '#000000',
        fontWeight: '500',
        textTransform: 'uppercase',
        opacity: 0.7,
      },
      title: {
        fontSize: isSmallMobile ? '12px' : '14px',
        fontWeight: '600',
        color: '#000000',
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
        color: '#000000',
        fontWeight: '500',
        opacity: 0.7,
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
        color: salePrice ? 'var(--primary-color)' : '#000000',
      },
      originalPrice: {
        fontSize: isSmallMobile ? '9px' : '10px',
        color: salePrice ? 'var(--primary-color)' : 'var(--text-color)',
        textDecoration: 'line-through',
        opacity: 0.7,
      },
      mobileActionButtons: {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
      },
      mobileActionButton: {
        background: `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)`,
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
        color: 'var(--background-color)',
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
        background: 'var(--background-color)',
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
        color: '#000000',
        textAlign: 'center',
        marginBottom: '10px',
      },
      popupSelect: {
        width: '100%',
        padding: '8px',
        fontSize: isSmallMobile ? '12px' : '14px',
        color: '#000000',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        background: 'var(--background-color)',
        marginBottom: '10px',
        outline: 'none',
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#000000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
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
        backgroundColor: 'var(--background-color)',
        borderRadius: '8px',
        padding: '8px',
        marginBottom: '8px',
        border: '1px solid rgba(0, 0, 0, 0.05)',
      },
      groupTitle: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#000000',
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
        color: '#000000',
        cursor: 'pointer',
      },
      checkboxInput: {
        width: '16px',
        height: '16px',
        margin: '0',
        appearance: 'none',
        border: `2px solid #000000`,
        borderRadius: '4px',
        outline: 'none',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: 'var(--background-color)',
      },
      'checkboxInput:checked': {
        borderColor: 'var(--primary-color)',
        backgroundColor: 'var(--primary-color)',
      },
      'checkboxInput:checked::after': {
        content: '""',
        width: '8px',
        height: '8px',
        backgroundColor: 'var(--background-color)',
        borderRadius: '2px',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      },
      optionText: {
        flexGrow: '1',
        fontSize: '12px',
        color: '#000000',
      },
      optionPrice: {
        color: '#000000',
        marginLeft: '4px',
        opacity: 0.7,
      },
      optionSelected: {
        fontWeight: '600',
        color: 'var(--primary-color)',
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
        background: `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)`,
        color: 'var(--background-color)',
      },
      cancelButton: {
        background: '#F3F4F6',
        color: '#000000',
      },
      editButton: {
        background: `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)`,
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
      mobileEditButton: {
        background: `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)`,
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
      border-color: var(--primary-color);
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
        onClick={isManager ? handleEditProduct : handleViewProduct}
      >
        <div style={styles.imageContainer}>
          {!imageLoaded && <div style={styles.loadingPlaceholder} />}
          <img
            src={imageSrc}
            alt={item.name || 'Article'}
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
            <div style={styles.discountBadge}>-{discountPercentage}% DE RÉDUCTION</div>
          )}

          {!isMobile && (
            <div style={styles.actionButtons}>
              {isManager ? (
                <button
                  style={styles.editButton}
                  className="action-btn"
                  onClick={handleEditProduct}
                  title="Modifier l'article"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--background-color)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: isSmallMobile ? '16px' : '18px', height: isSmallMobile ? '16px' : '18px' }}
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              ) : (
                <>
                  <button
                    style={styles.actionButton}
                    className="action-btn"
                    onClick={handleViewProduct}
                    title="Voir les détails"
                  >
                    <RemoveRedEyeIcon
                      sx={{ fontSize: isSmallMobile ? 16 : 18, color: 'var(--background-color)' }}
                    />
                  </button>
                  <button
                    style={{
                      ...styles.actionButton,
                      ...(item.availability ? {} : styles.actionButtonDisabled),
                    }}
                    className="action-btn"
                    onClick={handleAddToCart}
                    title={item.availability ? 'Ajouter au panier' : 'Article indisponible'}
                    disabled={!item.availability}
                  >
                    <ShoppingCartIcon
                      sx={{ fontSize: isSmallMobile ? 16 : 18, color: 'var(--background-color)' }}
                    />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div style={styles.content}>
          {!item.availability && (
            <div style={styles.unavailableBadge}>Indisponible</div>
          )}

          <div style={styles.category}>{item.category_name || (item.type === 'breakfast' ? 'Petit-déjeuner' : 'Non catégorisé')}</div>

          <h3 style={styles.title}>{item.name || 'Article inconnu'}</h3>

          {(ratingValue > 0 || reviewCount > 0) && (
            <div style={styles.ratingContainer}>
              <div style={styles.ratingStars}>{renderStars}</div>
              <span style={styles.ratingText}>
                {ratingValue.toFixed(1)} ({reviewCount})
              </span>
            </div>
          )}

          <div style={styles.priceContainer}>
            <div style={styles.priceInfo}>
              <span style={styles.currentPrice}>
                {displayPrice} DT
              </span>
              {salePrice && (
                <span style={styles.originalPrice}>{regularPrice.toFixed(2)} DT</span>
              )}
            </div>

            {isMobile && (
              <div style={styles.mobileActionButtons}>
                {isManager ? (
                  <button
                    style={styles.mobileEditButton}
                    className="mobile-action-btn"
                    onClick={handleEditProduct}
                    title="Modifier l'article"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--background-color)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ width: '14px', height: '14px' }}
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                ) : (
                  <>
                    <button
                      style={styles.mobileActionButton}
                      className="mobile-action-btn"
                      onClick={handleViewProduct}
                      title="Voir les détails"
                    >
                      <RemoveRedEyeIcon sx={ { fontSize: 14, color: 'var(--background-color)' }} />
                    </button>
                    <button
                      style={{
                        ...styles.mobileActionButton,
                        ...(item.availability ? {} : styles.mobileActionButtonDisabled),
                      }}
                      className="mobile-action-btn"
                      onClick={handleAddToCart}
                      title={item.availability ? 'Ajouter au panier' : 'Article indisponible'}
                      disabled={!item.availability}
                    >
                      <ShoppingCartIcon sx={{ fontSize: 14, color: 'var(--background-color)' }} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showOptionPopup && !isManager && (
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
              Choisir {item.type === 'breakfast' ? 'les options' : 'le supplément'} pour<br />
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
                      {group.title} {group.is_required ? '(Requis)' : '(Facultatif)'}
                      {group.max_selections > 0 && `, Max : ${group.max_selections}`}
                      {validationErrors[group.id] && <span style={{ color: '#ef4444' }}> (Veuillez sélectionner)</span>}
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
                            type="checkbox"
                            name={`group-${item.id}-${group.id}`}
                            checked={selectedOptions[group.id]?.includes(opt.id)}
                            onChange={() => handleOptionChange(group.id, opt.id)}
                            disabled={!item.availability}
                            style={styles.checkboxInput}
                          />
                          <span
                            style={{
                              ...styles.optionText,
                              ...(selectedOptions[group.id]?.includes(opt.id) ? styles.optionSelected : {}),
                            }}
                          >
                            {opt.option_name}{' '}
                            <span style={styles.optionPrice}>
                              +{parseFloat(opt.additional_price || 0).toFixed(2)} DT
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
                <option value="0">Aucun supplément</option>
                {supplements.options.map((supplement) => (
                  <option
                    key={supplement.supplement_id}
                    value={supplement.supplement_id}
                  >
                    {supplement.name} (+{parseFloat(supplement.additional_price || 0).toFixed(2)} DT)
                  </option>
                ))}
              </select>
            )}
            <div style={styles.popupButtons}>
              <button
                style={{ ...styles.popupButton, ...styles.addButton }}
                className="popup-btn add-btn"
                onClick={() => handleOptionSelection()}
                disabled={
                  !item.availability ||
                  (item.type === 'breakfast' &&
                    supplements.optionGroups?.length > 0 &&
                    supplements.optionGroups
                      .filter((g) => g.is_required)
                      .some((g) => !selectedOptions[g.id] || selectedOptions[g.id].length === 0))
                }
              >
                Ajouter au panier
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
                Annuler
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default MenuItemCard;
