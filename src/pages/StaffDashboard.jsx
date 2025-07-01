import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  CircularProgress,
  Grid,
} from '@mui/material';
import { Receipt, CheckCircle, Cancel, Refresh, Assignment, ShoppingCart } from '@mui/icons-material';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import OrderCard from '../components/OrderCard';
import './css/StaffDashboard.css';

function StaffDashboard({ user, handleNewNotification, socket }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('day');
  const [approvedFilter, setApprovedFilter] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const orderRefs = useRef({});
  const hasScrolled = useRef(false);

  const getTimeAgo = useCallback((createdAt) => {
    const now = new Date();
    const orderTime = new Date(createdAt);
    const diffMs = now - orderTime;
    const diffMins = Math.round(diffMs / 60000);

    if (diffMs < 0) return 'just now';
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }, []);

  const processOrder = useCallback((order) => {
    console.log('Processing order:', order);
    if (!order?.id) {
      console.error('Invalid order data:', order);
      return null;
    }
    return {
      ...order,
      approved: Number(order.approved || 0),
      items: order.item_ids
        ? order.item_ids.split(',').map((id, index) => ({
            id: parseInt(id) || 0,
            name: order.item_names ? order.item_names.split(',')[index]?.trim() || 'Unknown Item' : 'Unknown Item',
            quantity: order.menu_quantities ? parseInt(order.menu_quantities.split(',')[index] || 0) : 0,
            unit_price: order.unit_prices ? parseFloat(order.unit_prices.split(',')[index] || 0) : 0,
            image_url: order.image_urls ? order.image_urls.split(',')[index]?.trim() || null : null,
            supplement_name: order.supplement_names
              ? order.supplement_names.split(',')[index]?.trim() || 'No Supplement'
              : 'No Supplement',
            supplement_price: order.supplement_prices
              ? parseFloat(order.supplement_prices.split(',')[index] || 0)
              : 0,
          }))
        : [],
      breakfastItems: order.breakfast_ids
        ? order.breakfast_ids.split(',').map((id, index) => ({
            id: parseInt(id) || 0,
            name: order.breakfast_names ? order.breakfast_names.split(',')[index]?.trim() || 'Unknown Breakfast' : 'Unknown Breakfast',
            quantity: order.breakfast_quantities ? parseInt(order.breakfast_quantities.split(',')[index] || 0) : 0,
            unit_price: order.unit_prices ? parseFloat(order.unit_prices.split(',')[index] || 0) : 0,
            image_url: order.breakfast_images ? order.breakfast_images.split(',')[index]?.trim() || null : null,
            option_names: order.breakfast_option_names
              ? order.breakfast_option_names.split(',')[index]?.split('|').map(name => name?.trim() || 'Unknown Option') || []
              : [],
            option_prices: order.breakfast_option_prices
              ? order.breakfast_option_prices.split(',')[index]?.split('|').map(price => parseFloat(price || 0)) || []
              : [],
          }))
        : [],
      timeAgo: getTimeAgo(order.created_at),
    };
  }, [getTimeAgo]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!user || !['admin', 'server'].includes(user.role)) {
        throw new Error('You do not have permission to view orders');
      }

      const params = {};
      if (timeRange && timeRange !== 'all') params.time_range = timeRange;
      if (approvedFilter !== '') params.approved = approvedFilter;

      const res = await api.get('/orders', { params });
      const fetchedOrders = res.data.data
        .map(processOrder)
        .filter(order => order !== null)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(fetchedOrders);
      console.log('Orders fetched successfully:', fetchedOrders.length);
    } catch (err) {
      console.error('Error fetching orders:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load orders';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user, timeRange, approvedFilter, processOrder]);

  const handleScrollAndExpand = useCallback(() => {
    const queryParams = new URLSearchParams(location.search);
    const scrollToOrderId = parseInt(queryParams.get('scrollTo'));
    const expandOrderId = parseInt(queryParams.get('expandOrder'));

    if (!isLoading && orders.length > 0 && !hasScrolled.current && !isNaN(scrollToOrderId) && orderRefs.current[scrollToOrderId]) {
      const orderExists = orders.some(order => order.id === scrollToOrderId);
      if (orderExists) {
        orderRefs.current[scrollToOrderId].scrollIntoView({ behavior: 'smooth', block: 'start' });
        hasScrolled.current = true;
        setTimeout(() => {
          queryParams.delete('scrollTo');
          queryParams.delete('expandOrder');
          navigate(`/staff?${queryParams.toString()}`, { replace: true });
        }, 1000);
      } else {
        toast.warn(`Order #${scrollToOrderId} not found in current view`);
        queryParams.delete('scrollTo');
        queryParams.delete('expandOrder');
        navigate(`/staff?${queryParams.toString()}`, { replace: true });
      }
    }
  }, [isLoading, orders, location, navigate]);

  useEffect(() => {
    handleScrollAndExpand();
  }, [handleScrollAndExpand]);

  const handleNewOrder = useCallback((order) => {
    console.log('handleNewOrder triggered with order:', order);
    if (!order?.id) {
      console.error('Invalid newOrder data:', order);
      toast.warn('Received invalid order data');
      return;
    }

    const normalizedOrder = { ...order, approved: Number(order.approved || 0) };
    console.log('Normalized order:', normalizedOrder);

    const now = new Date();
    const orderTime = new Date(normalizedOrder.created_at);
    const diffMs = now - orderTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    const matchesTimeRange =
      timeRange === 'all' ||
      (timeRange === 'day' && diffHours < 24 && orderTime >= new Date().setHours(0, 0, 0, 0)) ||
      (timeRange === 'hour' && diffHours < 1);
    const matchesApproved =
      approvedFilter === '' ||
      (approvedFilter === '1' && normalizedOrder.approved === 1) ||
      (approvedFilter === '0' && normalizedOrder.approved === 0);

    console.log('Filter check:', { matchesTimeRange, matchesApproved, timeRange, approvedFilter });

    if (matchesTimeRange && matchesApproved) {
      setOrders((prev) => {
        if (prev.some((o) => o.id === normalizedOrder.id)) {
          console.log('Order already exists, skipping:', normalizedOrder.id);
          return prev;
        }
        const enrichedOrder = processOrder(normalizedOrder);
        if (!enrichedOrder) {
          console.error('Failed to process order:', normalizedOrder);
          return prev;
        }
        console.log('Adding new order to state:', enrichedOrder);
        handleNewNotification({
          id: `order_${normalizedOrder.id}`,
          type: 'order',
          message: `New order #${normalizedOrder.id} received`,
          reference_id: normalizedOrder.id.toString(),
          is_read: 1,
          created_at: new Date().toISOString(),
        });
        toast.info(`New order #${normalizedOrder.id} received!`, { autoClose: 5000 });
        const newOrders = [enrichedOrder, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log('Updated orders state:', newOrders.length);
        return newOrders;
      });
    } else {
      console.log('Order filtered out:', { orderId: order.id, matchesTimeRange, matchesApproved });
    }
  }, [timeRange, approvedFilter, handleNewNotification, processOrder]);

  const handleOrderUpdate = useCallback(({ orderId, status, orderDetails }) => {
    console.log('StaffDashboard received orderUpdate:', { orderId, status, orderDetails });
    if (!orderId) {
      console.error('Invalid orderUpdate data:', { orderId, status, orderDetails });
      return;
    }
    setOrders((prev) => {
      const updatedOrders = prev.map((order) =>
        order.id === parseInt(orderId)
          ? { ...order, status, ...orderDetails, approved: Number(orderDetails.approved || 0), timeAgo: getTimeAgo(order.created_at) }
          : order
      ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return updatedOrders;
    });
    toast.info(`Order ${orderId} updated to ${status}`);
  }, [getTimeAgo]);

  const handleOrderApproved = useCallback(({ orderId, orderDetails }) => {
    console.log('StaffDashboard received orderApproved:', { orderId, orderDetails });
    if (!orderId) {
      console.error('Invalid orderApproved data:', { orderId, orderDetails });
      return;
    }
    setOrders((prev) => {
      const updatedOrders = prev.map((order) =>
        order.id === parseInt(orderId)
          ? { ...order, ...orderDetails, approved: 1, timeAgo: getTimeAgo(order.created_at) }
          : order
      ).filter((order) => (
        approvedFilter === '' ||
        (approvedFilter === '1' && order.approved === 1) ||
        (approvedFilter === '0' && order.approved === 0)
      )).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return updatedOrders;
    });
    toast.info(`Order #${orderId} approved`);
    if (socket && socket.connected) {
      socket.emit('orderApproved', {
        orderId,
        orderDetails: {
          approved: 1,
          status: orderDetails.status || 'preparing',
          item_ids: orderDetails.item_ids || '',
          item_names: orderDetails.item_names || '',
          menu_quantities: orderDetails.menu_quantities || '',
          unit_prices: orderDetails.unit_prices || '',
          supplement_ids: orderDetails.supplement_ids || '',
          supplement_names: orderDetails.supplement_names || '',
          supplement_prices: orderDetails.supplement_prices || '',
          image_urls: orderDetails.image_urls || '',
          breakfast_ids: orderDetails.breakfast_ids || '',
          breakfast_names: orderDetails.breakfast_names || '',
          breakfast_quantities: orderDetails.breakfast_quantities || '',
          breakfast_images: orderDetails.breakfast_images || '',
          breakfast_option_ids: orderDetails.breakfast_option_ids || '',
          breakfast_option_names: orderDetails.breakfast_option_names || '',
          breakfast_option_prices: orderDetails.breakfast_option_prices || '',
          total_price: orderDetails.total_price || 0,
          order_type: orderDetails.order_type || 'local',
          table_number: orderDetails.table_number || null,
          delivery_address: orderDetails.delivery_address || null,
          created_at: orderDetails.created_at || new Date().toISOString(),
        },
      });
    } else {
      console.warn('Socket not connected, cannot emit orderApproved event');
      toast.warn('Real-time updates may be delayed due to connection issues');
    }
  }, [approvedFilter, getTimeAgo, socket]);

  useEffect(() => {
    if (!user || !handleNewNotification || !socket) {
      setError('Missing user, notification handler, or socket');
      setIsLoading(false);
      return;
    }

    fetchOrders();

    socket.on('newOrder', handleNewOrder);
    socket.on('orderUpdate', handleOrderUpdate);
    socket.on('orderApproved', handleOrderApproved);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderUpdate', handleOrderUpdate);
      socket.off('orderApproved', handleOrderApproved);
      console.log('StaffDashboard socket listeners cleaned up');
    };
  }, [user, handleNewNotification, socket, fetchOrders, handleNewOrder, handleOrderUpdate, handleOrderApproved]);

  const approveOrder = useCallback(async (orderId) => {
    if (!orderId || isNaN(orderId)) {
      console.error('Invalid orderId:', orderId);
      toast.error('Invalid order ID');
      return;
    }
    try {
      const response = await api.approveOrder(orderId);
      const orderDetails = response.data.order || { approved: 1, status: 'preparing' };
      if (socket && socket.connected) {
        socket.emit('orderApproved', {
          orderId,
          orderDetails: {
            approved: 1,
            status: 'preparing',
            item_ids: orderDetails.item_ids || '',
            item_names: orderDetails.item_names || '',
            menu_quantities: orderDetails.menu_quantities || '',
            unit_prices: orderDetails.unit_prices || '',
            supplement_ids: orderDetails.supplement_ids || '',
            supplement_names: orderDetails.supplement_names || '',
            supplement_prices: orderDetails.supplement_prices || '',
            image_urls: orderDetails.image_urls || '',
            breakfast_ids: orderDetails.breakfast_ids || '',
            breakfast_names: orderDetails.breakfast_names || '',
            breakfast_quantities: orderDetails.breakfast_quantities || '',
            breakfast_images: orderDetails.breakfast_images || '',
            breakfast_option_ids: orderDetails.breakfast_option_ids || '',
            breakfast_option_names: orderDetails.breakfast_option_names || '',
            breakfast_option_prices: orderDetails.breakfast_option_prices || '',
            total_price: orderDetails.total_price || 0,
            order_type: orderDetails.order_type || 'local',
            table_number: orderDetails.table_number || null,
            delivery_address: orderDetails.delivery_address || null,
            created_at: orderDetails.created_at || new Date().toISOString(),
          },
        });
      } else {
        console.warn('Socket not connected, cannot emit orderApproved event');
        toast.warn('Real-time updates may be delayed due to connection issues');
      }
    } catch (error) {
      console.error('Error approving order:', error);
      toast.error(error.response?.data?.error || 'Failed to approve order');
    }
  }, [socket]);

  const queryParams = new URLSearchParams(location.search);
  const expandOrderId = parseInt(queryParams.get('expandOrder'));

  const memoizedOrders = useMemo(() => orders, [orders]);

  const orderStats = useMemo(() => {
    const totalOrders = memoizedOrders.length;
    const approvedOrders = memoizedOrders.filter(order => order.approved === 1).length;
    const notApprovedOrders = memoizedOrders.filter(order => order.approved === 0).length;
    return { totalOrders, approvedOrders, notApprovedOrders };
  }, [memoizedOrders]);

  return (
    <Box className="staff-dashboard-container">
      <Box className="staff-dashboard-header">
        <Box className="staff-dashboard-header-content">
          <Typography variant="h4" className="staff-dashboard-title">
            <Assignment className="staff-dashboard-title-icon" />
            Staff Dashboard
          </Typography>
          <Typography className="staff-dashboard-subtitle">
            Manage and approve orders in real-time, {user?.name || 'Staff'}
          </Typography>
        </Box>
      </Box>
      <Box className="staff-dashboard-metrics glass-card">
        <Box className="staff-dashboard-info">
          <Typography className="staff-dashboard-info-item">
            <Receipt />
            Total Orders: <span>{orderStats.totalOrders}</span>
          </Typography>
          <Typography className="staff-dashboard-info-item">
            <CheckCircle />
            Approved: <span>{orderStats.approvedOrders}</span>
          </Typography>
          <Typography className="staff-dashboard-info-item">
            <Cancel />
            Not Approved: <span>{orderStats.notApprovedOrders}</span>
          </Typography>
        </Box>
      </Box>
      <Box className="staff-dashboard-filter-section glass-card">
        <Box className="staff-dashboard-filter-header">
          <Typography className="staff-dashboard-filter-title">
            <Assignment />
            Filters
          </Typography>
        </Box>
        <Grid container spacing={2} className="staff-dashboard-filters debug-border">
          <Grid item xs={12} sm={4} className="staff-dashboard-filter-item debug-border">
            <FormControl fullWidth className="staff-dashboard-filter-select">
              <InputLabel id="time-range-label">Time Range</InputLabel>
              <Select
                labelId="time-range-label"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="Time Range"
              >
                <MenuItem value="hour">Last Hour</MenuItem>
                <MenuItem value="day">Today</MenuItem>
                <MenuItem value="all">All Orders</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4} className="staff-dashboard-filter-item debug-border">
            <FormControl fullWidth className="staff-dashboard-filter-select">
              <InputLabel id="approval-status-label">Approval Status</InputLabel>
              <Select
                labelId="approval-status-label"
                value={approvedFilter}
                onChange={(e) => setApprovedFilter(e.target.value)}
                label="Approval Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="1">Approved</MenuItem>
                <MenuItem value="0">Not Approved</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4} className="staff-dashboard-filter-item debug-border">
            <Button
              variant="contained"
              className="staff-dashboard-refresh-button"
              onClick={fetchOrders}
              fullWidth
            >
              <Refresh />
              Refresh Orders
            </Button>
          </Grid>
        </Grid>
      </Box>
      {isLoading ? (
        <Box className="staff-dashboard-loading">
          <CircularProgress />
          <Typography className="staff-dashboard-loading-text">Loading Orders...</Typography>
        </Box>
      ) : error ? (
        <Box className="staff-dashboard-error glass-card">
          <Typography className="staff-dashboard-error-text">
            <Cancel className="staff-dashboard-error-icon" />
            {error}
          </Typography>
          <Button
            variant="contained"
            className="staff-dashboard-retry-button"
            onClick={fetchOrders}
          >
            <Refresh />
            Retry Loading
          </Button>
        </Box>
      ) : memoizedOrders.length === 0 ? (
        <Box className="staff-dashboard-empty glass-card">
          <Typography className="staff-dashboard-empty-text">
            <ShoppingCart className="staff-dashboard-empty-icon" />
            No orders to display.
          </Typography>
        </Box>
      ) : (
        <>
          <Typography className="staff-dashboard-order-count">
            Showing {memoizedOrders.length} order{memoizedOrders.length !== 1 ? 's' : ''}
          </Typography>
          <Grid container spacing={1.5} className="staff-dashboard-orders-grid">
            {memoizedOrders.map((order) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                key={order.id}
                className="staff-dashboard-order-card glass-card"
                ref={(el) => (orderRefs.current[order.id] = el)}
              >
                <Box className="staff-dashboard-order-header">
                  <ShoppingCart className="staff-dashboard-order-icon" />
                  <Typography className="staff-dashboard-order-title">
                    Order #{order.id}
                  </Typography>
                </Box>
                <OrderCard
                  order={order}
                  onApproveOrder={approveOrder}
                  timeAgo={order.timeAgo}
                  isExpanded={order.id === expandOrderId}
                  className={`staff-dashboard-order-content ${order.approved ? 'approved' : 'not-approved'} ${order.id === expandOrderId ? 'expanded' : ''}`}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}

export default StaffDashboard;
