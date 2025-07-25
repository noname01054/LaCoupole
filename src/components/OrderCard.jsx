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
} from '@mui/icons-material';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';
const FALLBACK_IMAGE = 'https://via.placeholder.com/40?text=Aucune+Image';

// Helper function to safely parse numbers
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

// Simple status for pending/approved/cancelled orders
const getOrderStatus = (approved, status) => {
  if (status === 'cancelled') {
    return {
      color: '#ef4444',
      bgColor: '#fee2e2',
      icon: Cancel,
      label: 'Annulée',
      urgency: 'high',
    };
  }
  return {
    color: approved ? '#10b981' : '#f59e0b',
    bgColor: approved ? '#d1fae5' : '#fef3c7',
    icon: approved ? Check : AccessTime,
    label: approved ? 'Approuvée' : 'En attente',
    urgency: approved ? 'none' : 'high',
  };
};

// Map order_type to display text and icon
const getOrderTypeDisplay = (orderType, tableNumber) => {
  switch (orderType) {
    case 'local':
      return {
        text: `Tableau ${tableNumber || 'N/A'}`,
        icon: TableRestaurant,
      };
    case 'delivery':
      return {
        text: 'Livraison',
        icon: LocalShipping,
      };
    case 'imported':
      return {
        text: 'À emporter',
        icon: Restaurant,
      };
    default:
      return {
        text: 'Inconnu',
        icon: Restaurant,
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
  const cardRef = useRef(null);

  // Memoize grouped items to prevent quantity/price doubling
  const groupedItems = useMemo(() => {
    const acc = {};

    // Process menu items
    const itemIds = Array.isArray(order.item_ids) ? order.item_ids : (order.item_ids?.split(',') || []).filter(id => id?.trim() && !isNaN(parseInt(id)));
    const itemNames = Array.isArray(order.item_names) ? order.item_names : order.item_names?.split(',') || [];
    const unitPrices = Array.isArray(order.unit_prices) ? order.unit_prices : order.unit_prices?.split(',') || [];
    const menuQuantities = Array.isArray(order.menu_quantities) ? order.menu_quantities : (order.menu_quantities?.split(',') || []).filter(q => q !== 'NULL' && q?.trim());
    const supplementIds = Array.isArray(order.supplement_ids) ? order.supplement_ids : order.supplement_ids?.split(',') || [];
    const supplementNames = Array.isArray(order.supplement_names) ? order.supplement_names : order.supplement_names?.split(',') || [];
    const supplementPrices = Array.isArray(order.supplement_prices) ? order.supplement_prices : order.supplement_prices?.split(',') || [];
    const imageUrls = Array.isArray(order.image_urls) ? order.image_urls : order.image_urls?.split(',') || [];

    itemIds.forEach((id, idx) => {
      if (idx >= menuQuantities.length || idx >= itemNames.length || idx >= unitPrices.length) return;

      const supplementId = supplementIds[idx]?.trim() || null;
      const key = `${id.trim()}_${supplementId || 'none'}`;
      const quantity = safeParseInt(menuQuantities[idx], 1);
      const unitPrice = safeParseFloat(unitPrices[idx], 0);
      const supplementPrice = supplementId ? safeParseFloat(supplementPrices[idx], 0) : 0;

      if (!acc[key]) {
        acc[key] = {
          id: safeParseInt(id, 0),
          type: 'menu',
          name: itemNames[idx]?.trim() || 'Article inconnu',
          quantity: 0,
          unitPrice,
          supplementName: supplementId ? supplementNames[idx]?.trim() || 'Supplément inconnu' : null,
          supplementPrice,
          imageUrl: imageUrls[idx]?.trim() || null,
          options: [],
        };
      }
      acc[key].quantity = quantity; // Set quantity directly to avoid accumulation
    });

    // Process breakfast items
    const breakfastIds = Array.isArray(order.breakfast_ids) ? order.breakfast_ids : (order.breakfast_ids?.split(',') || []).filter(id => id?.trim() && !isNaN(parseInt(id)));
    const breakfastNames = Array.isArray(order.breakfast_names) ? order.breakfast_names : order.breakfast_names?.split(',') || [];
    const breakfastQuantities = Array.isArray(order.breakfast_quantities) ? order.breakfast_quantities : (order.breakfast_quantities?.split(',') || []).filter(q => q !== 'NULL' && q?.trim());
    const breakfastImages = Array.isArray(order.breakfast_images) ? order.breakfast_images : order.breakfast_images?.split(',') || [];
    const optionIds = Array.isArray(order.breakfast_option_ids) ? order.breakfast_option_ids : (order.breakfast_option_ids?.split(',') || []).filter(id => id?.trim() && !isNaN(parseInt(id)));
    const optionNames = Array.isArray(order.breakfast_option_names) ? order.breakfast_option_names : order.breakfast_option_names?.split(',') || [];
    const optionPrices = Array.isArray(order.breakfast_option_prices) ? order.breakfast_option_prices : order.breakfast_option_prices?.split(',') || [];

    breakfastIds.forEach((id, index) => {
      if (index >= breakfastQuantities.length || index >= breakfastNames.length || index >= unitPrices.length) return;

      const key = id.trim();
      const quantity = safeParseInt(breakfastQuantities[index], 1);
      const unitPrice = safeParseFloat(unitPrices[index], 0);

      if (!acc[key]) {
        acc[key] = {
          id: safeParseInt(id, 0),
          type: 'breakfast',
          name: breakfastNames[index]?.trim() || 'Petit-déjeuner inconnu',
          quantity: 0,
          unitPrice,
          imageUrl: breakfastImages[index]?.trim() || null,
          options: [],
        };
      }
      acc[key].quantity = quantity; // Set quantity directly to avoid accumulation

      // Add options for breakfast items
      const optionsPerItem = breakfastIds.length ? Math.floor(optionIds.length / breakfastIds.length) : 0;
      const startIdx = index * optionsPerItem;
      const endIdx = (index + 1) * optionsPerItem;
      const itemOptionNames = optionNames[index] || [];
      const itemOptionPrices = optionPrices[index] || [];

      // Handle optionNames as either an array of names or a pipe-separated string
      const names = Array.isArray(itemOptionNames)
        ? itemOptionNames
        : typeof itemOptionNames === 'string' && itemOptionNames
        ? itemOptionNames.split('|').map((name) => name?.trim() || 'Option inconnue')
        : [];

      // Handle optionPrices as either an array of prices or a pipe-separated string
      const prices = Array.isArray(itemOptionPrices)
        ? itemOptionPrices.map((price) => safeParseFloat(price, 0))
        : typeof itemOptionPrices === 'string' && itemOptionPrices
        ? itemOptionPrices.split('|').map((price) => safeParseFloat(price, 0))
        : [];

      // Ensure options are added only for valid indices
      for (let i = 0; i < Math.min(names.length, prices.length); i++) {
        acc[key].options.push({
          name: names[i] || 'Option inconnue',
          price: prices[i] || 0,
        });
      }
      // Remove duplicates
      acc[key].options = Array.from(new Set(acc[key].options.map(opt => JSON.stringify(opt))), JSON.parse);
    });

    return Object.values(acc).filter(item => item.quantity > 0);
  }, [order]);

  const statusConfig = getOrderStatus(order.approved, order.status);
  const IconComponent = statusConfig.icon;
  const OrderTypeIcon = getOrderTypeDisplay(order.order_type, order.table_number).icon;

  // Event handlers
  const handleApproveOrder = async () => {
    setIsApproving(true);
    try {
      await onApproveOrder?.(order.id);
      toast.success('Order approved successfully');
    } catch (error) {
      console.error('Error approving order:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Failed to approve order');
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
        toast.success('Order cancelled successfully');
      }
    } catch (error) {
      console.error('Error checking order status:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Failed to check order status');
    } finally {
      setIsCancelling(false);
    }
  };

  const confirmCancelOrder = async (restoreStock) => {
    setIsCancelling(true);
    try {
      await onCancelOrder?.(cancelOrderId, { restoreStock });
      toast.success(`Order ${restoreStock ? 'cancelled with stock restoration' : 'cancelled without stock restoration'}`);
      setShowCancelPopup(false);
      setCancelOrderId(null);
      setIsOrderApproved(false);
    } catch (error) {
      console.error('Error cancelling order:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
  };

  // Calculate total with safe parsing
  const orderTotal = safeParseFloat(order.total_price, 0);

  // Optimized styles
  const cardStyle = {
    maxWidth: '600px',
    margin: '0 auto 16px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: `2px solid ${statusConfig.color}20`,
    boxShadow: statusConfig.urgency === 'high' 
      ? `0 4px 20px ${statusConfig.color}30` 
      : '0 2px 12px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s ease',
    position: 'relative',
  };

  const headerStyle = {
    background: `linear-gradient(135deg, ${statusConfig.color}10, ${statusConfig.bgColor})`,
    padding: '20px',
    borderBottom: `1px solid ${statusConfig.color}20`,
  };

  const orderInfoStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  };

  const orderNumberStyle = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: 0,
  };

  const statusBadgeStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: statusConfig.color,
    color: 'white',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const quickInfoStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
  };

  const infoChipStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#555',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  };

  const bodyStyle = {
    padding: '20px',
  };

  const deliveryAlertStyle = order.delivery_address ? {
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  } : { display: 'none' };

  const notesAlertStyle = order.notes ? {
    backgroundColor: '#e6f3ff',
    border: '1px solid #3b82f6',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  } : { display: 'none' };

  const expandButtonStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    marginBottom: isExpanded ? '20px' : '0',
    transition: 'all 0.2s ease',
  };

  const itemsListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
  };

  const itemRowStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    gap: '12px',
  };

  const itemImageStyle = {
    width: '48px',
    height: '48px',
    borderRadius: '6px',
    objectFit: 'cover',
    flexShrink: 0,
  };

  const itemDetailsStyle = {
    flex: 1,
    minWidth: 0,
  };

  const itemNameStyle = {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '4px',
    display: 'block',
  };

  const itemOptionStyle = {
    fontSize: '13px',
    color: '#6b7280',
    display: 'block',
    marginBottom: '2px',
  };

  const quantityBadgeStyle = {
    backgroundColor: '#e5e7eb',
    color: '#374151',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    minWidth: '24px',
    textAlign: 'center',
  };

  const totalSectionStyle = {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '16px',
    marginTop: '16px',
  };

  const totalRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a1a',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  };

  const totalValueStyle = {
    color: '#059669',
    fontSize: '20px',
  };

  const actionSectionStyle = {
    marginTop: '16px',
    display: 'flex',
    gap: '12px',
  };

  const approveButtonStyle = {
    flex: 1,
    padding: '16px 20px',
    backgroundColor: order.approved && order.status !== 'cancelled' ? '#10b981' : '#059669',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: (order.approved && order.status !== 'cancelled') || isApproving ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    opacity: (order.approved && order.status !== 'cancelled') || isApproving ? 0.7 : 1,
    transform: isApproving ? 'scale(0.98)' : 'scale(1)',
    transition: 'all 0.1s ease',
    boxShadow: (order.approved && order.status !== 'cancelled') || isApproving ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)',
  };

  const cancelButtonStyle = {
    flex: 1,
    padding: '16px 20px',
    backgroundColor: order.status === 'cancelled' ? '#ef4444' : '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: order.status === 'cancelled' || isCancelling ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    opacity: order.status === 'cancelled' || isCancelling ? 0.7 : 1,
    transform: isCancelling ? 'scale(0.98)' : 'scale(1)',
    transition: 'all 0.1s ease',
    boxShadow: order.status === 'cancelled' || isCancelling ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)',
  };

  const popupStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const popupContentStyle = {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    maxWidth: '400px',
    width: '90%',
  };

  const popupTitleStyle = {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#1a1a1a',
  };

  const popupTextStyle = {
    fontSize: '14px',
    color: '#374151',
    marginBottom: '16px',
  };

  const popupButtonContainerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  };

  const popupButtonStyle = {
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
  };

  const cancelWithoutStockButtonStyle = {
    ...popupButtonStyle,
    backgroundColor: '#6b7280',
    color: 'white',
  };

  const cancelWithStockButtonStyle = {
    ...popupButtonStyle,
    backgroundColor: '#3b82f6',
    color: 'white',
  };

  const closeButtonStyle = {
    ...popupButtonStyle,
    backgroundColor: '#ef4444',
    color: 'white',
  };

  return (
    <div style={cardStyle} ref={cardRef} role="region" aria-label={`Order ${order.id}`}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={orderInfoStyle}>
          <h3 style={orderNumberStyle}>Commande #{order.id}</h3>
          <div style={statusBadgeStyle} role="status">
            <IconComponent sx={{ fontSize: 16 }} />
            {statusConfig.label}
          </div>
        </div>

        <div style={quickInfoStyle}>
          {order.order_type === 'local' && (
            <div style={infoChipStyle}>
              <TableRestaurant sx={{ fontSize: 16 }} />
              <span>Tableau {order.table_number || 'N/A'}</span>
            </div>
          )}
          {order.order_type === 'delivery' && (
            <div style={infoChipStyle}>
              <LocalShipping sx={{ fontSize: 16 }} />
              <span>Livraison</span>
            </div>
          )}
          {order.order_type === 'imported' && (
            <div style={infoChipStyle}>
              <Restaurant sx={{ fontSize: 16 }} />
              <span>À emporter</span>
            </div>
          )}
          <div style={infoChipStyle}>
            <AccessTime sx={{ fontSize: 16 }} />
            <span>{timeAgo}</span>
          </div>
          <div style={infoChipStyle}>
            <Schedule sx={{ fontSize: 16 }} />
            <span>{order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || 'Reçue'}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {/* Delivery Alert */}
        {order.delivery_address && (
          <div style={deliveryAlertStyle} role="alert">
            <LocationOn sx={{ fontSize: 18, color: '#f59e0b' }} />
            <div>
              <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '2px' }}>
                Commande de livraison
              </div>
              <div style={{ fontSize: '13px', color: '#92400e' }}>
                {order.delivery_address}
              </div>
            </div>
          </div>
        )}

        {/* Notes Alert */}
        {order.notes && (
          <div style={notesAlertStyle} role="alert">
            <Note sx={{ fontSize: 18, color: '#3b82f6' }} />
            <div>
              <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '2px' }}>
                Instructions spéciales
              </div>
              <div style={{ fontSize: '13px', color: '#1e40af' }}>
                {order.notes}
              </div>
            </div>
          </div>
        )}

        {/* Expand Button */}
        <button
          style={expandButtonStyle}
          onClick={handleExpandToggle}
          aria-expanded={isExpanded}
          aria-controls={`order-details-${order.id}`}
        >
          <Receipt sx={{ fontSize: 16 }} />
          <span>{isExpanded ? 'Masquer les détails' : `Voir les articles (${groupedItems.length})`}</span>
          <ExpandMore
            sx={{
              fontSize: 16,
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div id={`order-details-${order.id}`}>
            {/* Items List */}
            <div style={itemsListStyle}>
              {groupedItems.length > 0 ? (
                groupedItems.map((item, index) => {
                  const imageUrl = item.imageUrl || FALLBACK_IMAGE;

                  return (
                    <div
                      key={`${item.type}-${item.id}-${index}`}
                      style={itemRowStyle}
                      role="listitem"
                    >
                      <img
                        src={imageUrl}
                        alt={item.name}
                        style={itemImageStyle}
                        onError={(e) => {
                          console.error('Error loading order item image:', imageUrl);
                          e.target.src = FALLBACK_IMAGE;
                        }}
                        loading="lazy"
                      />
                      <div style={itemDetailsStyle}>
                        <span style={itemNameStyle}>{item.name}</span>
                        {item.supplementName && (
                          <span style={itemOptionStyle}>
                            + {item.supplementName}
                          </span>
                        )}
                        {(item.options || []).map((opt, optIdx) => (
                          <span key={optIdx} style={itemOptionStyle}>
                            + {opt.name}
                          </span>
                        ))}
                      </div>
                      <span style={quantityBadgeStyle}>{item.quantity}</span>
                    </div>
                  );
                })
              ) : (
                <div style={itemRowStyle}>
                  <div style={itemDetailsStyle}>Aucun article à afficher</div>
                </div>
              )}
            </div>

            {/* Total Section */}
            <div style={totalSectionStyle}>
              <div style={totalRowStyle}>
                <span>Montant total</span>
                <span style={totalValueStyle}>{orderTotal.toFixed(2)} DT</span>
              </div>
            </div>

            {/* Action Section */}
            <div style={actionSectionStyle}>
              <button
                style={approveButtonStyle}
                onClick={handleApproveOrder}
                disabled={isApproving || (order.approved && order.status !== 'cancelled')}
                aria-label="Approve order"
              >
                <Check sx={{ fontSize: 18 }} />
                {isApproving ? 'Approbation...' : 'Accepter la commande'}
              </button>
              <button
                style={cancelButtonStyle}
                onClick={handleCancelOrder}
                disabled={isCancelling || order.status === 'cancelled'}
                aria-label="Cancel order"
              >
                <Cancel sx={{ fontSize: 18 }} />
                {isCancelling ? 'Annulation...' : 'Annuler la commande'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancellation Popup */}
      {showCancelPopup && (
        <div style={popupStyle} role="dialog" aria-labelledby="cancel-popup-title">
          <div style={popupContentStyle}>
            <h2 id="cancel-popup-title" style={popupTitleStyle}>
              Cancel Order
            </h2>
            <p style={popupTextStyle}>
              This order has been approved. Would you like to restore the stock for the cancelled order?
            </p>
            <div style={popupButtonContainerStyle}>
              <button
                style={cancelWithoutStockButtonStyle}
                onClick={() => confirmCancelOrder(false)}
                disabled={isCancelling}
                aria-label="Cancel order without restoring stock"
              >
                Cancel Without Restoring Stock
              </button>
              <button
                style={cancelWithStockButtonStyle}
                onClick={() => confirmCancelOrder(true)}
                disabled={isCancelling}
                aria-label="Cancel order and restore stock"
              >
                Cancel and Restore Stock
              </button>
              <button
                style={closeButtonStyle}
                onClick={() => {
                  setShowCancelPopup(false);
                  setCancelOrderId(null);
                  setIsOrderApproved(false);
                }}
                disabled={isCancelling}
                aria-label="Close cancellation popup"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
