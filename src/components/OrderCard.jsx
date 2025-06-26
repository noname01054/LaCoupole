import { useState, useEffect, useRef } from 'react';
import {
  AccessTime,
  TableRestaurant,
  LocationOn,
  AttachMoney,
  RestaurantMenu,
  CheckCircle,
  Schedule,
  Restaurant,
  LocalShipping,
  ExpandMore,
  Person,
  Receipt,
  Business,
  Check,
  KeyboardArrowDown,
} from '@mui/icons-material';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';
const FALLBACK_IMAGE = 'https://via.placeholder.com/40?text=No+Image';

function OrderCard({ order, onUpdateStatus, onApproveOrder, timeAgo, isExpanded: initialExpanded = false }) {
  const [status, setStatus] = useState(order.status || 'received');
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [isVisible, setIsVisible] = useState(false);
  const [itemsVisible, setItemsVisible] = useState(initialExpanded);
  const [approveButtonPressed, setApproveButtonPressed] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    setStatus(order.status || 'received');
  }, [order.status]);

  useEffect(() => {
    setIsExpanded(initialExpanded);
    setItemsVisible(initialExpanded);
  }, [initialExpanded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    if (typeof onUpdateStatus === 'function') {
      onUpdateStatus(order.id, newStatus);
    }
  };

  const handleApproveOrder = () => {
    setApproveButtonPressed(true);
    setTimeout(() => {
      if (typeof onApproveOrder === 'function') {
        onApproveOrder(order.id);
      }
      setApproveButtonPressed(false);
    }, 150);
  };

  const handleExpandToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
    setItemsVisible(!isExpanded);
  };

  const getStatusConfig = (status) => {
    const configs = {
      received: { color: '#2563eb', bgColor: '#eff6ff', icon: CheckCircle, label: 'Received', progress: 25 },
      preparing: { color: '#f59e0b', bgColor: '#fef3c7', icon: Schedule, label: 'Preparing', progress: 50 },
      ready: { color: '#10b981', bgColor: '#d1fae5', icon: Restaurant, label: 'Ready', progress: 75 },
      delivered: { color: '#6b7280', bgColor: '#f3f4f6', icon: LocalShipping, label: 'Delivered', progress: 100 },
    };
    return configs[status] || configs.received;
  };

  const statusConfig = getStatusConfig(status);
  const IconComponent = statusConfig.icon;

  const groupedItems = (() => {
    const acc = {};

    const itemIds = order.item_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const itemNames = order.item_names?.split(',') || [];
    const unitPrices = order.unit_prices?.split(',').map(price => parseFloat(price) || 0) || [];
    const menuQuantities = order.menu_quantities?.split(',').filter(q => q !== 'NULL' && !isNaN(parseInt(q))) || [];
    const supplementIds = order.supplement_ids?.split(',') || [];
    const supplementNames = order.supplement_names?.split(',') || [];
    const supplementPrices = order.supplement_prices?.split(',').map(price => parseFloat(price) || 0) || [];
    const imageUrls = order.image_urls?.split(',') || [];

    itemIds.forEach((id, idx) => {
      if (idx >= menuQuantities.length || idx >= itemNames.length || idx >= unitPrices.length) return;
      const supplementId = supplementIds[idx]?.trim() || null;
      const key = `${id.trim()}_${supplementId || 'none'}`;
      const quantity = parseInt(menuQuantities[idx], 10) || 1;

      if (!acc[key]) {
        acc[key] = {
          id: parseInt(id) || 0,
          type: 'menu',
          name: itemNames[idx]?.trim() || 'Unknown Item',
          quantity: 0,
          unitPrice: unitPrices[idx] || 0,
          supplementName: supplementId ? supplementNames[idx]?.trim() || 'Unknown Supplement' : null,
          supplementPrice: supplementId ? supplementPrices[idx] || 0 : 0,
          imageUrl: imageUrls[idx]?.trim() || null,
          options: [],
        };
      }
      acc[key].quantity += quantity;
    });

    const breakfastIds = order.breakfast_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const breakfastNames = order.breakfast_names?.split(',') || [];
    const breakfastQuantities = order.breakfast_quantities?.split(',').filter(q => q !== 'NULL' && !isNaN(parseInt(q))) || [];
    const unitPricesBreakfast = order.unit_prices?.split(',').map(price => parseFloat(price) || 0) || [];
    const breakfastImages = order.breakfast_images?.split(',') || [];
    const optionIds = order.breakfast_option_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const optionNames = order.breakfast_option_names?.split(',') || [];
    const optionPrices = order.breakfast_option_prices?.split(',').map(price => parseFloat(price) || 0) || [];

    breakfastIds.forEach((id, idx) => {
      if (idx >= breakfastQuantities.length || idx >= breakfastNames.length || idx >= unitPricesBreakfast.length) return;
      const key = id.trim();
      const quantity = parseInt(breakfastQuantities[idx], 10) || 1;

      if (!acc[key]) {
        acc[key] = {
          id: parseInt(id) || 0,
          type: 'breakfast',
          name: breakfastNames[idx]?.trim() || 'Unknown Breakfast',
          quantity: 0,
          unitPrice: unitPricesBreakfast[idx] || 0,
          imageUrl: breakfastImages[idx]?.trim() || null,
          options: [],
        };
      }
      acc[key].quantity += quantity;

      const optionsPerItem = optionIds.length / (breakfastIds.length || 1);
      const startIdx = idx * optionsPerItem;
      const endIdx = (idx + 1) * optionsPerItem;
      for (let i = startIdx; i < endIdx && i < optionIds.length; i++) {
        if (optionIds[i]) {
          acc[key].options.push({
            name: optionNames[i]?.trim() || 'Unknown Option',
            price: optionPrices[i] || 0,
          });
        }
      }
      acc[key].options = Array.from(new Set(acc[key].options.map(opt => JSON.stringify(opt))), JSON.parse);
    });

    return Object.values(acc).filter(item => item.quantity > 0);
  })();

  const styles = {
    cardContainer: {
      transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
      opacity: isVisible ? 1 : 0,
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      margin: '0 auto 16px',
      padding: '0 8px',
      maxWidth: '600px',
      width: '100%',
      boxSizing: 'border-box',
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      border: '1px solid rgba(0, 0, 0, 0.05)',
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(10px)',
    },
    cardOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
      pointerEvents: 'none',
      zIndex: 1,
    },
    header: {
      textAlign: 'center',
      marginBottom: '24px',
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
      transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.1s',
      position: 'relative',
      zIndex: 2,
    },
    orderInfo: { flex: 1 },
    orderNumber: {
      fontSize: '32px',
      fontWeight: '800',
      background: 'linear-gradient(135deg, #1c1c1e 0%, #48484a 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      margin: '0 0 12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      letterSpacing: '-0.5px',
    },
    statusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: statusConfig.bgColor,
      color: statusConfig.color,
      padding: '12px 20px',
      borderRadius: '16px',
      fontSize: '16px',
      fontWeight: '600',
      border: `2px solid ${statusConfig.color}30`,
      boxShadow: `0 4px 16px ${statusConfig.color}20`,
      transform: isVisible ? 'scale(1)' : 'scale(0.9)',
    },
    quickInfo: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: '12px',
      marginBottom: '20px',
      position: 'relative',
      zIndex: 2,
    },
    infoChip: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 16px',
      backgroundColor: 'rgba(249, 250, 251, 0.8)',
      backdropFilter: 'blur(8px)',
      borderRadius: '12px',
      fontSize: '14px',
      color: '#374151',
      border: '1px solid rgba(229, 231, 235, 0.5)',
    },
    infoValue: {
      fontWeight: '600',
      color: '#111827',
    },
    deliveryAlert: {
      backgroundColor: 'rgba(254, 243, 199, 0.9)',
      border: '2px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '16px',
      padding: '16px',
      marginBottom: '20px',
      backdropFilter: 'blur(8px)',
      position: 'relative',
      zIndex: 2,
    },
    deliveryText: {
      fontSize: '14px',
      color: '#92400e',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
    },
    contentSection: {
      padding: '0',
      backgroundColor: 'transparent',
      position: 'relative',
      zIndex: 2,
    },
    sectionTitle: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#1c1c1e',
      margin: '0 0 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    itemsList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    itemRow: {
      display: 'flex',
      alignItems: 'center',
      padding: '16px',
      backgroundColor: 'rgba(250, 250, 250, 0.8)',
      backdropFilter: 'blur(8px)',
      borderRadius: '16px',
      gap: '16px',
      opacity: itemsVisible ? 1 : 0,
      transform: itemsVisible ? 'translateX(0)' : 'translateX(-20px)',
      border: '1px solid rgba(229, 231, 235, 0.3)',
    },
    itemImage: {
      width: '56px',
      height: '56px',
      borderRadius: '12px',
      objectFit: 'cover',
      flexShrink: 0,
      border: '2px solid rgba(255, 255, 255, 0.8)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    },
    itemDetails: {
      flex: 1,
      overflow: 'hidden',
    },
    itemName: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#1c1c1e',
      marginBottom: '6px',
      display: 'block',
      lineHeight: '1.3',
    },
    itemOption: {
      fontSize: '14px',
      color: '#6b7280',
      display: 'block',
      marginBottom: '3px',
      fontWeight: '500',
    },
    itemPrice: {
      fontSize: '15px',
      fontWeight: '700',
      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      marginTop: '6px',
      display: 'block',
    },
    quantityBadge: {
      backgroundColor: '#e5e7eb',
      color: '#374151',
      padding: '8px 12px',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: '600',
      minWidth: '32px',
      textAlign: 'center',
      border: '2px solid rgba(255, 255, 255, 0.8)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    },
    totalSection: {
      borderTop: '2px solid rgba(229, 231, 235, 0.3)',
      paddingTop: '20px',
      marginTop: '20px',
      position: 'relative',
      zIndex: 2,
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '18px',
      fontWeight: '700',
      color: '#1c1c1e',
      padding: '16px',
      backgroundColor: 'rgba(249, 250, 251, 0.6)',
      borderRadius: '16px',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(229, 231, 235, 0.3)',
    },
    totalValue: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      fontSize: '20px',
    },
    approveSection: {
      borderTop: '2px solid rgba(229, 231, 235, 0.3)',
      paddingTop: '24px',
      marginTop: '20px',
      backgroundColor: 'transparent',
      position: 'relative',
      zIndex: 2,
    },
    approveButton: {
      backgroundColor: order.approved ? '#10b981' : '#059669',
      color: 'white',
      border: 'none',
      borderRadius: '20px',
      padding: '16px 32px',
      fontSize: '16px',
      fontWeight: '700',
      cursor: order.approved ? 'default' : 'pointer',
      width: '100%',
      maxWidth: '320px',
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      boxShadow: '0 8px 24px rgba(5, 150, 105, 0.3)',
      transform: approveButtonPressed ? 'scale(0.95)' : 'scale(1)',
      opacity: order.approved ? 0.8 : 1,
    },
    expandButton: {
      backgroundColor: 'rgba(249, 250, 251, 0.8)',
      color: '#374151',
      border: '1px solid rgba(229, 231, 235, 0.5)',
      borderRadius: '16px',
      padding: '12px 24px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginBottom: '20px',
    },
    expandIcon: {
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
    },
    expandedContent: {
      display: isExpanded ? 'block' : 'none',
      marginTop: '20px',
    },
    '@media (max-width: 768px)': {
      cardContainer: { padding: '0 12px', margin: '0 auto 20px' },
      card: { padding: '20px', borderRadius: '18px' },
      orderNumber: { fontSize: '28px', letterSpacing: '-0.3px' },
      statusBadge: { fontSize: '15px', padding: '10px 16px', borderRadius: '14px' },
      quickInfo: { gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' },
      infoChip: { padding: '10px 12px', fontSize: '13px', borderRadius: '10px' },
      itemRow: { padding: '14px', gap: '12px', borderRadius: '14px' },
      itemImage: { width: '48px', height: '48px', borderRadius: '10px' },
      itemName: { fontSize: '15px' },
      itemOption: { fontSize: '13px' },
      itemPrice: { fontSize: '14px' },
      quantityBadge: { fontSize: '12px', padding: '6px 10px', borderRadius: '16px' },
      totalRow: { fontSize: '16px', padding: '14px' },
      totalValue: { fontSize: '18px' },
      approveButton: { padding: '14px 28px', fontSize: '15px', borderRadius: '18px' },
      expandButton: { padding: '10px 20px', fontSize: '14px', borderRadius: '14px' },
    },
    '@media (max-width: 480px)': {
      cardContainer: { padding: '0 8px' },
      card: { padding: '16px', borderRadius: '16px' },
      orderNumber: { fontSize: '24px' },
      statusBadge: { fontSize: '14px', padding: '8px 14px' },
      quickInfo: { gridTemplateColumns: '1fr', gap: '8px' },
      infoChip: { padding: '8px 12px', fontSize: '12px' },
      itemRow: { padding: '12px', gap: '10px', borderRadius: '12px' },
      itemImage: { width: '44px', height: '44px' },
      itemName: { fontSize: '14px' },
      itemOption: { fontSize: '12px' },
      itemPrice: { fontSize: '13px' },
      deliveryAlert: { padding: '12px', borderRadius: '12px' },
      deliveryText: { fontSize: '13px' },
      totalRow: { fontSize: '15px', padding: '12px' },
      approveButton: { padding: '12px 24px', fontSize: '14px', borderRadius: '16px' },
      expandButton: { padding: '8px 16px', fontSize: '13px', borderRadius: '12px' },
    },
    '@media (max-width: 360px)': {
      orderNumber: { fontSize: '22px' },
      itemRow: { flexDirection: 'column', alignItems: 'flex-start', padding: '10px', textAlign: 'left' },
      itemImage: { width: '100%', height: 'auto', maxWidth: '120px', borderRadius: '8px', alignSelf: 'center' },
      itemDetails: { width: '100%', textAlign: 'center', marginTop: '8px' },
      quantityBadge: { alignSelf: 'center', marginTop: '8px' },
    },
  };

  return (
    <div style={styles.cardContainer}>
      <div ref={cardRef} style={styles.card}>
        <div style={styles.cardOverlay}></div>
        
        <div style={styles.header}>
          <h3 style={styles.orderNumber}>Order #{order.id}</h3>
          <div style={styles.statusBadge}>
            <IconComponent sx={{ fontSize: 16 }} />
            {statusConfig.label}
          </div>
        </div>

        <div style={styles.quickInfo}>
          {[
            { icon: TableRestaurant, label: 'Table', value: order.table_number || 'N/A' },
            { icon: AccessTime, label: '', value: timeAgo },
            { icon: Business, label: '', value: order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1) }
          ].map((info, index) => (
            <div 
              key={index} 
              style={{ ...styles.infoChip, transitionDelay: `${index * 0.1}s` }}
            >
              <info.icon sx={{ fontSize: 16, color: '#6b7280' }} />
              <span>
                {info.label && <>{info.label} </>}
                <span style={styles.infoValue}>{info.value}</span>
              </span>
            </div>
          ))}
        </div>

        {order.delivery_address && (
          <div style={styles.deliveryAlert}>
            <div style={styles.deliveryText}>
              <LocationOn sx={{ fontSize: 18, flexShrink: 0, marginTop: '1px' }} />
              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>Delivery Order</div>
                <div>{order.delivery_address}</div>
              </div>
            </div>
          </div>
        )}

        <button style={styles.expandButton} onClick={handleExpandToggle}>
          <span>{isExpanded ? 'Show Less' : 'View Order Details'}</span>
          <ExpandMore sx={{ fontSize: 18, ...styles.expandIcon }} />
        </button>

        <div style={styles.expandedContent}>
          <div style={styles.contentSection}>
            <div style={styles.sectionTitle}>
              <Receipt sx={{ fontSize: 20, color: '#6b7280' }} />
              Order Items
            </div>

            <div style={styles.itemsList}>
              {groupedItems.length > 0 ? groupedItems.map((item, index) => {
                const imageUrl = item.imageUrl
                  ? `${BACKEND_URL}${item.imageUrl.startsWith('/') ? '' : '/'}${item.imageUrl}`
                  : null;
                const totalOptionsPrice = (item.options || []).reduce((sum, opt) => sum + opt.price, 0);
                const itemTotalPrice = (item.unitPrice + totalOptionsPrice) * item.quantity;

                return (
                  <div
                    key={`${item.type}-${item.id}-${index}`}
                    style={{ ...styles.itemRow, transitionDelay: `${index * 0.1}s` }}
                  >
                    <img
                      src={imageUrl || FALLBACK_IMAGE}
                      alt={item.name}
                      style={styles.itemImage}
                      onError={(e) => (e.target.src = FALLBACK_IMAGE)}
                    />
                    <div style={styles.itemDetails}>
                      <span style={styles.itemName}>{item.name}</span>
                      {item.supplementName && (
                        <span style={styles.itemOption}>
                          + {item.supplementName} {item.supplementPrice > 0 && `(+$${item.supplementPrice.toFixed(2)})`}
                        </span>
                      )}
                      {(item.options || []).map((opt, optIdx) => (
                        <span key={optIdx} style={styles.itemOption}>
                          + {opt.name} (+${opt.price.toFixed(2)})
                        </span>
                      ))}
                      <span style={styles.itemPrice}>${itemTotalPrice.toFixed(2)} x {item.quantity}</span>
                    </div>
                    <span style={styles.quantityBadge}>{item.quantity}</span>
                  </div>
                );
              }) : <div style={styles.itemRow}>No valid items to display</div>}
            </div>
          </div>

          <div style={styles.totalSection}>
            <div style={styles.totalRow}>
              <span>Total</span>
              <span style={styles.totalValue}>${parseFloat(order.total_price || 0).toFixed(2)}</span>
            </div>
          </div>

          {!order.approved && (
            <div style={styles.approveSection}>
              <button
                style={styles.approveButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleApproveOrder();
                }}
                disabled={order.approved}
              >
                <Check sx={{ fontSize: 18 }} />
                {order.approved ? 'Order Approved' : 'Approve Order'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderCard;