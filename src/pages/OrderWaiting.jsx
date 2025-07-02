import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import './css/OrderWaiting.css';

function OrderWaiting({ sessionId: propSessionId, socket }) {
  const { orderId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [itemsVisible, setItemsVisible] = useState(false);
  const audioRef = useRef(null);
  const hasPlayedSound = useRef(false);
  const hasInteracted = useRef(false);

  // Prioritize sessionId from navigation state
  const sessionId = state?.sessionId || localStorage.getItem('sessionId') || propSessionId || `guest-${uuidv4()}`;
  const isMounted = useRef(false);

  // Preload audio and validate
  useEffect(() => {
    const audioPath = '/assets/notification1.mp3';
    audioRef.current = new Audio(audioPath);
    audioRef.current.preload = 'auto';

    // Validate audio file existence
    fetch(audioPath, { method: 'HEAD' })
      .then((response) => {
        if (!response.ok) {
          console.error(`Audio file not found at ${audioPath}`, { timestamp: new Date().toISOString() });
          toast.error('Order approval sound file is missing.');
        } else {
          console.log(`Audio file preloaded successfully: ${audioPath}`, { timestamp: new Date().toISOString() });
        }
      })
      .catch((err) => {
        console.error('Error checking audio file:', err, { timestamp: new Date().toISOString() });
        toast.error('Failed to load order approval sound.');
      });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Debounced state update for orderDetails
  const debouncedSetOrderDetails = useCallback(
    debounce((newDetails) => {
      setOrderDetails(newDetails);
    }, 100),
    []
  );

  useEffect(() => {
    if (!state?.sessionId && !localStorage.getItem('sessionId')) {
      console.warn('No sessionId found in state or localStorage, generated new:', sessionId, 'timestamp:', new Date().toISOString());
      localStorage.setItem('sessionId', sessionId);
      api.defaults.headers.common['X-Session-Id'] = sessionId;
    }
    console.log('OrderWaiting initialized with sessionId:', sessionId, 'orderId:', orderId, 'timestamp:', new Date().toISOString());
  }, [sessionId, orderId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!isLoading && !errorMessage) {
      setTimeout(() => setIsVisible(true), 100);
      setTimeout(() => setItemsVisible(true), 300);
    }
  }, [isLoading, errorMessage]);

  const fetchOrder = useCallback(async () => {
    if (!orderId || isNaN(parseInt(orderId))) {
      setErrorMessage('Invalid order ID.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.getOrder(orderId, { headers: { 'Cache-Control': 'no-cache' } });
      console.log('Fetched order details:', response.data, 'timestamp:', new Date().toISOString());
      debouncedSetOrderDetails(response.data);
      setIsApproved(!!response.data.approved);
      setIsLoading(false);
    } catch (error) {
      console.error('Fetch order error:', {
        status: error.response?.status,
        message: error.response?.data?.error || error.message,
        timestamp: new Date().toISOString(),
      });
      if (error.response?.status === 403) {
        setErrorMessage('Access denied: You are not authorized to view this order.');
      } else if (error.response?.status === 404) {
        setErrorMessage('Order not found.');
      } else if (error.response?.status === 500) {
        setErrorMessage('Server error. Please try again later.');
      } else {
        setErrorMessage('Failed to load order details. Check your connection.');
      }
      setIsLoading(false);
    }
  }, [orderId, debouncedSetOrderDetails]);

  const playSound = async () => {
    if (!audioRef.current) {
      console.warn('Audio not initialized', { timestamp: new Date().toISOString() });
      return;
    }
    if (!hasInteracted.current) {
      console.log('Waiting for user interaction to play sound', { timestamp: new Date().toISOString() });
      // Retry after interaction
      const retrySound = () => {
        if (hasInteracted.current && !hasPlayedSound.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((err) => {
            console.error('Retry audio play error:', err, { timestamp: new Date().toISOString() });
            toast.warn('Order approval sound blocked by browser.');
          });
          hasPlayedSound.current = true;
          window.removeEventListener('click', retrySound);
          window.removeEventListener('keydown', retrySound);
        }
      };
      window.addEventListener('click', retrySound);
      window.addEventListener('keydown', retrySound);
      return;
    }
    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      console.log('Order approval sound played successfully', { timestamp: new Date().toISOString() });
      hasPlayedSound.current = true;
    } catch (err) {
      console.error('Audio playback failed:', err, { timestamp: new Date().toISOString() });
      toast.warn('Order approval sound blocked by browser.');
    }
  };

  const onOrderApproved = useCallback(
    (data) => {
      console.log('OrderWaiting received orderApproved event:', {
        data,
        expectedOrderId: orderId,
        sessionId,
        timestamp: new Date().toISOString(),
      });
      if (!data.orderId) {
        console.warn('Invalid orderApproved event: missing orderId', data, 'timestamp:', new Date().toISOString());
        toast.warn('Received invalid order approval data');
        return;
      }
      if (parseInt(data.orderId) === parseInt(orderId)) {
        console.log('Processing order approval for orderId:', data.orderId, 'timestamp:', new Date().toISOString());
        setIsProcessingApproval(true);
        setIsApproved(true);
        if (!hasPlayedSound.current) {
          playSound();
        }
        // Use orderDetails from event if available, otherwise fetch
        if (data.orderDetails && Object.keys(data.orderDetails).length > 0) {
          debouncedSetOrderDetails((prev) => {
            const updatedDetails = {
              ...prev,
              ...data.orderDetails,
              approved: 1,
              status: data.orderDetails?.status || 'preparing',
            };
            console.log('Updated orderDetails from event:', updatedDetails, 'timestamp:', new Date().toISOString());
            return updatedDetails;
          });
          setIsLoading(false);
          setIsProcessingApproval(false);
        } else {
          // Fetch order details immediately to ensure data is available
          fetchOrder();
          setTimeout(() => setIsProcessingApproval(false), 500);
        }
        toast.success(`Order #${orderId} has been approved!`, { autoClose: 3000 });
      } else {
        console.log('orderApproved event ignored, orderId mismatch:', {
          received: data.orderId,
          expected: orderId,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [orderId, sessionId, debouncedSetOrderDetails, fetchOrder]
  );

  const onOrderUpdate = useCallback(
    (data) => {
      console.log('OrderWaiting received orderUpdate event:', {
        data,
        expectedOrderId: orderId,
        sessionId,
        timestamp: new Date().toISOString(),
      });
      if (parseInt(data.orderId) === parseInt(orderId)) {
        debouncedSetOrderDetails((prev) => {
          const updatedDetails = {
            ...prev,
            ...data.orderDetails,
            status: data.status || prev?.status || 'received',
          };
          console.log('Updated orderDetails on orderUpdate:', updatedDetails, 'timestamp:', new Date().toISOString());
          return updatedDetails;
        });
        toast.info(`Order #${orderId} updated to ${data.status}`, { autoClose: 3000 });
      }
    },
    [orderId, sessionId, debouncedSetOrderDetails]
  );

  useEffect(() => {
    if (!sessionId || !socket || !socket.connected) {
      console.error('Missing or disconnected socket:', {
        sessionId,
        socketConnected: socket?.connected,
        timestamp: new Date().toISOString(),
      });
      setErrorMessage('Cannot connect to real-time updates. Please refresh the page.');
      setIsLoading(false);
      return;
    }

    // Track user interaction for audio playback
    const handleInteraction = () => {
      hasInteracted.current = true;
      console.log('User interaction detected, audio playback enabled', { timestamp: new Date().toISOString() });
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    if (isMounted.current) return;
    isMounted.current = true;

    console.log('Joining socket room: guest-', sessionId, 'timestamp:', new Date().toISOString());
    socket.emit('join-session', { sessionId: `guest-${sessionId}` });

    socket.on('connect', () => {
      console.log('Socket connected in OrderWaiting, joining room: guest-', sessionId, 'timestamp:', new Date().toISOString());
      socket.emit('join-session', { sessionId: `guest-${sessionId}` });
      if (!isApproved) fetchOrder();
    });

    socket.on('join-confirmation', (data) => {
      console.log('Received join-confirmation for room: guest-', sessionId, data, 'timestamp:', new Date().toISOString());
    });

    socket.on('orderApproved', onOrderApproved);
    socket.on('orderUpdate', onOrderUpdate);
    socket.on('connect_error', (error) => {
      console.error('Socket connection error in OrderWaiting:', error.message, 'timestamp:', new Date().toISOString());
      toast.warn('Connection to real-time updates lost. Retrying...');
    });

    socket.on('reconnect', (attempt) => {
      console.log('Socket reconnected in OrderWaiting after attempt:', attempt, 'timestamp:', new Date().toISOString());
      socket.emit('join-session', { sessionId: `guest-${sessionId}` });
      if (!isApproved) fetchOrder();
    });

    fetchOrder();

    const pollInterval = setInterval(() => {
      if (!isApproved && !isProcessingApproval) {
        console.log('Polling for order status:', orderId, 'sessionId:', sessionId, 'timestamp:', new Date().toISOString());
        fetchOrder();
      } else {
        console.log('Polling skipped: order is approved or processing approval', {
          orderId,
          isApproved,
          isProcessingApproval,
          timestamp: new Date().toISOString(),
        });
      }
    }, 5000);

    return () => {
      socket.off('connect');
      socket.off('join-confirmation');
      socket.off('orderApproved', onOrderApproved);
      socket.off('orderUpdate', onOrderUpdate);
      socket.off('connect_error');
      socket.off('reconnect');
      clearInterval(pollInterval);
      isMounted.current = false;
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      console.log('OrderWaiting cleanup complete for sessionId:', sessionId, 'timestamp:', new Date().toISOString());
    };
  }, [fetchOrder, sessionId, socket, onOrderApproved, onOrderUpdate, isApproved, orderId, isProcessingApproval]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isApproved) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your order tracking will be interrupted.';
      }
    };

    const handlePopState = () => {
      if (!isApproved) {
        toast.warn('Please wait for your order to be approved before navigating away.');
        navigate(`/order-waiting/${orderId}`, { replace: true, state: { sessionId } });
      } else {
        navigate('/');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isApproved, navigate, orderId, sessionId]);

  const handleReturnHome = () => {
    setIsVisible(false);
    setTimeout(() => navigate('/'), 200);
  };

  const groupedItems = (() => {
    if (!orderDetails) {
      return [];
    }

    const acc = {};

    const itemIds = orderDetails.item_ids?.split(',').filter(id => id.trim()) || [];
    const itemNames = orderDetails.item_names?.split(',') || [];
    const menuQuantities = orderDetails.menu_quantities?.split(',').filter(q => q !== 'NULL') || [];
    const unitPrices = orderDetails.unit_prices?.split(',').map(price => parseFloat(price) || 0) || [];
    const supplementIds = orderDetails.supplement_ids?.split(',') || [];
    const supplementNames = orderDetails.supplement_names?.split(',') || [];
    const supplementPrices = orderDetails.supplement_prices?.split(',').map(price => parseFloat(price) || 0) || [];
    const imageUrls = orderDetails.image_urls?.split(',') || [];

    itemIds.forEach((id, idx) => {
      if (idx >= menuQuantities.length || idx >= itemNames.length) return;
      const supplementId = supplementIds[idx]?.trim() || null;
      const key = `${id.trim()}_${supplementId || 'none'}`;
      const quantity = parseInt(menuQuantities[idx], 10) || 1;

      if (!acc[key]) {
        acc[key] = {
          id: parseInt(id),
          type: 'menu',
          name: itemNames[idx]?.trim() || 'Unknown Item',
          quantity: 0,
          unitPrice: unitPrices[idx],
          supplementName: supplementId ? supplementNames[idx]?.trim() : null,
          supplementPrice: supplementId ? supplementPrices[idx] : 0,
          imageUrl: imageUrls[idx]?.trim() || null,
          options: [],
        };
      }
      acc[key].quantity += quantity;
    });

    const breakfastIds = orderDetails.breakfast_ids?.split(',').filter(id => id.trim()) || [];
    const breakfastNames = orderDetails.breakfast_names?.split(',') || [];
    const breakfastQuantities = orderDetails.breakfast_quantities?.split(',').filter(q => q !== 'NULL') || [];
    const unitPricesBreakfast = orderDetails.unit_prices?.split(',').map(price => parseFloat(price) || 0) || [];
    const breakfastImages = orderDetails.breakfast_images?.split(',') || [];
    const optionIds = orderDetails.breakfast_option_ids?.split(',').filter(id => id.trim()) || [];
    const optionNames = orderDetails.breakfast_option_names?.split(',') || [];
    const optionPrices = orderDetails.breakfast_option_prices?.split(',').map(price => parseFloat(price) || 0) || [];

    breakfastIds.forEach((id, idx) => {
      if (idx >= breakfastQuantities.length || idx >= breakfastNames.length) return;
      const key = id.trim();
      const quantity = parseInt(breakfastQuantities[idx], 10) || 1;

      if (!acc[key]) {
        acc[key] = {
          id: parseInt(id),
          type: 'breakfast',
          name: breakfastNames[idx]?.trim() || 'Unknown Breakfast',
          quantity: 0,
          unitPrice: unitPricesBreakfast[idx],
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
            id: optionIds[i],
            name: optionNames[i] || 'Unknown Option',
            price: optionPrices[i] || 0,
          });
        }
      }
      acc[key].options = Array.from(new Set(acc[key].options.map(opt => JSON.stringify(opt))), JSON.parse);
    });

    return Object.values(acc);
  })();

  if (isLoading) {
    return (
      <div className="order-waiting-container">
        <div className="order-waiting-loader">
          <div className="order-waiting-spinner"></div>
          <h2 className="order-waiting-loader-text">Loading Order</h2>
          <p className="order-waiting-loader-subtext">Please wait...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="order-waiting-container">
        <div className="order-waiting-error-card">
          <div className="order-waiting-error-icon">
            <div className="order-waiting-error-circle">
              <div className="order-waiting-error-dot"></div>
            </div>
          </div>
          <h2 className="order-waiting-error-title">{errorMessage}</h2>
          <button
            onClick={handleReturnHome}
            className="order-waiting-button"
            onMouseDown={(e) => (e.target.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.target.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="order-waiting-container">
        <div className="order-waiting-error-card">
          <div className="order-waiting-error-icon">
            <div className="order-waiting-error-circle">
              <div className="order-waiting-error-dot"></div>
            </div>
          </div>
          <h2 className="order-waiting-error-title">Order details not available</h2>
          <p className="order-waiting-error-subtext">Please try again later or contact support.</p>
          <button
            onClick={handleReturnHome}
            className="order-waiting-button"
            onMouseDown={(e) => (e.target.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.target.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const baseImageUrl = api.defaults.baseURL.replace('/api', '');
  return (
    <div className="order-waiting-container">
      <div className={`order-waiting-header ${isVisible ? 'visible' : ''} ${isApproved ? 'approved' : ''}`}>
        <h1 className="order-waiting-header-title">
          {isApproved ? 'Order Confirmed!' : 'Waiting for Confirmation'}
        </h1>
        <p className="order-waiting-header-subtitle">
          Order #{orderId} • {orderDetails.order_type === 'delivery' ? 'Delivery' : `Table ${orderDetails.table_number || 'N/A'}`}
        </p>
      </div>

      <div className={`order-waiting-card ${isVisible ? 'visible' : ''}`}>
        <div className="order-waiting-status-section">
          <div className={isApproved ? 'order-waiting-status-approved' : 'order-waiting-status-pending'}>
            <span className="order-waiting-status-text">
              {isProcessingApproval
                ? 'Processing Approval...'
                : isApproved
                ? 'Order Approved'
                : 'Pending Approval'}
            </span>
          </div>
          <p className="order-waiting-status-message">
            {isProcessingApproval
              ? 'Your order is being confirmed.'
              : isApproved
              ? 'Your order has been confirmed and is being prepared.'
              : 'Your order is being reviewed by our staff.'}
          </p>
        </div>

        <div className="order-waiting-items-section">
          <h2 className="order-waiting-section-title">Your Order</h2>
          <div className="order-waiting-items">
            {groupedItems.map((item, index) => {
              const totalOptionsPrice = (item.options || []).reduce((sum, opt) => sum + opt.price, 0);
              const itemTotalPrice = (item.unitPrice + (item.supplementPrice || 0) + totalOptionsPrice) * item.quantity;
              return (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  className={`order-waiting-item-row ${itemsVisible ? 'visible' : ''}`}
                  style={{ transitionDelay: `${index * 0.1}s` }}
                >
                  <img
                    src={item.imageUrl ? `${baseImageUrl}${item.imageUrl}` : 'https://via.placeholder.com/40?text=No+Image'}
                    alt={item.name}
                    className="order-waiting-item-image"
                    onError={(e) => (e.target.src = 'https://via.placeholder.com/40?text=No+Image')}
                  />
                  <div className="order-waiting-item-details">
                    <span className="order-waiting-item-name">{item.name}</span>
                    {item.supplementName && (
                      <span className="order-waiting-item-option">
                        + {item.supplementName} {item.supplementPrice > 0 && `(+$${item.supplementPrice.toFixed(2)})`}
                      </span>
                    )}
                    {(item.options || []).map((opt, optIdx) => (
                      <span key={optIdx} className="order-waiting-item-option">
                        + {opt.name} {opt.price > 0 && `(+$${opt.price.toFixed(2)})`}
                      </span>
                    ))}
                    <span className="order-waiting-item-total">
                      Total: ${itemTotalPrice.toFixed(2)}
                    </span>
                  </div>
                  <span className="order-waiting-quantity-badge">{item.quantity}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="order-waiting-total-section">
          <div className="order-waiting-total-row">
            <span className="order-waiting-total-label">Total</span>
            <span className="order-waiting-total-value">${parseFloat(orderDetails.total_price).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleReturnHome}
        className="order-waiting-button order-waiting-home-button"
        onMouseDown={(e) => (e.target.style.transform = 'scale(0.96)')}
        onMouseUp={(e) => (e.target.style.transform = 'scale(1)')}
        onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
      >
        Return to Home
      </button>
    </div>
  );
}

export default OrderWaiting;
