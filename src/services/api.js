import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://coffe-back-production-e0b2.up.railway.app',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increased to 30 seconds
});

api.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${config.method.toUpperCase()}] ${config.url}`, { headers: config.headers });
    }
    const token = localStorage.getItem('jwt_token');
    if (token) {
      if (typeof token !== 'string' || token === 'null' || token === 'undefined' || !token.trim()) {
        console.warn('Invalid token detected, clearing localStorage');
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('sessionId');
        delete config.headers.Authorization;
        delete config.headers['X-Session-Id'];
      } else {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('Setting Authorization header:', `Bearer ${token.substring(0, 10)}...`);
      }
    } else {
      console.log('No token found for request:', config.url);
      delete config.headers.Authorization;
    }
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId && typeof sessionId === 'string' && sessionId.trim()) {
      config.headers['X-Session-Id'] = sessionId;
    } else {
      delete config.headers['X-Session-Id'];
    }
    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data';
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error.message, { config: error.config });
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Response] ${response.config.url}: ${response.status}`, { data: response.data });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const message = error.response?.data?.error || error.message;
    console.error(`[Error] ${error.config?.url}: ${message}`, { status: error.response?.status, headers: error.response?.headers });
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const token = localStorage.getItem('jwt_token');
        if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined' || !token.trim()) {
          console.warn('No valid token for refresh, redirecting to login');
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('sessionId');
          delete api.defaults.headers.common['X-Session-Id'];
          delete api.defaults.headers.common['Authorization'];
          window.location.href = '/login';
          return Promise.reject(error);
        }
        console.log('Attempting token refresh with:', token.substring(0, 10) + '...');
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL || 'https://coffe-back-production-e0b2.up.railway.app'}/api/refresh-token`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const newToken = res.data.token;
        if (!newToken || typeof newToken !== 'string' || !newToken.trim()) {
          throw new Error('Invalid refresh token received');
        }
        localStorage.setItem('jwt_token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        console.log('Token refreshed successfully:', newToken.substring(0, 10) + '...');
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('sessionId');
        delete api.defaults.headers.common['X-Session-Id'];
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Notification API methods
api.getNotifications = (params) => api.get('/api/notifications', { params });
api.markNotificationRead = (id) => api.put(`/api/notifications/${id}/read`);
api.clearNotifications = () => api.put('/api/notifications/clear');

// Table and reservation API methods
api.getTables = () => api.get('/api/tables');
api.getAvailableTables = () => api.get('/api/tables?status=available');
api.addTable = (data) => api.post('/api/tables', data);
api.updateTable = (id, data) => api.put(`/api/tables/${id}`, data);
api.deleteTable = (id, data) => api.delete(`/api/tables/${id}`, { data });
api.getReservations = () => api.get('/api/reservations');
api.addReservation = (data) => api.post('/api/reservations', data);
api.updateReservation = (id, data) => api.put(`/api/reservations/${id}`, data);

// Rating API methods
api.submitRating = (data) => api.post('/api/ratings', data);
api.getRatingsByItem = (itemId) => api.get(`/api/ratings?item_id=${itemId}`);
api.getRatingsByBreakfast = (breakfastId) => api.get(`/api/ratings?breakfast_id=${breakfastId}`);

// User management API methods
api.updateUser = (id, data) => api.put(`/api/users/${id}`, data);
api.deleteUser = (id, data) => api.delete(`/api/users/${id}`, { data });

// Category management API methods
api.addCategory = (data) => api.post('/api/categories', data);
api.updateCategory = (id, data) => api.put(`/api/categories/${id}`, data);
api.deleteCategory = (id, data) => api.delete(`/api/categories/${id}`, { data });
api.getTopCategories = () => api.get('/api/categories/top');

// Menu item API methods
api.addMenuItem = (data) => api.post('/api/menu-items', data);
api.updateMenuItem = (id, data) => api.put(`/api/menu-items/${id}`, data);
api.deleteMenuItem = (id, data) => api.delete(`/api/menu-items/${id}`, { data });
api.searchMenuItems = (query) => api.get('/api/menu-items/search', { params: { query } });
api.getBestSellers = () => api.get('/api/menu-items/best-sellers');

// Supplement API methods
api.getSupplementsByMenuItem = (menuItemId) => api.get(`/api/menu-items/${menuItemId}/supplements`);
api.addSupplementToMenuItem = (menuItemId, data) => api.post(`/api/menu-items/${menuItemId}/supplements`, data);
api.updateSupplementForMenuItem = (menuItemId, supplementId, data) => api.put(`/api/menu-items/${menuItemId}/supplements/${supplementId}`, data);
api.deleteSupplementFromMenuItem = (menuItemId, supplementId, data) => api.delete(`/api/menu-items/${menuItemId}/supplements/${supplementId}`, { data });

// Order API methods
api.submitOrder = (data) => api.post('/api/orders', data);
api.approveOrder = (id) => api.post(`/api/orders/${id}/approve`);
api.getOrder = (id) => api.get(`/api/orders/${id}`);
api.getSession = () => api.get('/api/session');

// Banner API methods
api.getBanners = (params) => api.get('/api/banners', { params });
api.getEnabledBanners = () => api.get('/api/banners/enabled');
api.addBanner = (data) => api.post('/api/banners', data);
api.updateBanner = (id, data) => api.put(`/api/banners/${id}`, data);
api.deleteBanner = (id, data) => api.delete(`/api/banners/${id}`, { data });

// Breakfast API methods
api.getBreakfasts = () => api.get('/api/breakfasts');
api.getBreakfast = (id) => api.get(`/api/breakfasts/${id}`);
api.getBreakfastOptions = (id) => api.get(`/api/breakfasts/${id}/options`);
api.addBreakfast = (data) => api.post('/api/breakfasts', data);
api.updateBreakfast = (id, data) => api.put(`/api/breakfasts/${id}`, data);
api.deleteBreakfast = (id, data) => api.delete(`/api/breakfasts/${id}`, { data });
api.addBreakfastOption = (id, data) => api.post(`/api/breakfasts/${id}/options`, data);
api.deleteBreakfastOption = (breakfastId, optionId, data) => api.delete(`/api/breakfasts/${breakfastId}/options/${optionId}`, { data });
api.getBreakfastOptionGroups = (id) => api.get(`/api/breakfasts/${id}/option-groups`);
api.addBreakfastOptionGroup = (id, data) => api.post(`/api/breakfasts/${id}/option-groups`, data);
api.updateBreakfastOptionGroup = (breakfastId, groupId, data) => api.put(`/api/breakfasts/${breakfastId}/option-groups/${groupId}`, data);
api.deleteBreakfastOptionGroup = (breakfastId, groupId, data) => api.delete(`/api/breakfasts/${breakfastId}/option-groups/${groupId}`, { data });
api.updateBreakfastOption = (breakfastId, optionId, data) => api.put(`/api/breakfasts/${breakfastId}/options/${optionId}`, data);

// Theme API methods
api.getTheme = () => api.get('/api/theme');
api.updateTheme = (data) => api.put('/api/theme', data);
api.updateBranding = (data) => api.put('/api/theme/branding', data);

export { api };
