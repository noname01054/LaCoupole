import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import Chart from 'chart.js/auto';
import './css/StockDashboard.css';

const StockDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    ingredients: [],
    lowStock: [],
    transactions: [],
    associations: { menuItems: [], breakfasts: [], supplements: [], breakfastOptions: [] },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const chartRefs = useRef({
    usageChart: null,
    topUsedChart: null,
    refillChart: null,
  });

  // Function to get user_id from JWT
  const getUserIdFromToken = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
      console.error('No valid JWT token found');
      return null;
    }
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      return decoded.id;
    } catch (error) {
      console.error('Error decoding JWT:', error.message);
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('deviceId');
      return null;
    }
  };

  // Validate token before making requests
  const validateToken = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
      setError('No valid authentication token found. Please log in again.');
      toast.error('Please log in again.');
      window.location.href = '/login';
      return false;
    }
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        setError('Authentication token has expired. Please log in again.');
        toast.error('Session expired. Please log in again.');
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('deviceId');
        window.location.href = '/login';
        return false;
      }
      return true;
    } catch (error) {
      setError('Invalid authentication token. Please log in again.');
      toast.error('Invalid token. Please log in again.');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('deviceId');
      window.location.href = '/login';
      return false;
    }
  };

  // Function to create charts with proper timing
  const createCharts = () => {
    // Add a small delay to ensure DOM is fully rendered
    setTimeout(() => {
      // Ingredient Usage Over Time (Line Chart)
      const usageCanvas = document.getElementById('usageChart');
      if (usageCanvas) {
        const usageCtx = usageCanvas.getContext('2d');
        if (usageCtx) {
          // Destroy existing chart
          if (chartRefs.current.usageChart) {
            chartRefs.current.usageChart.destroy();
          }
          
          chartRefs.current.usageChart = new Chart(usageCtx, {
            type: 'line',
            data: {
              labels: ['2025-07-17', '2025-07-18', '2025-07-19', '2025-07-20', '2025-07-21', '2025-07-22', '2025-07-23'],
              datasets: [
                {
                  label: 'Coffee',
                  data: [50, 55, 60, 65, 70, 75, 80],
                  borderColor: '#1e40af',
                  backgroundColor: 'rgba(30, 64, 175, 0.1)',
                  fill: true,
                  tension: 0.4,
                },
                {
                  label: 'Milk',
                  data: [30, 35, 40, 45, 50, 55, 60],
                  borderColor: '#15803d',
                  backgroundColor: 'rgba(21, 128, 61, 0.1)',
                  fill: true,
                  tension: 0.4,
                },
                {
                  label: 'Sugar',
                  data: [20, 25, 30, 35, 40, 45, 50],
                  borderColor: '#b91c1c',
                  backgroundColor: 'rgba(185, 28, 28, 0.1)',
                  fill: true,
                  tension: 0.4,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                intersect: false,
              },
              scales: {
                x: { 
                  grid: { display: false },
                  ticks: { maxRotation: 45 }
                },
                y: { 
                  beginAtZero: true, 
                  title: { display: true, text: 'Quantity Used (kg)' }
                },
              },
              plugins: { 
                legend: { position: 'top' },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                }
              },
            },
          });
        }
      }

      // Top Used Ingredients (Bar Chart)
      const topUsedCanvas = document.getElementById('topUsedChart');
      if (topUsedCanvas) {
        const topUsedCtx = topUsedCanvas.getContext('2d');
        if (topUsedCtx) {
          if (chartRefs.current.topUsedChart) {
            chartRefs.current.topUsedChart.destroy();
          }
          
          chartRefs.current.topUsedChart = new Chart(topUsedCtx, {
            type: 'bar',
            data: {
              labels: ['Coffee', 'Milk', 'Sugar', 'Syrup', 'Cream'],
              datasets: [{
                label: 'Usage This Week (kg)',
                data: [200, 150, 100, 80, 60],
                backgroundColor: [
                  '#1e40af',
                  '#15803d', 
                  '#b91c1c',
                  '#d97706',
                  '#7c3aed'
                ],
                borderColor: [
                  '#1e40af',
                  '#15803d', 
                  '#b91c1c',
                  '#d97706',
                  '#7c3aed'
                ],
                borderWidth: 1,
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, title: { display: true, text: 'Quantity (kg)' } },
              },
              plugins: { legend: { display: false } },
            },
          });
        }
      }

      // Stock Refill History (Stacked Bar Chart)
      const refillCanvas = document.getElementById('refillChart');
      if (refillCanvas) {
        const refillCtx = refillCanvas.getContext('2d');
        if (refillCtx) {
          if (chartRefs.current.refillChart) {
            chartRefs.current.refillChart.destroy();
          }
          
          chartRefs.current.refillChart = new Chart(refillCtx, {
            type: 'bar',
            data: {
              labels: ['2025-07-01', '2025-07-08', '2025-07-15'],
              datasets: [
                {
                  label: 'Coffee',
                  data: [50, 60, 70],
                  backgroundColor: '#1e40af',
                },
                {
                  label: 'Milk',
                  data: [40, 50, 60],
                  backgroundColor: '#15803d',
                },
                {
                  label: 'Sugar',
                  data: [30, 40, 50],
                  backgroundColor: '#b91c1c',
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { 
                  stacked: true, 
                  grid: { display: false },
                  ticks: { maxRotation: 45 }
                },
                y: { 
                  stacked: true, 
                  beginAtZero: true, 
                  title: { display: true, text: 'Quantity (kg)' } 
                },
              },
              plugins: { legend: { position: 'top' } },
            },
          });
        }
      }
    }, 100); // 100ms delay to ensure DOM is ready
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!validateToken()) return;

      setIsLoading(true);
      setError(null);
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        const user_id = getUserIdFromToken();
        if (!user_id) {
          throw new Error('User ID not found. Please log in again.');
        }

        const res = await api.getStockDashboard({ user_id }, { signal });
        setDashboardData(res.data);
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Fetch aborted due to component unmount');
          return;
        }
        console.error('Error fetching stock dashboard:', error.response?.data || error.message);
        if (error.response?.status === 403) {
          setError('Admin access required. Please log in with an admin account.');
          toast.error('Admin access required. Please log in with an admin account.');
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('sessionId');
          localStorage.removeItem('deviceId');
          window.location.href = '/login';
        } else {
          setError(error.response?.data?.error || 'Failed to fetch stock dashboard');
          toast.error(error.response?.data?.error || 'Failed to fetch stock dashboard');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Create charts after data is loaded and component is mounted
  useEffect(() => {
    if (!isLoading && dashboardData) {
      createCharts();
    }

    return () => {
      // Clean up charts on unmount
      Object.values(chartRefs.current).forEach(chart => {
        if (chart) {
          chart.destroy();
        }
      });
    };
  }, [isLoading, dashboardData]);

  // Handle window resize to redraw charts
  useEffect(() => {
    const handleResize = () => {
      if (!isLoading && dashboardData) {
        // Redraw charts after a small delay
        setTimeout(() => {
          Object.values(chartRefs.current).forEach(chart => {
            if (chart) {
              chart.resize();
            }
          });
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLoading, dashboardData]);

  if (error) {
    return (
      <div className="dashboard-container">
        <p className="error-message">{error}</p>
        <button className="action-button" onClick={() => window.location.href = '/login'}>
          Go to Login
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <p className="loading-message">Loading...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Stock Dashboard</h1>
        <button className="action-button" onClick={() => window.location.href = '/admin/stock/add'}>
          Manage Inventory
        </button>
      </div>
      <div className="dashboard-grid">
        {/* Analytics Charts */}
        <div className="dashboard-card chart-card">
          <h2 className="card-title">Ingredient Usage Over Time</h2>
          <div className="chart-container">
            <canvas id="usageChart" width="400" height="300"></canvas>
          </div>
        </div>

        <div className viera="dashboard-card chart-card">
          <h2 className="card-title">Top Used Ingredients</h2>
          <div className="chart-container">
            <canvas id="topUsedChart" width="400" height="300"></canvas>
          </div>
        </div>

        <div className="dashboard-card chart-card">
          <h2 className="card-title">Stock Refill History</h2>
          <div className="chart-container">
            <canvas id="refillChart" width="400" height="300"></canvas>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="dashboard-card low-stock-card">
          <h2 className="card-title">
            <span className="warning-icon">⚠</span> Low Stock Alerts
          </h2>
          <div className="low-stock-wrapper">
            {dashboardData.lowStock.length === 0 ? (
              <p className="no-data">No low stock items</p>
            ) : (
              <ul className="low-stock-list">
                {dashboardData.lowStock.slice(0, 5).map((item, index) => (
                  <li key={`low-stock-${item.id}-${index}`} className="low-stock-item">
                    <span className="item-name">{item.name}</span>: {item.quantity_in_stock} {item.unit} (Threshold: {item.low_stock_threshold})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* All Ingredients */}
        <div className="dashboard-card ingredients-table-card">
          <h2 className="card-title">All Ingredients</h2>
          <div className="table-wrapper ingredients-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Threshold</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.ingredients.slice(0, 5).map((item, index) => (
                  <tr key={`ingredient-${item.id}-${index}`} className={index % 2 === 0 ? 'even-row' : ''}>
                    <td>{item.name}</td>
                    <td>{item.quantity_in_stock}</td>
                    <td>{item.unit}</td>
                    <td>{item.low_stock_threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="dashboard-card transactions-table-card">
          <h2 className="card-title">Recent Transactions</h2>
          <div className="table-wrapper transactions-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Quantity</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.transactions.slice(0, 5).map((tx, index) => (
                  <tr key={`transaction-${tx.id}-${index}`} className={index % 2 === 0 ? 'even-row' : ''}>
                    <td>{tx.name}</td>
                    <td>{tx.quantity}</td>
                    <td className={tx.transaction_type === 'addition' ? 'add-type' : 'remove-type'}>
                      {tx.transaction_type}
                    </td>
                    <td>{tx.reason || '-'}</td>
                    <td>{new Date(tx.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ingredient Associations */}
        <div className="dashboard-card associations-card">
          <h2 className="card-title">Ingredient Associations</h2>
          <div className="associations-content associations-wrapper">
            <div className="association-section">
              <h3 className="section-title">Menu Items</h3>
              <ul className="association-list">
                {dashboardData.associations.menuItems.slice(0, 5).map((assoc, index) => (
                  <li key={`menu-item-${assoc.id}-${index}`}>
                    {assoc.name}: {assoc.quantity} {assoc.unit} of {assoc.ingredient_name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="association-section">
              <h3 className="section-title">Breakfasts</h3>
              <ul className="association-list">
                {dashboardData.associations.breakfasts.slice(0, 5).map((assoc, index) => (
                  <li key={`breakfast-${assoc.id}-${index}`}>
                    {assoc.name}: {assoc.quantity} {assoc.unit} of {assoc.ingredient_name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="association-section">
              <h3 className="section-title">Supplements</h3>
              <ul className="association-list">
                {dashboardData.associations.supplements.slice(0, 5).map((assoc, index) => (
                  <li key={`supplement-${assoc.id}-${index}`}>
                    {assoc.name}: {assoc.quantity} {assoc.unit} of {assoc.ingredient_name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="association-section">
              <h3 className="section-title">Breakfast Options</h3>
              <ul className="association-list">
                {dashboardData.associations.breakfastOptions.slice(0, 5).map((assoc, index) => (
                  <li key={`breakfast-option-${assoc.id}-${index}`}>
                    {assoc.option_name}: {assoc.quantity} {assoc.unit} of {assoc.ingredient_name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockDashboard;
