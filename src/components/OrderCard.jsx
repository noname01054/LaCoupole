import { useState, useEffect, useRef, useMemo } from 'react';
import {
  AccessTime,
  TableRestaurant,
  LocationOn,
  Receipt,
  Check,
  ExpandMore,
  Restaurant,
  LocalShipping,
  Schedule,
  Note,
  Cancel,
  Phone,
  CheckCircle,
  RadioButtonUnchecked,
  MoreVert,
} from '@mui/icons-material';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';
const FALLBACK_IMAGE = 'https://via.placeholder.com/60?text=No+Image';

// Professional color palette
const colors = {
  primary: {
    main: '#2563eb',
    light: '#3b82f6',
    lighter: '#dbeafe',
    dark: '#1e40af',
  },
  success: {
    main: '#059669',
    light: '#10b981',
    lighter: '#d1fae5',
    dark: '#047857',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    lighter: '#fef3c7',
    dark: '#d97706',
  },
  danger: {
    main: '#dc2626',
    light: '#ef4444',
    lighter: '#fee2e2',
    dark: '#b91c1c',
  },
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

// Helper functions
const safeParseFloat = (value, defaultValue = 0) => {
  if (value == null || value === '' || value === 'NULL') {
    return defaultValue;
  }
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const safeParseInt = (value, defaultValue = 0) => {
  if (value == null || value === '' || value === 'NULL') {
    return defaultValue;
  }
  const parsed = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Status configuration
const getOrderStatus = (approved, status) => {
  if (status === 'cancelled') {
    return {
      color: colors.danger.main,
      bgColor: colors.danger.lighter,
      icon: Cancel,
      label: 'Annulée',
      badge: 'cancelled',
    };
  }
  if (approved) {
    return {
      color: colors.success.main,
      bgColor: colors.success.lighter,
      icon: CheckCircle,
      label: 'Approuvée',
      badge: 'approved',
    };
  }
  return {
    color: colors.warning.main,
    bgColor: colors.warning.lighter,
    icon: AccessTime,
    label: 'En attente',
    badge: 'pending',
  };
};

// Order type configuration
const getOrderTypeDisplay = (orderType, tableNumber) => {
  switch (orderType) {
    case 'local':
      return {
        text: `Table ${tableNumber || 'N/A'}`,
        icon: TableRestaurant,
        color: colors.primary.main,
        bgColor: colors.primary.lighter,
      };
    case 'delivery':
      return {
        text: 'Livraison',
        icon: LocalShipping,
        color: colors.warning.main,
        bgColor: colors.warning.lighter,
      };
    case 'imported':
      return {
        text: 'À emporter',
        icon: Restaurant,
        color: colors.success.main,
        bgColor: colors.success.lighter,
      };
    default:
      return {
        text: 'Inconnu',
        icon: Restaurant,
        color: colors.neutral[500],
        bgColor: colors.neutral[100],
      };
  }
};

function OrderCard({
  order,
  onApproveOrder,
  onCancelOrder,
  timeAgo,
  isExpanded: initialExpanded = false,
}) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [isOrderApproved, setIsOrderApproved] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  // Memoize grouped items
  const groupedItems = useMemo(() => {
    const acc = {};

    // Process menu items
    const itemIds = Array.isArray(order.item_ids) 
      ? order.item_ids 
      : (order.item_ids?.split(',') || []).filter(id => id?.trim() && !isNaN(parseInt(id)));
    const itemNames = Array.isArray(order.item_names) 
      ? order.item_names 
      : order.item_names?.split(',') || [];
    const unitPrices = Array.isArray(order.unit_prices) 
      ? order.unit_prices 
      : order.unit_prices?.split(',') || [];
    const menuQuantities = Array.isArray(order.menu_quantities) 
      ? order.menu_quantities 
      : (order.menu_quantities?.split(',') || []).filter(q => q !== 'NULL' && q?.trim());
    const supplementIds = Array.isArray(order.supplement_ids) 
      ? order.supplement_ids 
      : order.supplement_ids?.split(',') || [];
    const supplementNames = Array.isArray(order.supplement_names) 
      ? order.supplement_names 
      : order.supplement_names?.split(',') || [];
    const supplementPrices = Array.isArray(order.supplement_prices) 
      ? order.supplement_prices 
      : order.supplement_prices?.split(',') || [];
    const imageUrls = Array.isArray(order.image_urls) 
      ? order.image_urls 
      : order.image_urls?.split(',') || [];

    itemIds.forEach((id, idx) => {
      if (idx >= menuQuantities.length || idx >= itemNames.length || idx >= unitPrices.length) return;

      const supplementId = supplementIds[idx]?.trim() || null;
      const key = `${id.trim()}_${supplementId || 'none'}`;
      const quantity = safeParseInt(menuQuantities[idx], 1);
      const unitPrice = safeParseFloat(unitPrices[idx], 0);
      const supplementPrice = supplementId ? safeParseFloat(supplementPrices[idx], 0) : 0;
      const basePrice = unitPrice - supplementPrice;

      if (!acc[key]) {
        acc[key] = {
          id: safeParseInt(id, 0),
          type: 'menu',
          name: itemNames[idx]?.trim() || 'Article inconnu',
          quantity: 0,
          basePrice,
          unitPrice,
          supplementName: supplementId ? supplementNames[idx]?.trim() || 'Supplément inconnu' : null,
          supplementPrice,
          imageUrl: idx < imageUrls.length ? imageUrls[idx]?.trim() || null : null,
          options: [],
        };
      }
      acc[key].quantity = quantity;
    });

    // Process breakfast items
    const breakfastIds = Array.isArray(order.breakfast_ids) 
      ? order.breakfast_ids 
      : (order.breakfast_ids?.split(',') || []).filter(id => id?.trim() && !isNaN(parseInt(id)));
    const breakfastNames = Array.isArray(order.breakfast_names) 
      ? order.breakfast_names 
      : order.breakfast_names?.split(',') || [];
    const breakfastQuantities = Array.isArray(order.breakfast_quantities) 
      ? order.breakfast_quantities 
      : (order.breakfast_quantities?.split(',') || []).filter(q => q !== 'NULL' && q?.trim());
    const breakfastImages = Array.isArray(order.breakfast_images) 
      ? order.breakfast_images 
      : order.breakfast_images?.split(',') || [];
    const optionIds = Array.isArray(order.breakfast_option_ids) 
      ? order.breakfast_option_ids 
      : (order.breakfast_option_ids?.split(',') || []).filter(id => id?.trim() && !isNaN(parseInt(id)));
    const optionNames = Array.isArray(order.breakfast_option_names) 
      ? order.breakfast_option_names 
      : order.breakfast_option_names?.split(',') || [];
    const optionPrices = Array.isArray(order.breakfast_option_prices) 
      ? order.breakfast_option_prices 
      : order.breakfast_option_prices?.split(',') || [];

    breakfastIds.forEach((id, index) => {
      if (index >= breakfastQuantities.length || index >= breakfastNames.length) return;

      const key = `breakfast_${id.trim()}`;
      const quantity = safeParseInt(breakfastQuantities[index], 1);
      const imageUrl = index < breakfastImages.length ? breakfastImages[index]?.trim() || null : null;

      const options = [];
      const optionsPerItem = breakfastIds.length ? Math.floor(optionIds.length / breakfastIds.length) : 0;
      const startIdx = index * optionsPerItem;
      const endIdx = (index + 1) * optionsPerItem;

      let totalOptionPrice = 0;
      for (let i = startIdx; i < endIdx && i < optionIds.length; i++) {
        if (optionIds[i]) {
          const optionPrice = safeParseFloat(optionPrices[i], 0);
          totalOptionPrice += optionPrice;
          let optionName = 'Option inconnue';
          if (i < optionNames.length) {
            const name = optionNames[i];
            if (typeof name === 'string') {
              optionName = name.trim() || 'Option inconnue';
            } else if (Array.isArray(name)) {
              optionName = name.join(', ').trim() || 'Option inconnue';
            }
          }
          options.push({
            name: optionName,
            price: optionPrice,
          });
        }
      }

      const breakfastUnitPrice = unitPrices.length > itemIds.length 
        ? safeParseFloat(unitPrices[itemIds.length + index], 0) 
        : 0;
      const basePrice = breakfastUnitPrice - totalOptionPrice;

      if (!acc[key]) {
        acc[key] = {
          id: safeParseInt(id, 0),
          type: 'breakfast',
          name: breakfastNames[index]?.trim() || 'Petit-déjeuner inconnu',
          quantity: 0,
          basePrice,
          unitPrice: breakfastUnitPrice,
          imageUrl,
          options,
          supplementName: null,
          supplementPrice: 0,
        };
      }
      acc[key].quantity = quantity;
    });

    return Object.values(acc).filter(item => item.quantity > 0);
  }, [order]);

  const statusConfig = getOrderStatus(order.approved, order.status);
  const orderTypeConfig = getOrderTypeDisplay(order.order_type, order.table_number);
  const StatusIcon = statusConfig.icon;
  const OrderTypeIcon = orderTypeConfig.icon;

  // Event handlers
  const handleApproveOrder = async () => {
    setIsApproving(true);
    try {
      await onApproveOrder?.(order.id);
      toast.success('Commande approuvée avec succès');
    } catch (error) {
      console.error('Error approving order:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Échec de l\'approbation de la commande');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      const response = await api.getOrder(order.id);
      const orderData = response.data;
      if (orderData.approved) {
        setCancelOrderId(order.id);
        setIsOrderApproved(true);
        setShowCancelPopup(true);
      } else {
        await onCancelOrder?.(order.id, { restoreStock: false });
        toast.success('Commande annulée avec succès');
      }
    } catch (error) {
      console.error('Error checking order status:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Échec de la vérification du statut de la commande');
    } finally {
      setIsCancelling(false);
    }
  };

  const confirmCancelOrder = async (restoreStock) => {
    setIsCancelling(true);
    try {
      await onCancelOrder?.(cancelOrderId, { restoreStock });
      toast.success(`Commande ${restoreStock ? 'annulée avec restauration du stock' : 'annulée sans restauration du stock'}`);
      setShowCancelPopup(false);
      setCancelOrderId(null);
      setIsOrderApproved(false);
    } catch (error) {
      console.error('Error cancelling order:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Échec de l\'annulation de la commande');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const orderTotal = safeParseFloat(order.total_price, 0);

  return (
    <>
      <div 
        ref={cardRef} 
        className="order-card"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          maxWidth: '420px',
          margin: '0 auto 20px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: `2px solid ${statusConfig.color}20`,
          boxShadow: isHovered 
            ? `0 12px 24px -8px ${statusConfig.color}30, 0 0 0 1px ${statusConfig.color}10`
            : '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        }}
        role="article" 
        aria-label={`Commande ${order.id}`}
      >
        {/* Status Indicator Bar */}
        <div 
          style={{
            height: '5px',
            background: `linear-gradient(90deg, ${statusConfig.color}, ${statusConfig.color}dd)`,
            width: '100%',
          }}
        />

        {/* Header Section */}
        <div 
          style={{
            padding: '24px 24px 20px',
            background: `linear-gradient(135deg, ${statusConfig.bgColor}40 0%, ${statusConfig.bgColor}10 100%)`,
            borderBottom: `1px solid ${colors.neutral[200]}`,
          }}
        >
          {/* Order Number & Status Badge */}
          <div 
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <div>
              <div 
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: colors.neutral[500],
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  marginBottom: '4px',
                }}
              >
                Commande
              </div>
              <h3 
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: colors.neutral[900],
                  margin: 0,
                  lineHeight: '1.2',
                  letterSpacing: '-0.5px',
                }}
              >
                #{order.id}
              </h3>
            </div>
            
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: statusConfig.color,
                color: 'white',
                padding: '8px 14px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: `0 4px 12px ${statusConfig.color}40`,
              }}
              role="status"
            >
              <StatusIcon sx={{ fontSize: 16 }} />
              {statusConfig.label}
            </div>
          </div>

          {/* Meta Information */}
          <div 
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            {/* Order Type Chip */}
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: orderTypeConfig.bgColor,
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                color: orderTypeConfig.color,
                border: `1.5px solid ${orderTypeConfig.color}30`,
              }}
            >
              <OrderTypeIcon sx={{ fontSize: 16 }} />
              <span>{orderTypeConfig.text}</span>
            </div>

            {/* Time Chip */}
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: colors.neutral[100],
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                color: colors.neutral[700],
                border: `1.5px solid ${colors.neutral[200]}`,
              }}
            >
              <Schedule sx={{ fontSize: 16 }} />
              <span>{timeAgo}</span>
            </div>

            {/* Total Price Badge */}
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: `linear-gradient(135deg, ${colors.success.main}, ${colors.success.dark})`,
                color: 'white',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '700',
                marginLeft: 'auto',
                boxShadow: `0 4px 12px ${colors.success.main}30`,
              }}
            >
              <span>{orderTotal.toFixed(2)} DT</span>
            </div>
          </div>
        </div>

        {/* Body Section */}
        <div style={{ padding: '20px 24px 24px' }}>
          {/* Delivery Address Alert */}
          {order.delivery_address && (
            <div 
              style={{
                backgroundColor: colors.warning.lighter,
                border: `1.5px solid ${colors.warning.main}40`,
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
              role="alert"
            >
              <div 
                style={{
                  backgroundColor: colors.warning.main,
                  borderRadius: '8px',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LocationOn sx={{ fontSize: 18, color: 'white' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div 
                  style={{
                    fontWeight: '700',
                    color: colors.warning.dark,
                    fontSize: '13px',
                    marginBottom: '6px',
                    letterSpacing: '0.3px',
                  }}
                >
                  Adresse de livraison
                </div>
                <div 
                  style={{
                    fontSize: '13px',
                    color: colors.neutral[700],
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                  }}
                >
                  {order.delivery_address}
                </div>
              </div>
            </div>
          )}

          {/* Notes Alert */}
          {order.notes && (
            <div 
              style={{
                backgroundColor: colors.primary.lighter,
                border: `1.5px solid ${colors.primary.main}40`,
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
              role="alert"
            >
              <div 
                style={{
                  backgroundColor: colors.primary.main,
                  borderRadius: '8px',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Note sx={{ fontSize: 18, color: 'white' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div 
                  style={{
                    fontWeight: '700',
                    color: colors.primary.dark,
                    fontSize: '13px',
                    marginBottom: '6px',
                    letterSpacing: '0.3px',
                  }}
                >
                  Instructions spéciales
                </div>
                <div 
                  style={{
                    fontSize: '13px',
                    color: colors.neutral[700],
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                  }}
                >
                  {order.notes}
                </div>
              </div>
            </div>
          )}

          {/* Expand Button */}
          <button
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: isExpanded ? colors.neutral[50] : 'white',
              border: `2px solid ${isExpanded ? colors.primary.main : colors.neutral[200]}`,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '700',
              color: isExpanded ? colors.primary.main : colors.neutral[700],
              marginBottom: isExpanded ? '20px' : '0',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              WebkitTapHighlightColor: 'transparent',
              letterSpacing: '0.3px',
            }}
            onClick={handleExpandToggle}
            aria-expanded={isExpanded}
            aria-controls={`order-details-${order.id}`}
            onMouseEnter={(e) => {
              if (!isExpanded) {
                e.target.style.backgroundColor = colors.neutral[50];
                e.target.style.borderColor = colors.neutral[300];
              }
            }}
            onMouseLeave={(e) => {
              if (!isExpanded) {
                e.target.style.backgroundColor = 'white';
                e.target.style.borderColor = colors.neutral[200];
              }
            }}
          >
            <Receipt sx={{ fontSize: 18 }} />
            <span>{isExpanded ? 'Masquer les détails' : `Voir les articles (${groupedItems.length})`}</span>
            <ExpandMore
              sx={{
                fontSize: 20,
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </button>

          {/* Expanded Content */}
          {isExpanded && (
            <div 
              id={`order-details-${order.id}`}
              style={{
                animation: 'slideDown 0.3s ease-out',
              }}
            >
              {/* Items List */}
              <div 
                style={{
                  marginBottom: '20px',
                  backgroundColor: colors.neutral[50],
                  borderRadius: '12px',
                  padding: '16px',
                  border: `1px solid ${colors.neutral[200]}`,
                }}
              >
                <div 
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: colors.neutral[500],
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    marginBottom: '16px',
                  }}
                >
                  Articles commandés
                </div>
                
                {groupedItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {groupedItems.map((item, index) => {
                      const imageUrl = item.imageUrl || FALLBACK_IMAGE;
                      const totalItemPrice = item.unitPrice * item.quantity;

                      return (
                        <div
                          key={`${item.type}-${item.id}-${index}`}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            padding: '16px',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            gap: '14px',
                            border: `1px solid ${colors.neutral[200]}`,
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = `0 4px 12px ${colors.neutral[900]}08`;
                            e.currentTarget.style.borderColor = colors.neutral[300];
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = colors.neutral[200];
                          }}
                          role="listitem"
                        >
                          {/* Item Image */}
                          <div 
                            style={{
                              position: 'relative',
                              flexShrink: 0,
                            }}
                          >
                            <img
                              src={imageUrl}
                              alt={item.name}
                              style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '10px',
                                objectFit: 'cover',
                                backgroundColor: colors.neutral[100],
                                border: `2px solid ${colors.neutral[200]}`,
                              }}
                              onError={(e) => {
                                console.error('Error loading order item image:', imageUrl);
                                e.target.src = FALLBACK_IMAGE;
                              }}
                              loading="lazy"
                            />
                            {/* Quantity Badge on Image */}
                            <div 
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                backgroundColor: colors.primary.main,
                                color: 'white',
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: '700',
                                border: '2px solid white',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                              }}
                            >
                              {item.quantity}
                            </div>
                          </div>

                          {/* Item Details */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div 
                              style={{
                                fontSize: '15px',
                                fontWeight: '700',
                                color: colors.neutral[900],
                                marginBottom: '8px',
                                lineHeight: '1.3',
                                wordBreak: 'break-word',
                              }}
                            >
                              {item.name}
                            </div>
                            
                            {/* Price Breakdown */}
                            <div style={{ marginBottom: '8px' }}>
                              {/* Base Price */}
                              <div 
                                style={{
                                  fontSize: '12px',
                                  color: colors.neutral[600],
                                  lineHeight: '1.6',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span>Prix de base</span>
                                <span style={{ fontWeight: '600' }}>{item.basePrice.toFixed(2)} DT</span>
                              </div>
                              
                              {/* Supplement for menu items */}
                              {item.type === 'menu' && item.supplementName && item.supplementPrice > 0 && (
                                <div 
                                  style={{
                                    fontSize: '12px',
                                    color: colors.neutral[600],
                                    lineHeight: '1.6',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <span>+ {item.supplementName}</span>
                                  <span style={{ fontWeight: '600' }}>{item.supplementPrice.toFixed(2)} DT</span>
                                </div>
                              )}
                              
                              {/* Options for breakfast items */}
                              {item.type === 'breakfast' && item.options && item.options.length > 0 && (
                                item.options.map((opt, optIdx) => (
                                  <div 
                                    key={optIdx}
                                    style={{
                                      fontSize: '12px',
                                      color: colors.neutral[600],
                                      lineHeight: '1.6',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                    }}
                                  >
                                    <span>+ {opt.name}</span>
                                    <span style={{ fontWeight: '600' }}>{opt.price.toFixed(2)} DT</span>
                                  </div>
                                ))
                              )}
                            </div>
                            
                            {/* Total Calculation */}
                            <div 
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingTop: '10px',
                                borderTop: `1px dashed ${colors.neutral[300]}`,
                              }}
                            >
                              <span 
                                style={{
                                  fontSize: '13px',
                                  color: colors.neutral[600],
                                  fontWeight: '600',
                                }}
                              >
                                {item.unitPrice.toFixed(2)} DT × {item.quantity}
                              </span>
                              <span 
                                style={{
                                  fontSize: '15px',
                                  color: colors.success.main,
                                  fontWeight: '700',
                                }}
                              >
                                {totalItemPrice.toFixed(2)} DT
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div 
                    style={{
                      padding: '32px 20px',
                      textAlign: 'center',
                      color: colors.neutral[500],
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    Aucun article à afficher
                  </div>
                )}
              </div>

              {/* Total Section */}
              <div 
                style={{
                  padding: '20px',
                  background: `linear-gradient(135deg, ${colors.success.lighter} 0%, ${colors.success.lighter}80 100%)`,
                  borderRadius: '12px',
                  marginBottom: '20px',
                  border: `2px solid ${colors.success.main}30`,
                }}
              >
                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div 
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: colors.success.dark,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        marginBottom: '4px',
                      }}
                    >
                      Total
                    </div>
                    <div 
                      style={{
                        fontSize: '28px',
                        fontWeight: '800',
                        color: colors.success.main,
                        lineHeight: '1',
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {orderTotal.toFixed(2)} DT
                    </div>
                  </div>
                  <div 
                    style={{
                      backgroundColor: colors.success.main,
                      borderRadius: '50%',
                      width: '50px',
                      height: '50px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 4px 12px ${colors.success.main}40`,
                    }}
                  >
                    <Receipt sx={{ fontSize: 24, color: 'white' }} />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                {/* Approve Button */}
                <button
                  style={{
                    padding: '16px 20px',
                    background: order.approved && order.status !== 'cancelled'
                      ? `linear-gradient(135deg, ${colors.success.light}, ${colors.success.main})`
                      : `linear-gradient(135deg, ${colors.success.main}, ${colors.success.dark})`,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: (order.approved && order.status !== 'cancelled') || isApproving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: (order.approved && order.status !== 'cancelled') || isApproving ? 0.6 : 1,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: '54px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: (order.approved && order.status !== 'cancelled') || isApproving 
                      ? 'none' 
                      : `0 4px 12px ${colors.success.main}40`,
                  }}
                  onClick={handleApproveOrder}
                  disabled={isApproving || (order.approved && order.status !== 'cancelled')}
                  aria-label="Approuver la commande"
                  onMouseEnter={(e) => {
                    if (!((order.approved && order.status !== 'cancelled') || isApproving)) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = `0 6px 16px ${colors.success.main}50`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!((order.approved && order.status !== 'cancelled') || isApproving)) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = `0 4px 12px ${colors.success.main}40`;
                    }
                  }}
                >
                  {isApproving ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite',
                      }} />
                      <span>Approbation...</span>
                    </>
                  ) : order.approved && order.status !== 'cancelled' ? (
                    <>
                      <CheckCircle sx={{ fontSize: 18 }} />
                      <span>Approuvée</span>
                    </>
                  ) : (
                    <>
                      <Check sx={{ fontSize: 18 }} />
                      <span>Approuver</span>
                    </>
                  )}
                </button>
                
                {/* Cancel Button */}
                <button
                  style={{
                    padding: '16px 20px',
                    background: order.status === 'cancelled'
                      ? `linear-gradient(135deg, ${colors.danger.light}, ${colors.danger.main})`
                      : `linear-gradient(135deg, ${colors.danger.main}, ${colors.danger.dark})`,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: order.status === 'cancelled' || isCancelling ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: order.status === 'cancelled' || isCancelling ? 0.6 : 1,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: '54px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: order.status === 'cancelled' || isCancelling 
                      ? 'none' 
                      : `0 4px 12px ${colors.danger.main}40`,
                  }}
                  onClick={handleCancelOrder}
                  disabled={isCancelling || order.status === 'cancelled'}
                  aria-label="Annuler la commande"
                  onMouseEnter={(e) => {
                    if (!(order.status === 'cancelled' || isCancelling)) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = `0 6px 16px ${colors.danger.main}50`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(order.status === 'cancelled' || isCancelling)) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = `0 4px 12px ${colors.danger.main}40`;
                    }
                  }}
                >
                  {isCancelling ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite',
                      }} />
                      <span>Annulation...</span>
                    </>
                  ) : order.status === 'cancelled' ? (
                    <>
                      <Cancel sx={{ fontSize: 18 }} />
                      <span>Annulée</span>
                    </>
                  ) : (
                    <>
                      <Cancel sx={{ fontSize: 18 }} />
                      <span>Annuler</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Popup */}
      {showCancelPopup && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          role="dialog" 
          aria-labelledby="cancel-popup-title"
          onClick={() => {
            if (!isCancelling) {
              setShowCancelPopup(false);
              setCancelOrderId(null);
              setIsOrderApproved(false);
            }
          }}
        >
          <div 
            style={{
              backgroundColor: '#ffffff',
              padding: '32px',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              maxWidth: '440px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div 
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${colors.warning.light}, ${colors.warning.main})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: `0 8px 24px ${colors.warning.main}40`,
              }}
            >
              <Cancel sx={{ fontSize: 40, color: 'white' }} />
            </div>

            <h2 
              id="cancel-popup-title"
              style={{
                fontSize: '24px',
                fontWeight: '800',
                marginBottom: '12px',
                color: colors.neutral[900],
                textAlign: 'center',
                letterSpacing: '-0.5px',
              }}
            >
              Annuler la commande
            </h2>
            
            <p 
              style={{
                fontSize: '15px',
                color: colors.neutral[600],
                marginBottom: '32px',
                lineHeight: '1.6',
                textAlign: 'center',
              }}
            >
              Cette commande a été approuvée. Voulez-vous restaurer le stock pour la commande annulée ?
            </p>
            
            <div 
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <button
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: isCancelling ? 'not-allowed' : 'pointer',
                  border: 'none',
                  background: `linear-gradient(135deg, ${colors.primary.main}, ${colors.primary.dark})`,
                  color: 'white',
                  transition: 'all 0.2s ease',
                  minHeight: '54px',
                  letterSpacing: '0.3px',
                  boxShadow: `0 4px 12px ${colors.primary.main}40`,
                  opacity: isCancelling ? 0.6 : 1,
                }}
                onClick={() => confirmCancelOrder(true)}
                disabled={isCancelling}
                aria-label="Annuler et restaurer le stock"
                onMouseEnter={(e) => {
                  if (!isCancelling) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = `0 6px 16px ${colors.primary.main}50`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCancelling) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = `0 4px 12px ${colors.primary.main}40`;
                  }
                }}
              >
                Annuler et restaurer le stock
              </button>
              
              <button
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: isCancelling ? 'not-allowed' : 'pointer',
                  border: 'none',
                  background: `linear-gradient(135deg, ${colors.neutral[600]}, ${colors.neutral[700]})`,
                  color: 'white',
                  transition: 'all 0.2s ease',
                  minHeight: '54px',
                  letterSpacing: '0.3px',
                  boxShadow: `0 4px 12px ${colors.neutral[600]}40`,
                  opacity: isCancelling ? 0.6 : 1,
                }}
                onClick={() => confirmCancelOrder(false)}
                disabled={isCancelling}
                aria-label="Annuler sans restaurer le stock"
                onMouseEnter={(e) => {
                  if (!isCancelling) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = `0 6px 16px ${colors.neutral[600]}50`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCancelling) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = `0 4px 12px ${colors.neutral[600]}40`;
                  }
                }}
              >
                Annuler sans restaurer le stock
              </button>
              
              <button
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: isCancelling ? 'not-allowed' : 'pointer',
                  border: `2px solid ${colors.neutral[300]}`,
                  backgroundColor: 'white',
                  color: colors.neutral[700],
                  transition: 'all 0.2s ease',
                  minHeight: '54px',
                  letterSpacing: '0.3px',
                  opacity: isCancelling ? 0.6 : 1,
                }}
                onClick={() => {
                  setShowCancelPopup(false);
                  setCancelOrderId(null);
                  setIsOrderApproved(false);
                }}
                disabled={isCancelling}
                aria-label="Fermer"
                onMouseEnter={(e) => {
                  if (!isCancelling) {
                    e.target.style.backgroundColor = colors.neutral[50];
                    e.target.style.borderColor = colors.neutral[400];
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCancelling) {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.borderColor = colors.neutral[300];
                  }
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes scaleIn {
            from {
              transform: scale(0.9);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </>
  );
}

OrderCard.propTypes = {
  order: PropTypes.shape({
    id: PropTypes.number.isRequired,
    total_price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    order_type: PropTypes.string,
    table_number: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    delivery_address: PropTypes.string,
    notes: PropTypes.string,
    status: PropTypes.string,
    approved: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
    item_ids: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    item_names: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    unit_prices: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    menu_quantities: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    supplement_ids: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    supplement_names: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    supplement_prices: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    image_urls: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    breakfast_ids: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    breakfast_names: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    breakfast_quantities: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    breakfast_images: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    breakfast_option_ids: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    breakfast_option_names: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.arrayOf(PropTypes.string),
      ])),
    ]),
    breakfast_option_prices: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
      ])),
    ]),
  }).isRequired,
  onApproveOrder: PropTypes.func,
  onCancelOrder: PropTypes.func,
  timeAgo: PropTypes.string.isRequired,
  isExpanded: PropTypes.bool,
};

export default OrderCard;
