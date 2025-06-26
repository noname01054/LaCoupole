import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { initSocket } from '../services/socket';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement, DoughnutController, Filler } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import moment from 'moment';
import { FiBarChart2, FiDollarSign, FiList, FiPieChart, FiFilter, FiTrendingUp, FiRotateCcw, FiTag, FiStar, FiBox, FiShoppingCart, FiCalendar, FiGift, FiMoon, FiSun } from 'react-icons/fi';
import './AdminDashboard.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement, DoughnutController, Filler);

// Hardcoded colors from AdminDashboard.css for light and dark themes
const COLORS = {
  light: {
    chartColor1: '#667EEA',
    chartColor2: '#764BA2',
    chartColor3: '#F093FB',
    chartColor4: '#F5576C',
    chartColor5: '#4FACFE',
    chartGradient1: 'rgba(102, 126, 234, 0.1)',
    chartGradient2: 'rgba(102, 126, 234, 0)',
    chartGradient3: 'rgba(118, 75, 162, 0.1)',
    tooltipBg: 'rgba(15, 23, 42, 0.9)',
    gridColor: 'rgba(148, 163, 184, 0.1)',
    bgPrimary: '#F9FAFB',
    textSecondary: '#64748B',
    borderColor: '#D1D5DB',
  },
  dark: {
    chartColor1: '#93C5FD',
    chartColor2: '#A78BFA',
    chartColor3: '#F0ABFC',
    chartColor4: '#F87171',
    chartColor5: '#60A5FA',
    chartGradient1: 'rgba(147, 197, 253, 0.1)',
    chartGradient2: 'rgba(147, 197, 253, 0)',
    chartGradient3: 'rgba(167, 139, 250, 0.1)',
    tooltipBg: 'rgba(17, 24, 39, 0.9)',
    gridColor: 'rgba(75, 85, 99, 0.1)',
    bgPrimary: '#1F2937',
    textSecondary: '#94A3B8',
    borderColor: '#4B5563',
  },
};

function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    start_date: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    end_date: moment().format('YYYY-MM-DD'),
    category_id: '',
    order_type: '',
  });
  const [categories, setCategories] = useState([]);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const navigate = useNavigate();
  const chartRefs = useRef({});

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  const themeColors = darkMode ? COLORS.dark : COLORS.light;

  const fetchAnalyticsData = useCallback(async () => {
  setIsFilterLoading(true);
  let retries = 3;
  while (retries > 0) {
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined') {
        throw new Error('No valid token found');
      }
      console.log('Fetching analytics with token:', token.substring(0, 10) + '...');
      const sanitizedFilters = Object.fromEntries(Object.entries(filters).filter(([_, value]) => value !== ''));
      const res = await api.get('/analytics-overview', { 
        params: sanitizedFilters,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAnalyticsData(res.data);
      break;
    } catch (error) {
      console.error('Error fetching analytics data:', error.response?.data || error.message);
      retries--;
      if (retries === 0 || error.response?.status === 401) {
        if (error.response?.status === 401) {
          toast.error('Session expired, please log in again');
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('sessionId');
          delete api.defaults.headers.common['X-Session-Id'];
          delete api.defaults.headers.common['Authorization'];
          navigate('/login');
        } else {
          toast.error(error.response?.data?.error || 'Failed to fetch analytics data');
          setAnalyticsData({
            totalOrders: { count: 0, change: null },
            totalRevenue: { revenue: '0.00', change: null },
            orderTypeBreakdown: [],
            topSellingItems: [],
            salesTrend: [],
            reservationStatus: { reservations: [], statusCounts: [] },
            averageRatings: [],
            categorySales: [],
            recentOrders: [],
            promotionImpact: [],
          });
        }
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  setIsFilterLoading(false);
}, [filters, navigate]);

  useEffect(() => {
  async function checkAuth() {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined') {
        throw new Error('No valid token found');
      }
      console.log('Checking auth with token:', token.substring(0, 10) + '...');
      const res = await api.get('/check-auth', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data.role !== 'admin') {
        toast.error('Admin access required');
        navigate('/login');
      } else {
        setUser(res.data);
      }
    } catch (err) {
      console.error('Auth check failed:', err.response?.data || err.message);
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('sessionId');
      delete api.defaults.headers.common['X-Session-Id'];
      delete api.defaults.headers.common['Authorization'];
      toast.error(err.response?.data?.error || 'Please log in');
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }

    async function fetchCategories() {
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined') {
        throw new Error('No valid token found');
      }
      const res = await api.get('/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCategories(res.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error.response?.data || error.message);
      toast.error('Failed to fetch categories');
    }
  }


    checkAuth();
    fetchCategories();
    fetchAnalyticsData();

    const socketCleanup = initSocket(
    (order) => {
      setAnalyticsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recentOrders: [{ ...order, approved: order.approved || 0 }, ...prev.recentOrders.slice(0, 4)],
          totalOrders: { ...prev.totalOrders, count: prev.totalOrders.count + 1 },
          totalRevenue: {
            ...prev.totalRevenue,
            revenue: order.approved ? (parseFloat(prev.totalRevenue.revenue) + parseFloat(order.total_price)).toFixed(2) : prev.totalRevenue.revenue,
          },
        };
      });
      toast.success(`New order #${order.id} received`);
    },
      (updatedOrder) => {
      setAnalyticsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recentOrders: prev.recentOrders.map((o) => (o.id === parseInt(updatedOrder.orderId) ? { ...o, approved: updatedOrder.approved } : o)),
        };
      });
      toast.info(`Order #${updatedOrder.orderId} updated to ${updatedOrder.approved ? 'Approved' : 'Not Approved'}`);
    },
    (data) => {
      setAnalyticsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          reservationStatus: {
            ...prev.reservationStatus,
            statusCounts: prev.reservationStatus.statusCounts.map((status) =>
              status.table_number === data.table_number ? { ...status, status: data.status } : status
            ),
          },
        };
      });
      toast.info(`Table ${data.table_number} status updated to ${data.status}`);
    },
      (data) => {
      setAnalyticsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          reservationStatus: {
            ...prev.reservationStatus,
            reservations: prev.reservationStatus.reservations.map((r) =>
              r.id === data.id ? { ...r, status: data.status } : r
            ),
          },
        };
      });
      toast.info(`Reservation #${data.id} updated to ${data.status}`);
    },
    (data) => {
      setAnalyticsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          averageRatings: prev.averageRatings.map((r) =>
            r.id === data.item_id ? { ...r, average_rating: data.average_rating } : r
          ),
        };
      });
      toast.info(`Rating updated for item #${data.item_id}`);
    },
    (data) => {
      toast.success(`Order #${data.orderId} approved`);
    },
    (data) => {
      toast.info(`Notification: ${data.message}`);
    }
  );

  return () => {
    if (typeof socketCleanup === 'function') socketCleanup();
    Object.values(chartRefs.current).forEach((chart) => {
      if (chart) chart.destroy();
    });
    chartRefs.current = {};
  };
}, [navigate, fetchAnalyticsData]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e, field) => {
    setFilters((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleQuickFilter = (period) => {
    let startDate, endDate;
    switch (period) {
      case 'today':
        startDate = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
        endDate = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
        break;
      case 'last7days':
        startDate = moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        endDate = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
        break;
      case 'last30days':
        startDate = moment().subtract(30, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        endDate = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
        break;
      default:
        startDate = moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        endDate = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
    }
    setFilters((prev) => ({
      ...prev,
      start_date: startDate,
      end_date: endDate,
    }));
    toast.success(`${period === 'today' ? 'Today' : period === 'last7days' ? 'Last 7 Days' : 'Last 30 Days'} filter applied`);
  };

  const handleFilterSubmit = async (e) => {
    e.preventDefault();
    if (filters.start_date && filters.end_date && moment(filters.start_date).isAfter(moment(filters.end_date))) {
      toast.error('End date must be after start date');
      return;
    }
    await fetchAnalyticsData();
    toast.success('Dashboard updated with selected filters');
  };

  const handleResetFilters = () => {
    setFilters({
      start_date: moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      end_date: moment().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      category_id: '',
      order_type: '',
    });
    toast.success('Filters reset');
  };

  if (isLoading || !user) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <p className="loading-text">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className={`admin-dashboard ${darkMode ? 'dark-mode' : ''}`}>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">Unable to Load Analytics</h2>
          <p className="error-message">We're having trouble loading your analytics data. Please try again later.</p>
          <button className="retry-button" onClick={fetchAnalyticsData}>
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const orderTypeBreakdown = analyticsData?.orderTypeBreakdown || [];
  const orderTypeChart = {
    type: 'pie',
    data: {
      labels: orderTypeBreakdown.map((item) => item?.order_type || 'Unknown'),
      datasets: [
        {
          data: orderTypeBreakdown.map((item) => item?.count || 0),
          backgroundColor: [themeColors.chartColor1, themeColors.chartColor2, themeColors.chartColor3, themeColors.chartColor4],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: themeColors.textSecondary,
            font: { size: 12, weight: '500' },
               padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.borderColor,
          borderWidth: 1,
          cornerRadius: 12,
          displayColors: false,
        },
      },
    },
  };

  const topSellingItems = analyticsData?.topSellingItems || [];
  const topSellingItemsChart = {
    type: 'bar',
    data: {
     

      labels: topSellingItems.map((item) => item?.name || 'Unknown'),
      datasets: [
        {
          label: 'Quantity Sold',
          data: topSellingItems.map((item) => item?.total_quantity || 0),
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0 , 0, 300);
            gradient.addColorStop(0, themeColors.chartColor1);
            gradient.addColorStop(1, themeColors.chartColor2);
            return gradient;
          },
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.borderColor,
          borderWidth: 1,
          cornerRadius: 12,
        },
      },
      scales: {
        x: {
          ticks: { color: themeColors.textSecondary, font: { size: 11 } },
          grid: { display: false },
        },
        y: {
          ticks: { color: themeColors.textSecondary, font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  };

  const salesTrend = analyticsData?.salesTrend || [];
  const salesTrendChart = {
    type: 'line',
    data: {
      labels: salesTrend.map((item) => moment(item?.time_period).format('MMM DD')),
      datasets: [
        {
          label: 'Revenue ($)',
          data: salesTrend.map((item) => item?.total_revenue || 0),
          borderColor: themeColors.chartColor1,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, themeColors.chartGradient1);
            gradient.addColorStop(1, themeColors.chartGradient2);
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 8,
          pointBackgroundColor: themeColors.bgPrimary,
          pointBorderColor: themeColors.chartColor1,
          pointBorderWidth: 3,
          borderWidth: 3,
        },
        {
          label: 'Orders',
          data: salesTrend.map((item) => item?.total_orders || 0),
          borderColor: themeColors.chartColor2,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, themeColors.chartGradient3);
            gradient.addColorStop(1, themeColors.chartGradient2);
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 8,
          pointBackgroundColor: themeColors.bgPrimary,
          pointBorderColor: themeColors.chartColor2,
          pointBorderWidth: 3,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: themeColors.textSecondary,
            font: { size: 12, weight: '500' },
            padding: 20,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.borderColor,
          borderWidth: 1,
          cornerRadius: 12,
        },
      },
      scales: {
        x: {
          ticks: {
            color: themeColors.textSecondary,
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 5,
          },
          grid: { color: themeColors.gridColor },
          padding: { left: 10, right: 10 },
        },
        y: {
          ticks: {
            color: themeColors.textSecondary,
            font: { size: 11 },
            padding: 10,
          },
          grid: { color: themeColors.gridColor },
        },
      },
    },
  };

  const averageRatings = analyticsData?.averageRatings || [];
  const averageRatingsChart = {
    type: 'bar',
    data: {
      labels: averageRatings.map((item) => item?.name || 'Unknown'),
      datasets: [
        {
          label: 'Rating',
          data: averageRatings.map((item) => item?.average_rating || 0),
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, themeColors.chartColor3);
            gradient.addColorStop(1, themeColors.chartColor4);
            return gradient;
          },
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.borderColor,
          borderWidth: 1,
          cornerRadius: 12,
        },
      },
      scales: {
        x: {
          ticks: { color: themeColors.textSecondary, max: 5, font: { size: 11 } },
          grid: { display: false },
        },
        y: {
          ticks: { color: themeColors.textSecondary, font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  };

  const categorySales = analyticsData?.categorySales || [];
  const categorySalesChart = {
    type: 'pie',
    data: {
      labels: categorySales.map((item) => item?.name || 'Unknown'),
      datasets: [
        {
          data: categorySales.map((item) => item?.total_revenue || 0),
          backgroundColor: [
            themeColors.chartColor1,
            themeColors.chartColor2,
            themeColors.chartColor3,
            themeColors.chartColor4,
            themeColors.chartColor5,
          ],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: themeColors.textSecondary,
            font: { size: 12, weight: '500' },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.borderColor,
          borderWidth: 1,
          cornerRadius: 12,
        },
      },
    },
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <FiBarChart2 /> },
    { id: 'sales', label: 'Sales', icon: <FiDollarSign /> },
    { id: 'orders', label: 'Orders', icon: <FiList /> },
    { id: 'analytics', label: 'Analytics', icon: <FiPieChart /> },
  ];

  return (
    <div className={`admin-dashboard ${darkMode ? 'dark-mode' : ''}`}>
      <div className="main-content">
        <div className="dashboard-header">
          <div className="header-content">
            <div className="header-main">
              <h1 className="dashboard-title">
                <FiBarChart2 className="title-icon" />
                Analytics Dashboard
              </h1>
              <p className="dashboard-subtitle">Welcome back, {user?.name || 'Admin'}</p>
            </div>
            <div className="header-actions">
              <button
                className="theme-toggle"
                onClick={() => setDarkMode(!darkMode)}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <FiSun /> : <FiMoon />}
              </button>
            </div>
          </div>
        </div>

        <div className="tab-navigation">
          <div className="tab-container">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="filter-section glass-card">
              <div className="filter-header">
                <h3 className="filter-title">
                  <FiFilter className="filter-icon" />
                  Filters
                </h3>
              </div>
              <div className="quick-filters">
                <button
                  className={`quick-filter-button ${filters.start_date === moment().startOf('day').format('YYYY-MM-DD HH:mm:ss') && filters.end_date === moment().endOf('day').format('YYYY-MM-DD HH:mm:ss') ? 'active' : ''}`}
                  onClick={() => handleQuickFilter('today')}
                >
                  Today
                </button>
                <button
                  className={`quick-filter-button ${filters.start_date === moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss') && filters.end_date === moment().endOf('day').format('YYYY-MM-DD HH:mm:ss') ? 'active' : ''}`}
                  onClick={() => handleQuickFilter('last7days')}
                >
                  Last 7 Days
                </button>
                <button
                  className={`quick-filter-button ${filters.start_date === moment().subtract(30, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss') && filters.end_date === moment().endOf('day').format('YYYY-MM-DD HH:mm:ss') ? 'active' : ''}`}
                  onClick={() => handleQuickFilter('last30days')}
                >
                  Last 30 Days
                </button>
              </div>
              <form className="filter-form" onSubmit={handleFilterSubmit}>
                <div className="filter-group">
                  <label className="filter-label">Start Date</label>
                  <input
                    type="date"
                    value={filters.start_date.split(' ')[0]}
                    onChange={(e) => handleDateChange(e, 'start_date')}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">End Date</label>
                  <input
                    type="date"
                    value={filters.end_date.split(' ')[0]}
                    onChange={(e) => handleDateChange(e, 'end_date')}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Category</label>
                  <select
                    name="category_id"
                    value={filters.category_id}
                    onChange={(e) => handleFilterChange('category_id', e.target.value)}
                    className="filter-input modern-select"
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Order Type</label>
                  <select
                    name="order_type"
                    value={filters.order_type}
                    onChange={(e) => handleFilterChange('order_type', e.target.value)}
                    className="filter-input modern-select"
                  >
                    <option value="">All Types</option>
                    <option value="local">Local</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>
                <div className="filter-actions">
                  <button
                    type="submit"
                    disabled={isFilterLoading}
                    className="btn-primary"
                  >
                    {isFilterLoading ? 'Applying...' : 'Apply Filters'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleResetFilters}>
                    Reset
                  </button>
                </div>
              </form>
            </div>

            <div className="metrics-grid">
              <div className="metric-card glass-card">
                <div className="metric-header">
                  <div className="metric-icon-wrapper orders">
                    <FiBox className="metric-icon" />
                  </div>
                  <div className="metric-info">
                    <h3 className="metric-title">Total Orders</h3>
                    <div className="metric-value">{analyticsData.totalOrders.count}</div>
                    {analyticsData.totalOrders.change !== null && (
                      <div className={`metric-change ${analyticsData.totalOrders.change >= 0 ? 'positive' : 'negative'}`}>
                        {analyticsData.totalOrders.change >= 0 ? '↑' : '↓'} {Math.abs(analyticsData.totalOrders.change)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="metric-card glass-card">
                <div className="metric-header">
                  <div className="metric-icon-wrapper revenue">
                    <FiDollarSign className="metric-icon" />
                  </div>
                  <div className="metric-info">
                    <h3 className="metric-title">Total Revenue</h3>
                    <div className="metric-value">${parseFloat(analyticsData.totalRevenue.revenue).toFixed(2)}</div>
                    {analyticsData.totalRevenue.change !== null && (
                      <div className={`metric-change ${analyticsData.totalRevenue.change >= 0 ? 'positive' : 'negative'}`}>
                        {analyticsData.totalRevenue.change >= 0 ? '↑' : '↓'} {Math.abs(analyticsData.totalRevenue.change)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="metric-card glass-card">
                <div className="metric-header">
                  <div className="metric-icon-wrapper rating">
                    <FiStar className="metric-icon" />
                  </div>
                  <div className="metric-info">
                    <h3 className="metric-title">Avg Rating</h3>
                    <div className="metric-value">
                      {analyticsData.averageRatings.length > 0
                        ? (analyticsData.averageRatings.reduce((sum, item) => sum + item.average_rating, 0) / analyticsData.averageRatings.length).toFixed(1)
                        : '0.0'}
                    </div>
                    <div className="metric-change positive">⭐ Excellent</div>
                  </div>
                </div>
              </div>

              <div className="metric-card glass-card">
                <div className="metric-header">
                  <div className="metric-icon-wrapper categories">
                    <FiTag className="metric-icon" />
                  </div>
                  <div className="metric-info">
                    <h3 className="metric-title">Categories</h3>
                    <div className="metric-value">{analyticsData.categorySales.length}</div>
                    <div className="metric-change neutral">📊 Active</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="charts-layout">
              <div className="chart-card glass-card">
                <div className="chart-header">
                  <h3 className="chart-title">
                    <FiTrendingUp className="chart-icon" />
                    Sales Trend Over Time
                  </h3>
                </div>
                <div className="chart-container">
                  <Line
                    data={salesTrendChart.data}
                    options={salesTrendChart.options}
                    ref={(el) => {
                      if (el) chartRefs.current['salesTrend'] = el.chartInstance;
                    }}
                    id="sales-trend-chart"
                  />
                </div>
              </div>

              <div className="chart-card glass-card">
                <div className="chart-header">
                  <h3 className="chart-title">
                    <FiRotateCcw className="chart-icon" />
                    Order Types
                  </h3>
                </div>
                <div className="chart-container">
                  <Pie
                    data={orderTypeChart.data}
                    options={orderTypeChart.options}
                    ref={(el) => {
                      if (el) chartRefs.current['orderType'] = el.chartInstance;
                    }}
                    id="order-type-chart"
                  />
                </div>
              </div>

              <div className="chart-card glass-card">
                <div className="chart-header">
                  <h3 className="chart-title">
                    <FiTag className="chart-icon" />
                    Category Sales
                  </h3>
                </div>
                <div className="chart-container">
                  <Pie
                    data={categorySalesChart.data}
                    options={categorySalesChart.options}
                    ref={(el) => {
                      if (el) chartRefs.current['categorySales'] = el.chartInstance;
                    }}
                    id="category-sales-chart"
                  />
                </div>
              </div>

              <div className="chart-card glass-card">
                <div className="chart-header">
                  <h3 className="chart-title">
                    <FiBox className="chart-icon" />
                    Top Selling Items
                  </h3>
                </div>
                <div className="chart-container">
                  <Bar
                    data={topSellingItemsChart.data}
                    options={topSellingItemsChart.options}
                    ref={(el) => {
                      if (el) chartRefs.current['topSellingItems'] = el.chartInstance;
                    }}
                    id="top-selling-items-chart"
                  />
                </div>
              </div>

              <div className="chart-card glass-card">
                <div className="chart-header">
                  <h3 className="chart-title">
                    <FiStar className="chart-icon" />
                    Item Ratings
                  </h3>
                </div>
                <div className="chart-container">
                  <Bar
                    data={averageRatingsChart.data}
                    options={averageRatingsChart.options}
                    ref={(el) => {
                      if (el) chartRefs.current['averageRatings'] = el.chartInstance;
                    }}
                    id="average-ratings-chart"
                  />
                </div>
              </div>
            </div>

            <div className="tables-section">
              <div className="table-card glass-card">
                <div className="table-header">
                  <h3 className="table-title">
                    <FiShoppingCart className="table-icon" />
                    Recent Orders
                  </h3>
                </div>
                <div className="table-wrapper">
                  {analyticsData.recentOrders.length === 0 ? (
                    <div className="empty-state">
                      <FiShoppingCart className="empty-icon" />
                      <p className="empty-text">No recent orders found</p>
                    </div>
                  ) : (
                    <div className="modern-table">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Order ID</th>
                              <th>Table</th>
                              <th>Total</th>
                              <th>Type</th>
                              <th>Status</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.recentOrders.map((order, index) => (
                              <tr key={order.id} style={{ animationDelay: `${index * 0.1}s` }}>
                                <td><span className="order-id">#{order.id}</span></td>
                                <td>{order.table_number || 'N/A'}</td>
                                <td><span className="price">${order.total_price}</span></td>
                                <td><span className={`order-type ${order.order_type}`}>{order.order_type}</span></td>
                                <td><span className={`status ${order.approved ? 'approved' : 'pending'}`}>{order.approved ? 'Approved' : 'Pending'}</span></td>
                                <td className="date-cell">{moment(order.created_at).format('MMM DD, YYYY')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="table-card glass-card">
                <div className="table-header">
                  <h3 className="table-title">
                    <FiCalendar className="table-icon" />
                    Reservations
                  </h3>
                </div>
                <div className="table-wrapper">
                  {analyticsData.reservationStatus.reservations.length === 0 ? (
                    <div className="empty-state">
                      <FiCalendar className="empty-icon" />
                      <p className="empty-text">No reservations found</p>
                    </div>
                  ) : (
                    <div className="modern-table">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Table</th>
                              <th>Time</th>
                              <th>Phone</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.reservationStatus.reservations.map((reservation, index) => (
                              <tr key={reservation.id} style={{ animationDelay: `${index * 0.1}s` }}>
                                <td><span className="reservation-id">#{reservation.id}</span></td>
                                <td>{reservation.table_number}</td>
                                <td className="time-cell">{moment(reservation.reservation_time).format('MMM DD, YYYY HH:mm')}</td>
                                <td>{reservation.phone_number}</td>
                                <td><span className={`status ${reservation.status.toLowerCase()}`}>{reservation.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="table-card glass-card">
                <div className="table-header">
                  <h3 className="table-title">
                    <FiGift className="table-icon" />
                    Promotion Impact
                  </h3>
                </div>
                <div className="table-wrapper">
                  {analyticsData.promotionImpact.length === 0 ? (
                    <div className="empty-state">
                      <FiGift className="empty-icon" />
                      <p className="empty-text">No promotions applied</p>
                    </div>
                  ) : (
                    <div className="modern-table">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Name</th>
                              <th>Orders</th>
                              <th>Discount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.promotionImpact.map((promo, index) => (
                              <tr key={promo.id} style={{ animationDelay: `${index * 0.1}s` }}>
                                <td><span className="order-id">#{promo.id}</span></td>
                                <td>{promo.name}</td>
                                <td>{promo.order_count}</td>
                                <td><span className="price">${promo.total_discount}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'sales' && (
          <div className="chart-card glass-card">
            <div className="chart-header">
              <h3 className="chart-title">
                <FiDollarSign className="chart-icon" />
                Sales Analytics
              </h3>
            </div>
            <p className="empty-text">Detailed sales analytics coming soon...</p>
          </div>
        )}
        {activeTab === 'orders' && (
          <div className="chart-card glass-card">
            <div className="chart-header">
              <h3 className="chart-title">
                <FiList className="chart-icon" />
                Order Management
              </h3>
            </div>
            <p className="empty-text">Order management features coming soon...</p>
          </div>
        )}
        {activeTab === 'analytics' && (
          <div className="chart-card glass-card">
            <div className="chart-header">
              <h3 className="chart-title">
                <FiPieChart className="chart-icon" />
                Advanced Analytics
              </h3>
            </div>
            <p className="empty-text">Advanced analytics features coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;