import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { initSocket } from '../services/socket';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement, DoughnutController, Filler } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import moment from 'moment';
import { FiBarChart2, FiDollarSign, FiFilter, FiTrendingUp, FiRotateCcw, FiTag, FiBox, FiShoppingCart, FiCalendar, FiClock } from 'react-icons/fi';
import './AdminDashboard.css';

// Définir la localisation française pour moment
moment.locale('fr');

// Enregistrer les composants Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement, DoughnutController, Filler);

// Couleurs codées en dur depuis AdminDashboard.css pour le thème clair
const COLORS = {
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
    start_hour: '',
    end_hour: '',
  });
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();
  const chartRefs = useRef({});
  const filterTimeoutRef = useRef(null);

  const themeColors = COLORS;

  const fetchAnalyticsData = useCallback(async () => {
    setIsFilterLoading(true);
    let retries = 3;
    while (retries > 0) {
      try {
        const token = localStorage.getItem('jwt_token');
        if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined') {
          throw new Error('Aucun jeton valide trouvé');
        }
        console.log('Récupération des analyses avec le jeton:', token.substring(0, 10) + '...');

        // Valider les filtres
        const { start_date, end_date, category_id, order_type, start_hour, end_hour } = filters;
        if (!start_date || !end_date) {
          throw new Error('Les dates de début et de fin sont requises');
        }
        if (moment(start_date).isAfter(moment(end_date))) {
          throw new Error('La date de fin doit être postérieure à la date de début');
        }
        if (start_hour && !start_hour.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
          throw new Error('L\'heure de début doit être au format HH:mm');
        }
        if (end_hour && !end_hour.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
          throw new Error('L\'heure de fin doit être au format HH:mm');
        }
        if (start_hour && end_hour && start_hour >= end_hour) {
          throw new Error('L\'heure de fin doit être postérieure à l\'heure de début');
        }

        // Nettoyer les filtres : inclure uniquement les valeurs non vides
        const sanitizedFilters = {
          start_date,
          end_date,
          ...(category_id && { category_id }),
          ...(order_type && { order_type }),
          ...(start_hour && { start_hour }),
          ...(end_hour && { end_hour }),
        };

        const res = await api.get('/analytics-overview', {
          params: sanitizedFilters,
          headers: { 'Authorization': `Bearer ${token}` },
        });
        setAnalyticsData  (res.data);
        break;
      } catch (error) {
        console.error('Erreur lors de la récupération des données d\'analyse:', error.response?.data || error.message);
        retries--;
        if (retries === 0 || error.response?.status === 401) {
          if (error.response?.status === 401) {
            toast.error('Session expirée, veuillez vous reconnecter');
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('sessionId');
            delete api.defaults.headers.common['X-Session-Id'];
            delete api.defaults.headers.common['Authorization'];
            navigate('/login');
          } else {
            toast.error(error.response?.data?.error || error.message || 'Échec de la récupération des données d\'analyse');
            setAnalyticsData({
              totalOrders: { count: 0, change: null },
              totalRevenue: { revenue: '0.00', change: null },
              orderTypeBreakdown: [],
              topSellingItems: [],
              salesTrend: [],
              reservationStatus: { reservations: [], statusCounts: [] },
              categorySales: [],
              recentOrders: [],
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
          throw new Error('Aucun jeton valide trouvé');
        }
        console.log('Vérification de l\'authentification avec le jeton:', token.substring(0, 10) + '...');
        const res = await api.get('/check-auth', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.data.role !== 'admin') {
          toast.error('Accès administrateur requis');
          navigate('/login');
        } else {
          setUser(res.data);
        }
      } catch (err) {
        console.error('Échec de la vérification d\'authentification:', err.response?.data || err.message);
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('sessionId');
        delete api.defaults.headers.common['X-Session-Id'];
        delete api.defaults.headers.common['Authorization'];
        toast.error(err.response?.data?.error || 'Veuillez vous connecter');
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchCategories() {
      try {
        const token = localStorage.getItem('jwt_token');
        if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined') {
          throw new Error('Aucun jeton valide trouvé');
        }
        const res = await api.get('/categories', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        setCategories(res.data || []);
      } catch (error) {
        console.error('Erreur lors de la récupération des catégories:', error.response?.data || error.message);
        toast.error('Échec de la récupération des catégories');
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
        toast.success(`Nouvelle commande #${order.id} reçue`);
      },
      (updatedOrder) => {
        setAnalyticsData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            recentOrders: prev.recentOrders.map((o) => (o.id === parseInt(updatedOrder.orderId) ? { ...o, approved: updatedOrder.approved } : o)),
          };
        });
        toast.info(`Commande #${updatedOrder.orderId} mise à jour à ${updatedOrder.approved ? 'Approuvée' : 'Non approuvée'}`);
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
        toast.info(`Statut de la table ${data.table_number} mis à jour à ${data.status}`);
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
        toast.info(`Réservation #${data.id} mise à jour à ${data.status}`);
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
      if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    };
  }, [navigate, fetchAnalyticsData]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e, field) => {
    const value = e.target.value;
    if (value) {
      setFilters((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleQuickFilter = (period) => {
    let startDate, endDate;
    switch (period) {
      case 'today':
        startDate = moment().startOf('day').format('YYYY-MM-DD');
        endDate = moment().endOf('day').format('YYYY-MM-DD');
        break;
      case 'last7days':
        startDate = moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD');
        endDate = moment().endOf('day').format('YYYY-MM-DD');
        break;
      case 'last30days':
        startDate = moment().subtract(30, 'days').startOf('day').format('YYYY-MM-DD');
        endDate = moment().endOf('day').format('YYYY-MM-DD');
        break;
      default:
        startDate = moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD');
        endDate = moment().endOf('day').format('YYYY-MM-DD');
    }
    setFilters((prev) => ({
      ...prev,
      start_date: startDate,
      end_date: endDate,
      start_hour: '',
      end_hour: '',
    }));
    toast.success(`${period === 'today' ? 'Aujourd\'hui' : period === 'last7days' ? '7 derniers jours' : '30 derniers jours'} filtre appliqué`);
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => fetchAnalyticsData(), 300);
  };

  const handleFilterSubmit = async (e) => {
    e.preventDefault();
    const { start_date, end_date, start_hour, end_hour } = filters;
    if (!start_date || !end_date) {
      toast.error('Les dates de début et de fin sont requises');
      return;
    }
    if (moment(start_date).isAfter(moment(end_date))) {
      toast.error('La date de fin doit être postérieure à la date de début');
      return;
    }
    if (start_hour && !start_hour.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      toast.error('L\'heure de début doit être au format HH:mm');
      return;
    }
    if (end_hour && !end_hour.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      toast.error('L\'heure de fin doit être au format HH:mm');
      return;
    }
    if (start_hour && end_hour && start_hour >= end_hour) {
      toast.error('L\'heure de fin doit être postérieure à l\'heure de début');
      return;
    }
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(async () => {
      await fetchAnalyticsData();
      toast.success('Tableau de bord mis à jour avec les filtres sélectionnés');
    }, 300);
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      start_date: moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD'),
      end_date: moment().endOf('day').format('YYYY-MM-DD'),
      category_id: '',
      order_type: '',
      start_hour: '',
      end_hour: '',
    };
    setFilters(defaultFilters);
    toast.success('Filtres réinitialisés');
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => fetchAnalyticsData(), 300);
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
          <p className="loading-text">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="admin-dashboard">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">Impossible de charger les analyses</h2>
          <p className="error-message">Nous rencontrons des difficultés pour charger vos données d'analyse. Veuillez réessayer plus tard.</p>
          <button className="retry-button" onClick={fetchAnalyticsData}>
            Réessayer le chargement
          </button>
        </div>
      </div>
    );
  }

  const orderTypeBreakdown = analyticsData?.orderTypeBreakdown || [];
  const orderTypeChart = {
    type: 'pie',
    data: {
      labels: orderTypeBreakdown.map((item) => item?.order_type || 'Inconnu'),
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
      labels: topSellingItems.map((item) => item?.name || 'Inconnu'),
      datasets: [
        {
          label: 'Quantité vendue',
          data: topSellingItems.map((item) => item?.total_quantity || 0),
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
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
      labels: salesTrend.map((item) => moment(item?.time_period).format('DD MMM')),
      datasets: [
        {
          label: 'Revenus (DT)',
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
          label: 'Commandes',
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

  const categorySales = analyticsData?.categorySales || [];
  const categorySalesChart = {
    type: 'pie',
    data: {
      labels: categorySales.map((item) => item?.name || 'Inconnu'),
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
    { id: 'overview', label: 'Vue d\'ensemble', icon: <FiBarChart2 /> },
  ];

  return (
    <div className="admin-dashboard">
      <div className="main-content">
        <div className="dashboard-header">
          <div className="header-content">
            <div className="header-main">
              <h1 className="dashboard-title">
                <FiBarChart2 className="title-icon" />
                Tableau de bord analytique
              </h1>
              <p className="dashboard-subtitle">Bienvenue, {user?.name || 'Administrateur'}</p>
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
                  Filtres
                </h3>
              </div>
              <div className="quick-filters">
                <button
                  className={`quick-filter-button ${filters.start_date === moment().startOf('day').format('YYYY-MM-DD') && filters.end_date === moment().endOf('day').format('YYYY-MM-DD') && !filters.start_hour && !filters.end_hour ? 'active' : ''}`}
                  onClick={() => handleQuickFilter('today')}
                >
                  Aujourd'hui
                </button>
                <button
                  className={`quick-filter-button ${filters.start_date === moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD') && filters.end_date === moment().endOf('day').format('YYYY-MM-DD') && !filters.start_hour && !filters.end_hour ? 'active' : ''}`}
                  onClick={() => handleQuickFilter('last7days')}
                >
                  7 derniers jours
                </button>
                <button
                  className={`quick-filter-button ${filters.start_date === moment().subtract(30, 'days').startOf('day').format('YYYY-MM-DD') && filters.end_date === moment().endOf('day').format('YYYY-MM-DD') && !filters.start_hour && !filters.end_hour ? 'active' : ''}`}
                  onClick={() => handleQuickFilter('last30days')}
                >
                  30 derniers jours
                </button>
              </div>
              <form className="filter-form" onSubmit={handleFilterSubmit}>
                <div className="filter-group">
                  <label className="filter-label">Date de début</label>
                  <input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => handleDateChange(e, 'start_date')}
                    className="filter-input"
                    required
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Date de fin</label>
                  <input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => handleDateChange(e, 'end_date')}
                    className="filter-input"
                    required
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Heure de début</label>
                  <input
                    type="time"
                    value={filters.start_hour}
                    onChange={(e) => handleFilterChange('start_hour', e.target.value)}
                    className="filter-input"
                    placeholder="HH:mm"
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Heure de fin</label>
                  <input
                    type="time"
                    value={filters.end_hour}
                    onChange={(e) => handleFilterChange('end_hour', e.target.value)}
                    className="filter-input"
                    placeholder="HH:mm"
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Catégorie</label>
                  <select
                    name="category_id"
                    value={filters.category_id}
                    onChange={(e) => handleFilterChange('category_id', e.target.value)}
                    className="filter-input modern-select"
                  >
                    <option value="">Toutes les catégories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Type de commande</label>
                  <select
                    name="order_type"
                    value={filters.order_type}
                    onChange={(e) => handleFilterChange('order_type', e.target.value)}
                    className="filter-input modern-select"
                  >
                    <option value="">Tous les types</option>
                    <option value="local">Sur place</option>
                    <option value="delivery">Livraison</option>
                  </select>
                </div>
                <div className="filter-actions">
                  <button
                    type="submit"
                    disabled={isFilterLoading}
                    className="btn-primary"
                  >
                    {isFilterLoading ? 'Application...' : 'Appliquer les filtres'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleResetFilters}>
                    Réinitialiser
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
                    <h3 className="metric-title">Total des commandes</h3>
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
                    <h3 className="metric-title">Revenus totaux</h3>
                    <div className="metric-value">{parseFloat(analyticsData.totalRevenue.revenue).toFixed(2)} DT</div>
                    {analyticsData.totalRevenue.change !== null && (
                      <div className={`metric-change ${analyticsData.totalRevenue.change >= 0 ? 'positive' : 'negative'}`}>
                        {analyticsData.totalOrders.change >= 0 ? '↑' : '↓'} {Math.abs(analyticsData.totalRevenue.change)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="metric-card glass-card">
                <div className="metric-header">
                  <div className="metric-icon-wrapper categories">
                    <FiTag className="metric-icon" />
                  </div>
                  <div className="metric-info">
                    <h3 className="metric-title">Catégories</h3>
                    <div className="metric-value">{analyticsData.categorySales.length}</div>
                    <div className="metric-change neutral">📊 Actif</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="charts-layout">
              <div className="chart-card glass-card">
                <div className="chart-header">
                  <h3 className="chart-title">
                    <FiTrendingUp className="chart-icon" />
                    Tendance des ventes
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
                    Types de commandes
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
                    Ventes par catégorie
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
                    Articles les plus vendus
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
            </div>

            <div className="tables-section">
              <div className="table-card glass-card">
                <div className="table-header">
                  <h3 className="table-title">
                    <FiShoppingCart className="table-icon" />
                    Commandes récentes
                  </h3>
                </div>
                <div className="table-wrapper">
                  {analyticsData.recentOrders.length === 0 ? (
                    <div className="empty-state">
                      <FiShoppingCart className="empty-icon" />
                      <p className="empty-text">Aucune commande récente trouvée</p>
                    </div>
                  ) : (
                    <div className="modern-table">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>ID Commande</th>
                              <th>Table</th>
                              <th>Total</th>
                              <th>Type</th>
                              <th>Statut</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.recentOrders.map((order, index) => (
                              <tr key={order.id} style={{ animationDelay: `${index * 0.1}s` }}>
                                <td><span className="order-id">#{order.id}</span></td>
                                <td>{order.table_number || 'N/A'}</td>
                                <td><span className="price">{order.total_price} DT</span></td>
                                <td><span className={`order-type ${order.order_type}`}>{order.order_type === 'local' ? 'Sur place' : 'Livraison'}</span></td>
                                <td><span className={`status ${order.approved ? 'approved' : 'pending'}`}>{order.approved ? 'Approuvée' : 'En attente'}</span></td>
                                <td className="date-cell">{moment(order.created_at).format('DD MMM YYYY')}</td>
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
                    Réservations
                  </h3>
                </div>
                <div className="table-wrapper">
                  {analyticsData.reservationStatus.reservations.length === 0 ? (
                    <div className="empty-state">
                      <FiCalendar className="empty-icon" />
                      <p className="empty-text">Aucune réservation trouvée</p>
                    </div>
                  ) : (
                    <div className="modern-table">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Table</th>
                              <th>Heure</th>
                              <th>Téléphone</th>
                              <th>Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.reservationStatus.reservations.map((reservation, index) => (
                              <tr key={reservation.id} style={{ animationDelay: `${index * 0.1}s` }}>
                                <td><span className="reservation-id">#{reservation.id}</span></td>
                                <td>{reservation.table_number}</td>
                                <td className="time-cell">{moment(reservation.reservation_time).format('DD MMM YYYY HH:mm')}</td>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
