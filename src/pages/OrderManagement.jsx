import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { initSocket } from '../services/socket';
import './css/OrderManagement.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000';
const FALLBACK_IMAGE = 'https://via.placeholder.com/48?text=No+Image';

function OrderManagement() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await api.get('/check-auth');
        if (res.data.role !== 'admin') {
          toast.error('Admin access required');
          navigate('/login');
        } else {
          setUser(res.data);
        }
      } catch (err) {
        console.error('Auth check failed:', err.response?.data || err.message);
        toast.error(err.response?.data?.error || 'Please log in');
        navigate('/login');
      }
    }

    async function fetchOrders() {
      try {
        const query = dateFilter !== 'all' ? `?time_range=${dateFilter}` : '';
        const res = await api.get(`/orders${query}`);
        const ordersArray = Array.isArray(res.data.data) ? res.data.data : [];
        const processedOrders = ordersArray.map(order => ({
          ...order,
          item_ids: order.item_ids
            ? order.item_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean)
            : [],
          item_names: order.item_names
            ? order.item_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          image_urls: order.image_urls
            ? order.image_urls.split(',').map(url => url?.trim() ? `${BACKEND_URL}${url.trim()}` : FALLBACK_IMAGE).filter(Boolean)
            : [],
          quantities: order.menu_quantities
            ? order.menu_quantities.split(',').map(qty => parseInt(qty, 10)).filter(qty => !isNaN(qty))
            : [],
          unit_prices: order.unit_prices
            ? order.unit_prices.split(',').map(price => parseFloat(price)).filter(price => !isNaN(price))
            : [],
          supplement_ids: order.supplement_ids
            ? order.supplement_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean)
            : [],
          supplement_names: order.supplement_names
            ? order.supplement_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          supplement_prices: order.supplement_prices
            ? order.supplement_prices.split(',').map(price => parseFloat(price)).filter(price => !isNaN(price))
            : [],
          breakfast_ids: order.breakfast_ids
            ? order.breakfast_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean)
            : [],
          breakfast_names: order.breakfast_names
            ? order.breakfast_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          breakfast_images: order.breakfast_images
            ? order.breakfast_images.split(',').map(url => url?.trim() ? `${BACKEND_URL}${url.trim()}` : FALLBACK_IMAGE).filter(Boolean)
            : [],
          breakfast_quantities: order.breakfast_quantities
            ? order.breakfast_quantities.split(',').map(qty => parseInt(qty, 10)).filter(qty => !isNaN(qty))
            : [],
          breakfast_option_ids: order.breakfast_option_ids
            ? order.breakfast_option_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean)
            : [],
          breakfast_option_names: order.breakfast_option_names
            ? order.breakfast_option_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          breakfast_option_prices: order.breakfast_option_prices
            ? order.breakfast_option_prices.split(',').map(price => parseFloat(price)).filter(price => !isNaN(price))
            : [],
          status: order.status || (order.approved ? 'preparing' : 'pending'),
        }));
        setOrders(processedOrders);
      } catch (err) {
        console.error('Failed to load orders:', err.response?.data || err.message);
        toast.error(err.response?.data?.error || 'Failed to load orders');
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
    fetchOrders();

    const socketCleanup = initSocket(
      (order) => {
        const processedOrder = {
          ...order,
          item_ids: order.item_ids
            ? order.item_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean)
            : [],
          item_names: order.item_names
            ? order.item_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          image_urls: order.image_urls
            ? order.image_urls.split(',').map(url => url?.trim() ? `${BACKEND_URL}${url.trim()}` : FALLBACK_IMAGE).filter(Boolean)
            : [],
          quantities: order.menu_quantities
            ? order.menu_quantities.split(',').map(qty => parseInt(qty, 10)).filter(qty => !isNaN(qty))
            : [],
          unit_prices: order.unit_prices
            ? order.unit_prices.split(',').map(price => parseFloat(price)).filter(price => !isNaN(price))
            : [],
          supplement_ids: order.supplement_ids
            ? order.supplement_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean)
            : [],
          supplement_names: order.supplement_names
            ? order.supplement_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          supplement_prices: order.supplement_prices
            ? order.supplement_prices.split(',').map(price => parseFloat(price)).filter(price => !isNaN(price))
            : [],
          breakfast_ids: order.breakfast_ids
            ? order.breakfast_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean)
            : [],
          breakfast_names: order.breakfast_names
            ? order.breakfast_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          breakfast_images: order.breakfast_images
            ? order.breakfast_images.split(',').map(url => url?.trim() ? `${BACKEND_URL}${url.trim()}` : FALLBACK_IMAGE).filter(Boolean)
            : [],
          breakfast_quantities: order.breakfast_quantities
            ? order.breakfast_quantities.split(',').map(qty => parseInt(qty, 10)).filter(qty => !isNaN(qty))
            : [],
          breakfast_option_ids: order.breakfast_option_ids
            ? order.breakfast_option_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean)
            : [],
          breakfast_option_names: order.breakfast_option_names
            ? order.breakfast_option_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          breakfast_option_prices: order.breakfast_option_prices
            ? order.breakfast_option_prices.split(',').map(price => parseFloat(price)).filter(price => !isNaN(price))
            : [],
          status: order.status || (order.approved ? 'preparing' : 'pending'),
        };
        setOrders(prev => [processedOrder, ...prev]);
        toast.success(`New order #${order.id} received`);
      },
      (updatedOrder) => {
        setOrders(prev =>
          prev.map(order =>
            order.id === parseInt(updatedOrder.orderId)
              ? { ...order, status: updatedOrder.status || (updatedOrder.approved ? 'preparing' : 'pending'), approved: Number(updatedOrder.orderDetails.approved) }
              : order
          )
        );
        toast.info(`Order #${updatedOrder.orderId} updated to ${updatedOrder.status || (updatedOrder.approved ? 'preparing' : 'pending')}`);
      },
      () => {},
      () => {},
      () => {}
    );

    return () => {
      if (typeof socketCleanup === 'function') {
        socketCleanup();
      }
    };
  }, [navigate, dateFilter]);

  const handleStatusUpdate = async (orderId, status) => {
    try {
      const approved = status === 'preparing' || status === 'Approved' ? 1 : 0;
      await api.post(`/orders/${orderId}/approve`, { user_id: user.id, approved });
      setOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, status, approved } : order
        )
      );
      toast.success('Order status updated successfully');
    } catch (err) {
      console.error('Failed to update order:', err.response?.data || err.message);
      toast.error(err.response?.data?.error || 'Failed to update order status');
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await api.post(`/orders/${orderId}/cancel`, { restoreStock: true });
      setOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, status: 'cancelled', approved: 0 } : order
        )
      );
      toast.success('Order cancelled successfully');
      closeOrderDetail();
    } catch (err) {
      console.error('Failed to cancel order:', err.response?.data || err.message);
      toast.error(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  const openOrderDetail = (order) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const closeOrderDetail = () => {
    setShowOrderDetail(false);
    setTimeout(() => setSelectedOrder(null), 300);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'preparing':
      case 'Approved':
        return { backgroundColor: '#dcfce7', color: '#166534' };
      case 'cancelled':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      default:
        return { backgroundColor: '#fed7aa', color: '#9a3412' };
    }
  };

  return (
    <div className="order-management-container">
      {isLoading ? (
        <div className="order-management-loading">
          <div className="order-management-spinner"></div>
          <h2 className="order-management-loading-title">Loading Orders...</h2>
          <p className="order-management-loading-text">Please wait...</p>
        </div>
      ) : (
        <>
          <div className="order-management-header">
            <h1 className="order-management-title">Order Management</h1>
            <div className="order-management-filter-buttons">
              {['all', 'hour', 'day', 'yesterday', 'week', 'month'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`order-management-filter-button ${dateFilter === filter ? 'active' : ''}`}
                >
                  {filter === 'all' ? 'All' :
                   filter === 'hour' ? 'Last Hour' :
                   filter === 'day' ? 'Today' :
                   filter === 'yesterday' ? 'Yesterday' :
                   filter === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>
            <p className="order-management-stats">
              {orders.length} orders • {orders.filter(o => o.status === 'pending').length} pending
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="order-management-empty-state">
              <p className="order-management-empty-text">No orders available.</p>
            </div>
          ) : (
            <div className="order-management-grid">
              {orders.map((order, index) => {
                const formattedPrice = parseFloat(order.total_price).toFixed(2);
                const combinedItems = [
                  ...(order.item_names || []).map((name, idx) => ({
                    name,
                    image: order.image_urls[idx],
                    quantity: order.quantities[idx],
                    supplement: order.supplement_names[idx],
                    type: 'menu',
                  })),
                  ...(order.breakfast_names || []).map((name, idx) => ({
                    name,
                    image: order.breakfast_images[idx],
                    quantity: order.breakfast_quantities[idx],
                    option: order.breakfast_option_names[idx],
                    type: 'breakfast',
                  })),
                ].slice(0, 3);
                return (
                  <div
                    key={order.id}
                    onClick={() => openOrderDetail(order)}
                    className="order-management-card"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="order-management-card-header">
                      <div>
                        <h3 className="order-management-order-title">Order #{order.id}</h3>
                        <p className="order-management-order-info">
                          {order.table_number ? `Table ${order.table_number}` : order.order_type} • {order.created_at ? formatTime(order.created_at) : 'N/A'}
                        </p>
                        {order.notes && (
                          <p className="order-management-order-notes">Notes: {order.notes}</p>
                        )}
                      </div>
                      <span className="order-management-status" style={getStatusColor(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>

                    <div className="order-management-items">
                      {combinedItems.map((item, idx) => (
                        <div key={idx} className="order-management-item">
                          <img
                            src={item.image || FALLBACK_IMAGE}
                            alt={item.name}
                            className="order-management-item-image"
                            onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
                            loading="lazy"
                          />
                          <div className="order-management-item-details">
                            <span className="order-management-item-name">{item.name}</span>
                            {item.supplement && (
                              <span className="order-management-item-supplement">+ {item.supplement}</span>
                            )}
                            {item.option && (
                              <span className="order-management-item-option">+ {item.option}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {combinedItems.length < ((order.item_names?.length || 0) + (order.breakfast_names?.length || 0)) && (
                        <div className="order-management-more-items">
                          +{((order.item_names?.length || 0) + (order.breakfast_names?.length || 0)) - 3} more
                        </div>
                      )}
                    </div>

                    <div className="order-management-footer">
                      <span className="order-management-price">${formattedPrice}</span>
                      <div className="order-management-arrow">→</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showOrderDetail && selectedOrder && (
        <div className="order-management-modal">
          <div className="order-management-modal-content">
            <div className="order-management-modal-header">
              <div>
                <h2 className="order-management-modal-title">Order #{selectedOrder?.id}</h2>
                <p className="order-management-modal-info">
                  {selectedOrder?.table_number ? `Table ${selectedOrder.table_number}` : selectedOrder?.order_type}
                  {selectedOrder?.delivery_address && ` • ${selectedOrder.delivery_address}`}
                </p>
                {selectedOrder?.notes && (
                  <p className="order-management-modal-notes">Notes: {selectedOrder.notes}</p>
                )}
                {selectedOrder?.promotion_id && (
                  <p className="order-management-modal-promotion">Promotion ID: {selectedOrder.promotion_id}</p>
                )}
              </div>
              <button className="order-management-close-button" onClick={closeOrderDetail}>
                ×
              </button>
            </div>

            <div className="order-management-modal-body">
              <div className="order-management-items-section">
                <h3 className="order-management-section-title">Items Ordered</h3>
                <div className="order-management-items-list">
                  {(selectedOrder?.item_names || []).map((name, index) => (
                    <div key={`menu-${index}`} className="order-management-item-detail">
                      <img
                        src={selectedOrder.image_urls[index] || FALLBACK_IMAGE}
                        alt={name}
                        className="order-management-item-detail-image"
                        onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
                        loading="lazy"
                      />
                      <div className="order-management-item-detail-info">
                        <p className="order-management-item-detail-name">{name} (Menu Item)</p>
                        <p className="order-management-item-detail-quantity">
                          Quantity: {selectedOrder.quantities[index] || 0}
                        </p>
                        {selectedOrder.supplement_names[index] && (
                          <p className="order-management-item-detail-supplement">
                            Supplement: {selectedOrder.supplement_names[index]} (+${selectedOrder.supplement_prices[index]?.toFixed(2) || '0.00'})
                          </p>
                        )}
                        <p className="order-management-item-detail-price">
                          Unit Price: ${selectedOrder.unit_prices[index]?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(selectedOrder?.breakfast_names || []).map((name, index) => (
                    <div key={`breakfast-${index}`} className="order-management-item-detail">
                      <img
                        src={selectedOrder.breakfast_images[index] || FALLBACK_IMAGE}
                        alt={name}
                        className="order-management-item-detail-image"
                        onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
                        loading="lazy"
                      />
                      <div className="order-management-item-detail-info">
                        <p className="order-management-item-detail-name">{name} (Breakfast)</p>
                        <p className="order-management-item-detail-quantity">
                          Quantity: {selectedOrder.breakfast_quantities[index] || 0}
                        </p>
                        {selectedOrder.breakfast_option_names[index] && (
                          <p className="order-management-item-detail-options">
                            Options: {selectedOrder.breakfast_option_names[index]} (+${selectedOrder.breakfast_option_prices[index]?.toFixed(2) || '0.00'})
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-management-status-section">
                <h3 className="order-management-section-title">Update Status</h3>
                <select
                  value={selectedOrder?.status}
                  onChange={(e) => {
                    handleStatusUpdate(selectedOrder.id, e.target.value);
                    setSelectedOrder(prev => ({ ...prev, status: e.target.value }));
                  }}
                  className="order-management-status-select"
                  disabled={selectedOrder?.status === 'cancelled'}
                >
                  <option value="pending">Pending</option>
                  <option value="preparing">Preparing</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {selectedOrder?.status !== 'cancelled' && (
                  <button
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    className="order-management-cancel-button"
                  >
                    Cancel Order
                  </button>
                )}
              </div>

              <div className="order-management-total-section">
                <span className="order-management-total-label">Total Amount</span>
                <span className="order-management-total-amount">
                  ${parseFloat(selectedOrder?.total_price || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderManagement;
