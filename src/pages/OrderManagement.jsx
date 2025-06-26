import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { initSocket } from '../services/socket';
import './css/OrderManagement.css';

function OrderManagement() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const placeholderImage = 'https://via.placeholder.com/48?text=No+Image';

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
        console.log('API response data:', res.data);
        const ordersArray = Array.isArray(res.data.data) ? res.data.data : [];
        const processedOrders = ordersArray.map(order => ({
          ...order,
          item_names: order.item_names
            ? Array.isArray(order.item_names)
              ? order.item_names.map(name => name.trim())
              : order.item_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          image_urls: order.image_urls
            ? Array.isArray(order.image_urls)
              ? order.image_urls.map(url => url.trim())
              : order.image_urls.split(',').map(url => url.trim()).filter(Boolean)
            : [],
          quantities: order.menu_quantities
            ? Array.isArray(order.menu_quantities)
              ? order.menu_quantities.map(qty => parseInt(qty, 10))
              : order.menu_quantities.split(',').map(qty => parseInt(qty, 10)).filter(qty => !isNaN(qty))
            : [],
          breakfast_names: order.breakfast_names
            ? Array.isArray(order.breakfast_names)
              ? order.breakfast_names.map(name => name.trim())
              : order.breakfast_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          breakfast_images: order.breakfast_images
            ? Array.isArray(order.breakfast_images)
              ? order.breakfast_images.map(url => url.trim())
              : order.breakfast_images.split(',').map(url => url.trim()).filter(Boolean)
            : [],
          breakfast_quantities: order.breakfast_quantities
            ? Array.isArray(order.breakfast_quantities)
              ? order.breakfast_quantities.map(qty => parseInt(qty, 10))
              : order.breakfast_quantities.split(',').map(qty => parseInt(qty, 10)).filter(qty => !isNaN(qty))
            : [],
          breakfast_option_names: order.breakfast_option_names
            ? Array.isArray(order.breakfast_option_names)
              ? order.breakfast_option_names.map(name => name.trim())
              : order.breakfast_option_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          status: order.approved ? 'Approved' : 'Pending',
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
          item_names: order.item_names
            ? Array.isArray(order.item_names)
              ? order.item_names.map(name => name.trim())
              : order.item_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          image_urls: order.image_urls
            ? Array.isArray(order.image_urls)
              ? order.image_urls.map(url => url.trim())
              : order.image_urls.split(',').map(url => url.trim()).filter(Boolean)
            : [],
          quantities: order.menu_quantities
            ? Array.isArray(order.menu_quantities)
              ? order.menu_quantities.map(qty => parseInt(qty, 10))
              : order.menu_quantities.split(',').map(qty => parseInt(qty, 10)).filter(qty => !isNaN(qty))
            : [],
          breakfast_names: order.breakfast_names
            ? Array.isArray(order.breakfast_names)
              ? order.breakfast_names.map(name => name.trim())
              : order.breakfast_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          breakfast_images: order.breakfast_images
            ? Array.isArray(order.breakfast_images)
              ? order.breakfast_images.map(url => url.trim())
              : order.breakfast_images.split(',').map(url => url.trim()).filter(Boolean)
            : [],
          breakfast_quantities: order.breakfast_quantities
            ? Array.isArray(order.breakfast_quantities)
              ? order.breakfast_quantities.map(qty => parseInt(qty, 10))
              : order.breakfast_quantities.split(',').map(qty => parseInt(qty, 10)).filter(qty => !isNaN(qty))
            : [],
          breakfast_option_names: order.breakfast_option_names
            ? Array.isArray(order.breakfast_option_names)
              ? order.breakfast_option_names.map(name => name.trim())
              : order.breakfast_option_names.split(',').map(name => name.trim()).filter(Boolean)
            : [],
          status: order.approved ? 'Approved' : 'Pending',
        };
        setOrders(prev => [processedOrder, ...prev]);
        toast.success(`New order #${order.id} received`);
      },
      (updatedOrder) => {
        setOrders(prev =>
          prev.map(order =>
            order.id === parseInt(updatedOrder.orderId)
              ? { ...order, status: updatedOrder.status || (updatedOrder.approved ? 'Approved' : 'Pending') }
              : order
          )
        );
        toast.info(`Order #${updatedOrder.orderId} updated to ${updatedOrder.status || (updatedOrder.approved ? 'Approved' : 'Pending')}`);
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
      const approved = status === 'Approved' ? 1 : 0;
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
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    return status === 'Approved' 
      ? { backgroundColor: '#dcfce7', color: '#166534' }
      : { backgroundColor: '#fed7aa', color: '#9a3412' };
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
              {orders.length} orders • {orders.filter(o => o.status === 'Pending').length} pending
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
                    type: 'menu',
                  })),
                  ...(order.breakfast_names || []).map((name, idx) => ({
                    name,
                    image: order.breakfast_images[idx],
                    quantity: order.breakfast_quantities[idx],
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
                      </div>
                      <span className="order-management-status" style={getStatusColor(order.status)}>
                        {order.status}
                      </span>
                    </div>

                    <div className="order-management-items">
                      {combinedItems.map((item, idx) => (
                        <div key={idx} className="order-management-item">
                          {item.image && item.image !== 'null' ? (
                            <img
                              src={`${baseUrl}${item.image}`.replace(/"/g, '')}
                              alt={item.name}
                              className="order-management-item-image"
                              onError={(e) => { e.target.src = placeholderImage; }}
                            />
                          ) : (
                            <div className="order-management-item-placeholder">
                              {item.quantity}
                            </div>
                          )}
                          <span className="order-management-item-name">{item.name}</span>
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

      {showOrderDetail && (
        <div className="order-management-modal">
          <div className="order-management-modal-content">
            <div className="order-management-modal-header">
              <div>
                <h2 className="order-management-modal-title">Order #{selectedOrder?.id}</h2>
                <p className="order-management-modal-info">
                  {selectedOrder?.table_number ? `Table ${selectedOrder.table_number}` : selectedOrder?.order_type}
                </p>
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
                      {selectedOrder.image_urls[index] && selectedOrder.image_urls[index] !== 'null' ? (
                        <img
                          src={`${baseUrl}${selectedOrder.image_urls[index]}`.replace(/"/g, '')}
                          alt={name}
                          className="order-management-item-detail-image"
                          onError={(e) => { e.target.src = placeholderImage; }}
                        />
                      ) : (
                        <div className="order-management-item-detail-placeholder">No Img</div>
                      )}
                      <div className="order-management-item-detail-info">
                        <p className="order-management-item-detail-name">{name} (Menu Item)</p>
                        <p className="order-management-item-detail-quantity">
                          Quantity: {selectedOrder.quantities[index] || 0}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(selectedOrder?.breakfast_names || []).map((name, index) => (
                    <div key={`breakfast-${index}`} className="order-management-item-detail">
                      {selectedOrder.breakfast_images[index] && selectedOrder.breakfast_images[index] !== 'null' ? (
                        <img
                          src={`${baseUrl}${selectedOrder.breakfast_images[index]}`.replace(/"/g, '')}
                          alt={name}
                          className="order-management-item-detail-image"
                          onError={(e) => { e.target.src = placeholderImage; }}
                        />
                      ) : (
                        <div className="order-management-item-detail-placeholder">No Img</div>
                      )}
                      <div className="order-management-item-detail-info">
                        <p className="order-management-item-detail-name">{name} (Breakfast)</p>
                        <p className="order-management-item-detail-quantity">
                          Quantity: {selectedOrder.breakfast_quantities[index] || 0}
                        </p>
                        {selectedOrder.breakfast_option_names && selectedOrder.breakfast_option_names[index] && (
                          <p className="order-management-item-detail-options">
                            Options: {selectedOrder.breakfast_option_names[index]}
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
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                </select>
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