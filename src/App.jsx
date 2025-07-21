import { Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from './services/api';
import { initSocket, getSocket } from './services/socket';
import { v4 as uuidv4 } from 'uuid';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import AddMenuItem from './pages/AddMenuItem';
import Categories from './pages/Categories';
import CategoryMenu from './pages/CategoryMenu';
import CategoryList from './pages/CategoryList';
import ManageMenuItems from './pages/ManageMenuItems';
import ManageSupplements from './pages/ManageSupplements';
import ProductDetails from './pages/ProductDetails';
import TableManagement from './pages/TableManagement';
import OrderManagement from './pages/OrderManagement';
import UserManagement from './pages/UserManagement';
import PromotionManagement from './pages/PromotionManagement';
import Reservations from './pages/Reservations';
import AdminTableReservations from './pages/AdminTableReservations';
import StaffTableReservations from './pages/StaffTableReservations';
import OrderWaiting from './pages/OrderWaiting';
import BannerManagement from './pages/BannerManagement';
import AdminBreakfasts from './pages/AdminBreakfasts';
import BreakfastMenu from './pages/BreakfastMenu';
import ThemeManagement from './pages/ThemeManagement';
import ReusableOptionGroups from './pages/ReusableOptionGroups';
import Header from './components/Header';
import Footer from './components/Footer';
import CartModal from './components/CartModal';
import SupplementPopup from './components/SupplementPopup';

function App() {
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('local');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [promotionId, setPromotionId] = useState('');
  const [promotions, setPromotions] = useState([]);
  const [reusableOptionGroups, setReusableOptionGroups] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [error, setError] = useState(null);
  const [latestOrderId, setLatestOrderId] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [theme, setTheme] = useState(null);
  const [isSocketReady, setIsSocketReady] = useState(false);

  const defaultTheme = {
    primary_color: '#ff6b35',
    secondary_color: '#ff8c42',
    background_color: '#faf8f5',
    text_color: '#1f2937',
    logo_url: null,
    favicon_url: '/favicon.ico',
    site_title: 'Café Local',
  };

  const handleNewNotification = (notification) => {
    if (!notification.id) {
      console.warn('Received notification without ID:', notification, { timestamp: new Date().toISOString() });
      return;
    }
    toast.info(notification.message, { autoClose: 5000 });
  };

  const applyTheme = (themeData) => {
    document.documentElement.style.setProperty('--primary-color', themeData.primary_color);
    document.documentElement.style.setProperty('--secondary-color', themeData.secondary_color);
    document.documentElement.style.setProperty('--background-color', themeData.background_color);
    document.documentElement.style.setProperty('--text-color', themeData.text_color);

    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    const baseApiUrl = import.meta.env.VITE_API_URL || 'https://coffe-back-production-e0b2.up.railway.app';
    const faviconUrl = themeData.favicon_url
      ? `${baseApiUrl}/public${themeData.favicon_url}?v=${Date.now()}`
      : defaultTheme.favicon_url;
    favicon.href = faviconUrl;

    document.title = themeData.site_title || defaultTheme.site_title;
  };

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize deviceId: Reuse existing or generate new only if missing
      let storedDeviceId = localStorage.getItem('deviceId');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!storedDeviceId || !uuidRegex.test(storedDeviceId)) {
        storedDeviceId = uuidv4();
        localStorage.setItem('deviceId', storedDeviceId);
        console.log('Generated new deviceId:', storedDeviceId, { timestamp: new Date().toISOString() });
      } else {
        console.log('Reusing existing deviceId:', storedDeviceId, { timestamp: new Date().toISOString() });
      }
      setDeviceId(storedDeviceId);

      // Initialize sessionId
      let fallbackSessionId = localStorage.getItem('sessionId');
      if (!fallbackSessionId) {
        fallbackSessionId = `guest-${uuidv4()}`;
        localStorage.setItem('sessionId', fallbackSessionId);
      }
      setSessionId(fallbackSessionId);

      // Set API headers
      api.defaults.headers.common['X-Session-Id'] = fallbackSessionId;
      api.defaults.headers.common['X-Device-Id'] = storedDeviceId;

      const socketCleanup = initSocket(
        () => {},
        () => {},
        () => {},
        () => {},
        () => {},
        (data) => {
          if (socket && socket.connected) {
            console.log('Broadcasting orderApproved event:', data, { timestamp: new Date().toISOString() });
            socket.emit('orderApproved', data);
          } else {
            console.warn('Socket not connected, cannot broadcast orderApproved:', data, { timestamp: new Date().toISOString() });
          }
        },
        handleNewNotification
      );
      const socketInstance = getSocket();
      setSocket(socketInstance);
      setIsSocketReady(true);

      socketInstance.on('connect', () => {
        console.log('Socket connected in App.jsx', { sessionId: fallbackSessionId, deviceId: storedDeviceId, timestamp: new Date().toISOString() });
      });
      socketInstance.on('connect_error', (error) => {
        console.error('Socket connection error in App.jsx:', error.message, { timestamp: new Date().toISOString() });
        toast.warn('Real-time updates unavailable. Retrying connection...');
      });
      socketInstance.on('reconnect', (attempt) => {
        console.log('Socket reconnected in App.jsx after attempt:', attempt, { timestamp: new Date().toISOString() });
      });

      const checkAuth = async () => {
        try {
          const token = localStorage.getItem('jwt_token');
          if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined') {
            console.warn('No valid token found during auth check', { timestamp: new Date().toISOString() });
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('sessionId');
            delete api.defaults.headers.common['X-Session-Id'];
            setUser(null);
            // Regenerate sessionId for guest, reuse existing deviceId
            const newSessionId = `guest-${uuidv4()}`;
            localStorage.setItem('sessionId', newSessionId);
            setSessionId(newSessionId);
            api.defaults.headers.common['X-Session-Id'] = newSessionId;
            api.defaults.headers.common['X-Device-Id'] = storedDeviceId;
            return;
          }
          console.log('Checking auth with token:', token.substring(0, 10) + '...', { timestamp: new Date().toISOString() });
          const res = await api.get('/check-auth');
          setUser(res.data);
          const authSessionId = `user-${res.data.id}-${uuidv4()}`;
          setSessionId(authSessionId);
          localStorage.setItem('sessionId', authSessionId);
          api.defaults.headers.common['X-Session-Id'] = authSessionId;
          api.defaults.headers.common['X-Device-Id'] = storedDeviceId;
        } catch (err) {
          console.error('Error checking auth:', err.response?.data || err.message, { timestamp: new Date().toISOString() });
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('sessionId');
          delete api.defaults.headers.common['X-Session-Id'];
          setUser(null);
          // Regenerate sessionId for guest, reuse existing deviceId
          const newSessionId = `guest-${uuidv4()}`;
          localStorage.setItem('sessionId', newSessionId);
          setSessionId(newSessionId);
          api.defaults.headers.common['X-Session-Id'] = newSessionId;
          api.defaults.headers.common['X-Device-Id'] = storedDeviceId;
        }
      };

      const fetchPromotions = async () => {
        try {
          const response = await api.get('/promotions');
          setPromotions(response.data || []);
        } catch (error) {
          console.error('Error fetching promotions:', error.response?.data || error.message, { timestamp: new Date().toISOString() });
          toast.error(error.response?.data?.error || 'Failed to load promotions');
          setPromotions([]);
        }
      };

      const fetchReusableOptionGroups = async () => {
        try {
          const response = await api.get('/option-groups/reusable');
          setReusableOptionGroups(response.data || []);
        } catch (error) {
          console.error('Error fetching reusable option groups:', error.response?.data || error.message, { timestamp: new Date().toISOString() });
          toast.error(error.response?.data?.error || 'Failed to load reusable option groups');
          setReusableOptionGroups([]);
        }
      };

      const fetchTheme = async () => {
        try {
          const response = await api.getTheme();
          setTheme(response.data);
          applyTheme(response.data);
        } catch (error) {
          console.error('Error fetching theme:', error.response?.data || error.message, { timestamp: new Date().toISOString() });
          toast.error(error.response?.data?.error || 'Failed to load theme, applying default theme');
          setTheme(defaultTheme);
          applyTheme(defaultTheme);
        }
      };

      await Promise.all([checkAuth(), fetchPromotions(), fetchReusableOptionGroups(), fetchTheme()]).catch((err) => {
        console.error('Initialization error:', err, { timestamp: new Date().toISOString() });
        toast.error('Failed to initialize app');
      });

      return () => {
        socketInstance.off('connect');
        socketInstance.off('connect_error');
        socketInstance.off('reconnect');
        socketCleanup();
      };
    };

    initializeApp();
  }, []);

  const handleLogin = (user, token) => {
    if (!user || !token || typeof token !== 'string' || token === 'null' || token === 'undefined') {
      console.error('Invalid login data:', { user, token }, { timestamp: new Date().toISOString() });
      toast.error('Invalid login data received from server');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('sessionId');
      delete api.defaults.headers.common['X-Session-Id'];
      delete api.defaults.headers.common['Authorization'];
      navigate('/login');
      return;
    }
    setUser(user);
    localStorage.setItem('jwt_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const authSessionId = `user-${user.id}-${uuidv4()}`;
    setSessionId(authSessionId);
    localStorage.setItem('sessionId', authSessionId);
    api.defaults.headers.common['X-Session-Id'] = authSessionId;
    api.defaults.headers.common['X-Device-Id'] = deviceId; // Use existing deviceId
    console.log('Login successful, setting token:', token.substring(0, 10) + '...', 'sessionId:', authSessionId, 'deviceId:', deviceId, { timestamp: new Date().toISOString() });
    navigate(user.role === 'admin' ? '/admin' : '/staff');
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('sessionId');
      delete api.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['X-Session-Id'];
      const guestSessionId = `guest-${uuidv4()}`;
      setSessionId(guestSessionId);
      localStorage.setItem('sessionId', guestSessionId);
      api.defaults.headers.common['X-Session-Id'] = guestSessionId;
      api.defaults.headers.common['X-Device-Id'] = deviceId; // Retain deviceId
      setUser(null);
      setCart([]);
      setDeliveryAddress('');
      setPromotionId('');
      setIsCartOpen(false);
      toast.success('Successfully logged out');
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error.response?.data || error.message, { timestamp: new Date().toISOString() });
      toast.error('Logout failed');
    }
  };

  const addToCart = (item) => {
    if (!item || (!item.item_id && !item.breakfast_id)) {
      console.error('Invalid item:', item, { timestamp: new Date().toISOString() });
      toast.error('Cannot add item to cart');
      return;
    }

    setCart((prev) => {
      if (item.item_id) {
        const itemKey = `${item.item_id}_${item.supplement_id || 'no-supplement'}`;
        const existingItem = prev.find(
          (cartItem) => `${cartItem.item_id}_${cartItem.supplement_id || 'no-supplement'}` === itemKey
        );
        if (existingItem) {
          return prev.map((cartItem) =>
            cartItem.cartItemId === existingItem.cartItemId
              ? {
                  ...cartItem,
                  quantity: cartItem.quantity + (item.quantity || 1),
                }
              : cartItem
          );
        }
        return [
          ...prev,
          {
            cartItemId: uuidv4(),
            item_id: item.item_id,
            quantity: item.quantity || 1,
            unit_price: parseFloat(item.unit_price || item.sale_price || item.regular_price || 0),
            name: item.name || 'Unknown Item',
            image_url: item.image_url || null,
            supplement_id: item.supplement_id || null,
            supplement_name: item.supplement_name || null,
            supplement_price: parseFloat(item.supplement_price || 0),
          },
        ];
      }

      if (item.breakfast_id) {
        const optionIds = item.option_ids ? item.option_ids.sort().join('-') : 'no-options';
        const itemKey = `${item.breakfast_id}_${optionIds}`;
        const existingItem = prev.find(
          (cartItem) =>
            cartItem.breakfast_id === item.breakfast_id &&
            (cartItem.option_ids ? cartItem.option_ids.sort().join('-') : 'no-options') === optionIds
        );
        if (existingItem) {
          return prev.map((cartItem) =>
            cartItem.cartItemId === existingItem.cartItemId
              ? {
                  ...cartItem,
                  quantity: cartItem.quantity + (item.quantity || 1),
                }
              : cartItem
          );
        }
        return [
          ...prev,
          {
            cartItemId: uuidv4(),
            breakfast_id: item.breakfast_id,
            quantity: item.quantity || 1,
            unit_price: parseFloat(item.unit_price || item.sale_price || item.regular_price || 0),
            name: item.name || 'Unknown Breakfast',
            image_url: item.image_url || null,
            option_ids: item.option_ids || [],
            options: item.options || [],
          },
        ];
      }

      return prev;
    });
    setIsCartOpen(true);
    toast.success(`${item.name || 'Item'} added to cart`);
  };

  const updateQuantity = (cartItemId, quantity, supplement = null, options = null) => {
    if (quantity < 1) {
      setCart((prev) => prev.filter((cartItem) => cartItem.cartItemId !== cartItemId));
    } else {
      setCart((prev) => {
        const targetItem = prev.find((cartItem) => cartItem.cartItemId === cartItemId);
        if (!targetItem) return prev;

        if (targetItem.item_id) {
          const newSupplementId = supplement?.supplement_id || targetItem.supplement_id || 'no-supplement';
          const itemKey = `${targetItem.item_id}_${newSupplementId}`;
          const existingItem = prev.find(
            (cartItem) =>
              cartItem.cartItemId !== cartItemId &&
              `${cartItem.item_id}_${cartItem.supplement_id || 'no-supplement'}` === itemKey
          );

          if (existingItem && supplement) {
            return prev
              .filter((cartItem) => cartItem.cartItemId !== cartItemId)
              .map((cartItem) =>
                cartItem.cartItemId === existingItem.cartItemId
                  ? {
                      ...cartItem,
                      quantity: cartItem.quantity + quantity,
                      supplement_id: supplement.supplement_id,
                      supplement_name: supplement.supplement_name,
                      supplement_price: parseFloat(supplement.supplement_price || 0),
                    }
                  : cartItem
              );
          }

          return prev.map((cartItem) =>
            cartItem.cartItemId === cartItemId
              ? {
                  ...cartItem,
                  quantity,
                  ...(supplement && {
                    supplement_id: supplement.supplement_id,
                    supplement_name: supplement.supplement_name,
                    supplement_price: parseFloat(supplement.supplement_price || 0),
                  }),
                }
              : cartItem
          );
        }

        if (targetItem.breakfast_id) {
          const newOptionIds = options?.option_ids ? options.option_ids.sort().join('-') : targetItem.option_ids.sort().join('-');
          const itemKey = `${targetItem.breakfast_id}_${newOptionIds}`;
          const existingItem = prev.find(
            (cartItem) =>
              cartItem.cartItemId !== cartItemId &&
              cartItem.breakfast_id === targetItem.breakfast_id &&
              (cartItem.option_ids ? cartItem.option_ids.sort().join('-') : 'no-options') === newOptionIds
          );

          if (existingItem && options) {
            return prev
              .filter((cartItem) => cartItem.cartItemId !== cartItemId)
              .map((cartItem) =>
                cartItem.cartItemId === existingItem.cartItemId
                  ? {
                      ...cartItem,
                      quantity: cartItem.quantity + quantity,
                      option_ids: options.option_ids,
                      options: options.options,
                    }
                  : cartItem
              );
          }

          return prev.map((cartItem) =>
            cartItem.cartItemId === cartItemId
              ? {
                  ...cartItem,
                  quantity,
                  ...(options && {
                    option_ids: options.option_ids,
                    options: options.options,
                  }),
                }
              : cartItem
          );
        }

        return prev;
      });
    }
  };

  const clearCart = () => {
    setCart([]);
    setDeliveryAddress('');
    setPromotionId('');
    setIsCartOpen(false);
  };

  useEffect(() => {
    const handleError = (event) => {
      console.error('Global error:', event.message || 'Unknown error', { timestamp: new Date().toISOString() });
      toast.error('An error occurred: ' + (event.message || 'Unknown error'));
      setError('An unexpected error occurred. Please try refreshing the page.');
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    return <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>{error}</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', minHeight: '100vh' }}>
      <Header
        cart={cart}
        setIsCartOpen={setIsCartOpen}
        user={user}
        handleLogout={handleLogout}
        theme={theme}
      />
      <Routes>
        <Route path="/" element={<Home addToCart={addToCart} />} />
        <Route path="/categories" element={<CategoryList />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/staff" element={<StaffDashboard user={user} handleNewNotification={handleNewNotification} socket={socket} />} />
        <Route path="/admin/add-menu-item" element={<AddMenuItem />} />
        <Route path="/admin/categories" element={<Categories />} />
        <Route path="/admin/manage-menu-items" element={<ManageMenuItems />} />
        <Route path="/admin/supplements" element={<ManageSupplements />} />
        <Route path="/admin/tables" element={<TableManagement />} />
        <Route path="/admin/orders" element={<OrderManagement />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/promotions" element={<PromotionManagement />} />
        <Route path="/admin/banners" element={<BannerManagement />} />
        <Route path="/admin/breakfasts" element={<AdminBreakfasts reusableOptionGroups={reusableOptionGroups} />} />
        <Route path="/admin/reusable-option-groups" element={<ReusableOptionGroups />} />
        <Route path="/admin/table-reservations" element={<AdminTableReservations />} />
        <Route path="/admin/theme" element={<ThemeManagement />} />
        <Route path="/staff/table-reservations" element={<StaffTableReservations />} />
        <Route path="/category/:id" element={<CategoryMenu addToCart={addToCart} />} />
        <Route path="/product/:id" element={<ProductDetails addToCart={addToCart} latestOrderId={latestOrderId} />} />
        <Route
          path="/order-waiting/:orderId"
          element={isSocketReady ? <OrderWaiting sessionId={sessionId} socket={socket} /> : <div>Loading socket...</div>}
        />
        <Route path="/breakfast" element={<BreakfastMenu addToCart={addToCart} reusableOptionGroups={reusableOptionGroups} />} />
        <Route path="/breakfast/:id" element={<BreakfastMenu addToCart={addToCart} reusableOptionGroups={reusableOptionGroups} />} />
        <Route path="*" element={<div style={{ textAlign: 'center', color: '#666' }}>404 Not Found</div>} />
      </Routes>
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        updateQuantity={updateQuantity}
        orderType={orderType}
        setOrderType={setOrderType}
        deliveryAddress={deliveryAddress}
        setDeliveryAddress={setDeliveryAddress}
        promotionId={promotionId}
        setPromotionId={setPromotionId}
        promotions={promotions}
        clearCart={clearCart}
        sessionId={sessionId}
        socket={socket}
      />
      <Footer />
    </div>
  );
}

export default App;
