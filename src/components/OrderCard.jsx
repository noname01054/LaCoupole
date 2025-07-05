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
  CheckCircle,
} from '@mui/icons-material';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';
const FALLBACK_IMAGE = 'https://via.placeholder.com/40?text=No+Image';

// Helper function to safely parse numbers
const safeParseFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '' || value === 'NULL') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '' || value === 'NULL') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Simple status for pending/approved orders
const getOrderStatus = (approved) => ({
  color: approved ? '#10b981' : '#f59e0b',
  bgColor: approved ? '#d1fae5' : '#fef3c7',
  icon: approved ? Check : AccessTime,
  label: approved ? 'Approved' : 'Pending',
  urgency: approved ? 'none' : 'high'
});

function OrderCard({ 
  order, 
  onApproveOrder, 
  timeAgo, 
  isExpanded: initialExpanded = false 
}) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [isApproving, setIsApproving] = useState(false);
  const cardRef = useRef(null);

  // Memoize expensive calculations
  const groupedItems = useMemo(() => {
    const acc = {};

    // Process menu items
    const itemIds = order.item_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const itemNames = order.item_names?.split(',') || [];
    const menuQuantities = order.menu_quantities?.split(',').filter(q => q !== 'NULL' && q?.trim()) || [];
    const supplementIds = order.supplement_ids?.split(',') || [];
    const supplementNames = order.supplement_names?.split(',') || [];
    const imageUrls = order.image_urls?.split(',') || [];

    itemIds.forEach((id, idx) => {
      if (idx >= menuQuantities.length || idx >= itemNames.length) return;
      
      const supplementId = supplementIds[idx]?.trim() || null;
      const key = `${id.trim()}_${supplementId || 'none'}`;
      const quantity = safeParseInt(menuQuantities[idx], 1);

      if (!acc[key]) {
        acc[key] = {
          id: safeParseInt(id, 0),
          type: 'menu',
          name: itemNames[idx]?.trim() || 'Unknown Item',
          quantity: 0,
          imageUrl: imageUrls[idx]?.trim() || null,
          options: [],
        };
      }
      acc[key].quantity += quantity;
    });

    // Process breakfast items
    const breakfastIds = order.breakfast_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const breakfastNames = order.breakfast_names?.split(',') || [];
    const breakfastQuantities = order.breakfast_quantities?.split(',').filter(q => q !== 'NULL' && q?.trim()) || [];
    const breakfastImages = order.breakfast_images?.split(',') || [];
    const optionIds = order.breakfast_option_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const optionNames = order.breakfast_option_names?.split(',') || [];

    breakfastIds.forEach((id, idx) => {
      if (idx >= breakfastQuantities.length || idx >= breakfastNames.length) return;
      
      const key = id.trim();
      const quantity = safeParseInt(breakfastQuantities[idx], 1);

      if (!acc[key]) {
        acc[key] = {
          id: safeParseInt(id, 0),
          type: 'breakfast',
          name: breakfastNames[idx]?.trim() || 'Unknown Breakfast',
          quantity: 0,
          imageUrl: breakfastImages[idx]?.trim() || null,
          options: [],
        };
      }
      acc[key].quantity += quantity;

      // Add options for breakfast items
      const optionsPerItem = optionIds.length / (breakfastIds.length || 1);
      const startIdx = Math.floor(idx * optionsPerItem);
      const endIdx = Math.floor((idx + 1) * optionsPerItem);
      for (let i = startIdx; i < endIdx && i < optionIds.length; i++) {
        if (optionIds[i]) {
          acc[key].options.push({
            name: optionNames[i]?.trim() || 'Unknown Option',
          });
        }
      }
      // Remove duplicates using a Set based on name
      acc[key].options = Array.from(new Set(acc[key].options.map(opt => opt.name))).map(name => ({ name }));
    });

    return Object.values(acc).filter(item => item.quantity > 0);
  }, [order]);

  const statusConfig = getOrderStatus(order.approved);
  const IconComponent = statusConfig.icon;

  // Event handlers
  const handleApproveOrder = async () => {
    setIsApproving(true);
    try {
      await onApproveOrder?.(order.id);
    } finally {
      setTimeout(() => setIsApproving(false), 500);
    }
  };

  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
  };

  // Calculate total with safe parsing
  const orderTotal = safeParseFloat(order.total_price, 0);

  // Optimized styles object
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
    minWidth: 0, // Prevents flex item from overflowing
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
  };

  const approveButtonStyle = {
    width: '100%',
    padding: '16px 20px',
    backgroundColor: order.approved ? '#10b981' : '#059669',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: order.approved ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    opacity: order.approved ? 0.7 : 1,
    transform: isApproving ? 'scale(0.98)' : 'scale(1)',
    transition: 'all 0.1s ease',
    boxShadow: order.approved ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)',
  };

  return (
    <div style={cardStyle} ref={cardRef}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={orderInfoStyle}>
          <h3 style={orderNumberStyle}>Order #{order.id}</h3>
          <div style={statusBadgeStyle}>
            <IconComponent sx={{ fontSize: 16 }} />
            {statusConfig.label}
          </div>
        </div>

        <div style={quickInfoStyle}>
          <div style={infoChipStyle}>
            <TableRestaurant sx={{ fontSize: 16 }} />
            <span>Table {order.table_number || 'N/A'}</span>
          </div>
          <div style={infoChipStyle}>
            <AccessTime sx={{ fontSize: 16 }} />
            <span>{timeAgo}</span>
          </div>
          <div style={infoChipStyle}>
            <span>{order.order_type?.charAt(0).toUpperCase() + order.order_type?.slice(1) || 'Dine-in'}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {/* Delivery Alert */}
        {order.delivery_address && (
          <div style={deliveryAlertStyle}>
            <LocationOn sx={{ fontSize: 18, color: '#f59e0b' }} />
            <div>
              <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '2px' }}>
                Delivery Order
              </div>
              <div style={{ fontSize: '13px', color: '#92400e' }}>
                {order.delivery_address}
              </div>
            </div>
          </div>
        )}

        {/* Expand Button */}
        <button style={expandButtonStyle} onClick={handleExpandToggle}>
          <Receipt sx={{ fontSize: 16 }} />
          <span>{isExpanded ? 'Hide Details' : `View Items (${groupedItems.length})`}</span>
          <ExpandMore 
            sx={{ 
              fontSize: 16, 
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }} 
          />
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <>
            {/* Items List */}
            <div style={itemsListStyle}>
              {groupedItems.length > 0 ? groupedItems.map((item, index) => {
                const imageUrl = item.imageUrl
                  ? `${BACKEND_URL}${item.imageUrl.startsWith('/') ? '' : '/'}${item.imageUrl}`
                  : FALLBACK_IMAGE;

                return (
                  <div key={`${item.type}-${item.id}-${index}`} style={itemRowStyle}>
                    <img
                      src={imageUrl}
                      alt={item.name}
                      style={itemImageStyle}
                      onError={(e) => (e.target.src = FALLBACK_IMAGE)}
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
              }) : (
                <div style={itemRowStyle}>
                  <div style={itemDetailsStyle}>No items to display</div>
                </div>
              )}
            </div>

            {/* Total Section */}
            <div style={totalSectionStyle}>
              <div style={totalRowStyle}>
                <span>Total Amount</span>
                <span style={totalValueStyle}>${orderTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Section */}
            {!order.approved && (
              <div style={actionSectionStyle}>
                <button
                  style={approveButtonStyle}
                  onClick={handleApproveOrder}
                  disabled={isApproving || order.approved}
                >
                  <Check sx={{ fontSize: 18 }} />
                  {isApproving ? 'Approving Order...' : 'Accept Order'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default OrderCard;
