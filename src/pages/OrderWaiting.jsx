import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { LocationOn, Note } from '@mui/icons-material';
import './css/OrderWaiting.css';

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

  // Prioritize session ID from navigation state
  const sessionId = state?.sessionId || localStorage.getItem('sessionId') || propSessionId || `guest-${uuidv4()}`;
  const isMounted = useRef(false);

  // Preload audio and validate
  useEffect(() => {
    const audioPath = '/assets/notification1.mp3';
    audioRef.current = new Audio(audioPath);
    audioRef.current.preload = 'auto';

    fetch(audioPath, { method: 'HEAD' })
      .then((response) => {
        if (!response.ok) {
          console.error(`Fichier audio introuvable à ${audioPath}`, { timestamp: new Date().toISOString() });
          toast.error('Le fichier son de confirmation de commande est manquant.');
        } else {
          console.log(`Fichier audio préchargé avec succès : ${audioPath}`, { timestamp: new Date().toISOString() });
        }
      })
      .catch((err) => {
        console.error('Erreur lors de la vérification du fichier audio :', err, { timestamp: new Date().toISOString() });
        toast.error('Échec du chargement du son de confirmation de commande.');
      });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Debounced order details update
  const debouncedSetOrderDetails = useCallback(
    debounce((newDetails) => {
      setOrderDetails(newDetails);
    }, 100),
    []
  );

  useEffect(() => {
    if (!state?.sessionId && !localStorage.getItem('sessionId')) {
      console.warn('Aucun ID de session trouvé dans l\'état ou localStorage, généré un nouveau :', sessionId, 'timestamp :', new Date().toISOString());
      localStorage.setItem('sessionId', sessionId);
      api.defaults.headers.common['X-Session-Id'] = sessionId;
    }
    console.log('OrderWaiting initialisé avec sessionId :', sessionId, 'orderId :', orderId, 'timestamp :', new Date().toISOString());
  }, [sessionId, orderId]);

  useEffect(() => {
    if (!isLoading && !errorMessage) {
      setTimeout(() => setIsVisible(true), 100);
      setTimeout(() => setItemsVisible(true), 300);
    }
  }, [isLoading, errorMessage]);

  const fetchOrder = useCallback(async () => {
    if (!orderId || isNaN(parseInt(orderId))) {
      setErrorMessage('ID de commande invalide.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.getOrder(orderId, { headers: { 'Cache-Control': 'no-cache' } });
      console.log('Détails de la commande récupérés :', response.data, 'timestamp :', new Date().toISOString());
      debouncedSetOrderDetails(response.data);
      setIsApproved(!!response.data.approved);
      setIsLoading(false);
    } catch (error) {
      console.error('Erreur lors de la récupération de la commande :', {
        status: error.response?.status,
        message: error.response?.data?.error || error.message,
        timestamp: new Date().toISOString(),
      });
      if (error.response?.status === 403) {
        setErrorMessage('Accès refusé : Vous n\'êtes pas autorisé à voir cette commande.');
      } else if (error.response?.status === 404) {
        setErrorMessage('Commande introuvable.');
      } else if (error.response?.status === 500) {
        setErrorMessage('Erreur du serveur. Veuillez réessayer plus tard.');
      } else {
        setErrorMessage('Échec du chargement des détails de la commande. Vérifiez votre connexion.');
      }
      setIsLoading(false);
    }
  }, [orderId, debouncedSetOrderDetails]);

  const playSound = async () => {
    if (!audioRef.current) {
      console.warn('Audio non initialisé', { timestamp: new Date().toISOString() });
      return;
    }
    if (!hasInteracted.current) {
      console.log('En attente d\'une interaction utilisateur pour jouer le son', { timestamp: new Date().toISOString() });
      const retrySound = () => {
        if (hasInteracted.current && !hasPlayedSound.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((err) => {
            console.error('Erreur de lecture audio :', err, { timestamp: new Date().toISOString() });
            toast.warn('Le son de confirmation de commande est bloqué par le navigateur.');
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
      console.log('Son de confirmation de commande joué avec succès', { timestamp: new Date().toISOString() });
      hasPlayedSound.current = true;
    } catch (err) {
      console.error('Échec de la lecture audio :', err, { timestamp: new Date().toISOString() });
      toast.warn('Le son de confirmation de commande est bloqué par le navigateur.');
    }
  };

  const onOrderApproved = useCallback(
    (data) => {
      console.log('OrderWaiting a reçu l\'événement orderApproved :', {
        data,
        expectedOrderId: orderId,
        sessionId,
        timestamp: new Date().toISOString(),
      });
      if (!data.orderId) {
        console.warn('Événement orderApproved invalide : orderId manquant', data, 'timestamp :', new Date().toISOString());
        toast.warn('Données de confirmation de commande invalides reçues');
        return;
      }
      if (parseInt(data.orderId) === parseInt(orderId)) {
        console.log('Traitement de la confirmation de commande pour orderId :', data.orderId, 'timestamp :', new Date().toISOString());
        setIsProcessingApproval(true);
        setIsApproved(true);
        if (!hasPlayedSound.current) {
          playSound();
        }
        if (data.orderDetails && Object.keys(data.orderDetails).length > 0) {
          debouncedSetOrderDetails((prev) => {
            const updatedDetails = {
              ...prev,
              ...data.orderDetails,
              approved: 1,
              status: data.orderDetails?.status || 'en préparation',
            };
            console.log('Détails de la commande mis à jour depuis l\'événement :', updatedDetails, 'timestamp :', new Date().toISOString());
            return updatedDetails;
          });
          setIsLoading(false);
          setIsProcessingApproval(false);
        } else {
          fetchOrder();
          setTimeout(() => setIsProcessingApproval(false), 500);
        }
        toast.success(`Commande #${orderId} a été approuvée !`, { autoClose: 3000 });
      } else {
        console.log('Événement orderApproved ignoré, mismatch orderId :', {
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
      console.log('OrderWaiting a reçu l\'événement orderUpdate :', {
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
            status: data.status || prev?.status || 'reçue',
          };
          console.log('Détails de la commande mis à jour sur orderUpdate :', updatedDetails, 'timestamp :', new Date().toISOString());
          return updatedDetails;
        });
        toast.info(`Commande #${orderId} mise à jour à ${data.status}`, { autoClose: 3000 });
      }
    },
    [orderId, sessionId, debouncedSetOrderDetails]
  );

  useEffect(() => {
    if (!sessionId) {
      console.warn('Aucun ID de session fourni, génération d\'un nouveau', { timestamp: new Date().toISOString() });
      const newSessionId = `guest-${uuidv4()}`;
      setErrorMessage('ID de session manquant. Veuillez réessayer.');
      setIsLoading(false);
      localStorage.setItem('sessionId', newSessionId);
      api.defaults.headers.common['X-Session-Id'] = newSessionId;
      return;
    }

    if (!socket) {
      console.warn('Socket non fourni, en attente d\'initialisation', { sessionId, timestamp: new Date().toISOString() });
      setIsLoading(true);
      return;
    }

    const handleInteraction = () => {
      hasInteracted.current = true;
      console.log('Interaction utilisateur détectée, lecture audio activée', { timestamp: new Date().toISOString() });
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    if (isMounted.current) return;
    isMounted.current = true;

    const waitForSocketConnection = (callback, maxAttempts = 10, interval = 1000) => {
      let attempts = 0;
      const checkConnection = setInterval(() => {
        if (socket.connected) {
          console.log('Socket connecté dans OrderWaiting, rejoindre la salle : guest-', sessionId, { timestamp: new Date().toISOString() });
          clearInterval(checkConnection);
          callback();
        } else if (attempts >= maxAttempts) {
          console.error('Délai de connexion socket dépassé', { sessionId, attempts, timestamp: new Date().toISOString() });
          clearInterval(checkConnection);
          setErrorMessage('Impossible de se connecter aux mises à jour en temps réel. Veuillez actualiser la page.');
          setIsLoading(false);
        }
        attempts++;
      }, interval);
    };

    const initializeSocket = () => {
      console.log('Rejoindre la salle socket : guest-', sessionId, { timestamp: new Date().toISOString() });
      socket.emit('join-session', { sessionId: `guest-${sessionId}` });

      socket.on('connect', () => {
        console.log('Socket connecté dans OrderWaiting, rejoindre la salle : guest-', sessionId, { timestamp: new Date().toISOString() });
        socket.emit('join-session', { sessionId: `guest-${sessionId}` });
        if (!isApproved) fetchOrder();
      });

      socket.on('join-confirmation', (data) => {
        console.log('Confirmation de rejoindre reçue pour la salle : guest-', sessionId, data, { timestamp: new Date().toISOString() });
      });

      socket.on('orderApproved', onOrderApproved);
      socket.on('orderUpdate', onOrderUpdate);
      socket.on('connect_error', (error) => {
        console.error('Erreur de connexion socket dans OrderWaiting :', error.message, { timestamp: new Date().toISOString() });
        toast.warn('Connexion aux mises à jour en temps réel perdue. Nouvelle tentative...');
      });

      socket.on('reconnect', (attempt) => {
        console.log('Socket reconnecté dans OrderWaiting après tentative :', attempt, { timestamp: new Date().toISOString() });
        socket.emit('join-session', { sessionId: `guest-${sessionId}` });
        if (!isApproved) fetchOrder();
      });

      if (!isApproved) fetchOrder();
    };

    if (socket.connected) {
      initializeSocket();
    } else {
      waitForSocketConnection(initializeSocket);
    }

    const pollInterval = setInterval(() => {
      if (!isApproved && !isProcessingApproval) {
        console.log('Sondage pour l\'état de la commande :', orderId, 'sessionId :', sessionId, { timestamp: new Date().toISOString() });
        fetchOrder();
      } else {
        console.log('Sondage ignoré : la commande est approuvée ou en cours d\'approbation', {
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
      console.log('Nettoyage OrderWaiting terminé pour sessionId :', sessionId, { timestamp: new Date().toISOString() });
    };
  }, [fetchOrder, sessionId, socket, onOrderApproved, onOrderUpdate, isApproved, orderId, isProcessingApproval]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isApproved) {
        e.preventDefault();
        e.returnValue = 'Êtes-vous sûr de vouloir quitter ? Le suivi de votre commande sera interrompu.';
      }
    };

    const handlePopState = () => {
      if (!isApproved) {
        toast.warn('Veuillez attendre l\'approbation de votre commande avant de naviguer ailleurs.');
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

  const handleCopyUrl = () => {
    const currentUrl = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(currentUrl)
        .then(() => {
          console.log('URL copiée dans le presse-papiers :', currentUrl, { timestamp: new Date().toISOString() });
          toast.success('URL de la commande copiée dans le presse-papiers !', { autoClose: 3000 });
        })
        .catch((err) => {
          console.error('Échec de la copie de l\'URL avec l\'API clipboard :', err, { timestamp: new Date().toISOString() });
          fallbackCopy(currentUrl);
        });
    } else {
      console.warn('API Clipboard indisponible, utilisation de la méthode de secours', { timestamp: new Date().toISOString() });
      fallbackCopy(currentUrl);
    }
  };

  const fallbackCopy = (text) => {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('URL copiée dans le presse-papiers avec la méthode de secours :', text, { timestamp: new Date().toISOString() });
        toast.success('URL de la commande copiée dans le presse-papiers !', { autoClose: 3000 });
      } else {
        console.error('Échec de la copie de secours', { timestamp: new Date().toISOString() });
        toast.error('Échec de la copie de l\'URL. Veuillez essayer manuellement.');
      }
    } catch (err) {
      console.error('Erreur de copie de secours :', err, { timestamp: new Date().toISOString() });
      toast.error('Échec de la copie de l\'URL. Veuillez essayer manuellement.');
    }
    document.body.removeChild(tempInput);
  };

  const groupedItems = (() => {
    if (!orderDetails) {
      return [];
    }

    const acc = {};

    // Process menu items
    const itemIds = orderDetails.item_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const itemNames = orderDetails.item_names?.split(',') || [];
    const unitPrices = orderDetails.unit_prices?.split(',').map(price => safeParseFloat(price)) || [];
    const menuQuantities = orderDetails.menu_quantities?.split(',').filter(q => q !== 'NULL' && q?.trim()).map(q => safeParseInt(q, 1)) || [];
    const supplementIds = orderDetails.supplement_ids?.split(',') || [];
    const supplementNames = orderDetails.supplement_names?.split(',') || [];
    const supplementPrices = orderDetails.supplement_prices?.split(',').map(price => safeParseFloat(price)) || [];
    const imageUrls = orderDetails.image_urls?.split(',') || [];

    itemIds.forEach((id, idx) => {
      if (idx >= menuQuantities.length || idx >= itemNames.length || idx >= unitPrices.length) return;
      
      const supplementId = supplementIds[idx]?.trim() || null;
      const key = `${id.trim()}_${supplementId || 'none'}`;
      const quantity = menuQuantities[idx]; // Use the exact quantity from the order
      const unitPrice = safeParseFloat(unitPrices[idx], 0);

      if (!acc[key]) {
        acc[key] = {
          id: safeParseInt(id, 0),
          type: 'menu',
          name: itemNames[idx]?.trim() || 'Article inconnu',
          quantity: 0,
          unitPrice: unitPrice,
          baseUnitPrice: unitPrice,
          supplementName: supplementId ? supplementNames[idx]?.trim() || 'Supplément inconnu' : null,
          supplementPrice: supplementId ? safeParseFloat(supplementPrices[idx], 0) : 0,
          imageUrl: imageUrls[idx]?.trim() || null,
          options: [],
        };
      }
      // Only add quantity if this is the first occurrence of the key with this quantity
      if (acc[key].quantity === 0) {
        acc[key].quantity = quantity;
      }
      console.log(`Traitement de l'article de menu : id=${id}, supplementId=${supplementId}, quantity=${quantity}, key=${key}`, { timestamp: new Date().toISOString() });
    });

    // Process breakfast items
    const breakfastIds = orderDetails.breakfast_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const breakfastNames = orderDetails.breakfast_names?.split(',') || [];
    const breakfastQuantities = orderDetails.breakfast_quantities?.split(',').filter(q => q !== 'NULL' && q?.trim()) || [];
    const unitPricesBreakfast = orderDetails.unit_prices?.split(',').map(price => safeParseFloat(price)) || [];
    const breakfastImages = orderDetails.breakfast_images?.split(',') || [];
    const optionIds = orderDetails.breakfast_option_ids?.split(',').filter(id => id?.trim() && !isNaN(parseInt(id))) || [];
    const optionNames = orderDetails.breakfast_option_names?.split(',') || [];
    const optionPrices = orderDetails.breakfast_option_prices?.split(',').map(price => safeParseFloat(price)) || [];

    breakfastIds.forEach((id, idx) => {
      if (idx >= breakfastQuantities.length || idx >= breakfastNames.length || idx >= unitPricesBreakfast.length) return;
      
      const key = id.trim();
      const quantity = safeParseInt(breakfastQuantities[idx], 1);
      const unitPrice = safeParseFloat(unitPricesBreakfast[idx], 0);

      if (!acc[key]) {
        acc[key] = {
          id: safeParseInt(id, 0),
          type: 'breakfast',
          name: breakfastNames[idx]?.trim() || 'Petit-déjeuner inconnu',
          quantity: 0,
          unitPrice: unitPrice,
          baseUnitPrice: unitPrice,
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
            name: optionNames[i]?.trim() || 'Option inconnue',
            price: safeParseFloat(optionPrices[i], 0),
          });
        }
      }
      // Remove duplicates
      acc[key].options = Array.from(new Set(acc[key].options.map(opt => JSON.stringify(opt))), JSON.parse);
    });

    return Object.values(acc).filter(item => item.quantity > 0);
  })();

  const deliveryAlertStyle = orderDetails?.delivery_address ? {
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  } : { display: 'none' };

  const notesAlertStyle = orderDetails?.notes ? {
    backgroundColor: '#e6f3ff',
    border: '1px solid #3b82f6',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  } : { display: 'none' };

  if (isLoading) {
    return (
      <div className="order-waiting-container">
        <div className="order-waiting-loader">
          <div className="order-waiting-spinner"></div>
          <h2 className="order-waiting-loader-text">Chargement de la commande</h2>
          <p className="order-waiting-loader-subtext">Veuillez patienter...</p>
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
            Retour à l'accueil
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
          <h2 className="order-waiting-error-title">Détails de la commande indisponibles</h2>
          <p className="order-waiting-error-subtext">Veuillez réessayer plus tard ou contacter le support.</p>
          <button
            onClick={handleReturnHome}
            className="order-waiting-button"
            onMouseDown={(e) => (e.target.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.target.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const baseImageUrl = api.defaults.baseURL.replace('/api', '');

  const getOrderTypeDisplay = (orderType) => {
    switch (orderType) {
      case 'local':
        return `Tableau ${orderDetails.table_number || 'N/A'}`;
      case 'delivery':
        return 'Livraison';
      case 'imported':
        return 'À emporter';
      default:
        return 'Inconnu';
    }
  };

  const currentUrl = window.location.href;

  return (
    <div className="order-waiting-container">
      <div className={`order-waiting-header ${isVisible ? 'visible' : ''} ${isApproved ? 'approved' : ''}`}>
        <h1 className="order-waiting-header-title">
          {isApproved ? 'Commande confirmée !' : 'En attente de confirmation'}
        </h1>
        <p className="order-waiting-header-subtitle">
          Commande #{orderId} • {getOrderTypeDisplay(orderDetails.order_type)} • Statut : {orderDetails.status || 'reçue'}
        </p>
      </div>

      <div className={`order-waiting-card ${isVisible ? 'visible' : ''}`}>
        <div className="order-waiting-status-section">
          <div className={isApproved ? 'order-waiting-status-approved' : 'order-waiting-status-pending'}>
            <span className="order-waiting-status-text">
              {isProcessingApproval
                ? 'Traitement de l\'approbation...'
                : isApproved
                ? 'Commande approuvée'
                : 'En attente d\'approbation'}
            </span>
          </div>
          <p className="order-waiting-status-message">
            {isProcessingApproval
              ? 'Votre commande est en cours de confirmation.'
              : isApproved
              ? 'Votre commande a été confirmée et est en préparation.'
              : 'Votre commande est en cours d\'examen par notre personnel.'}
          </p>
        </div>

        {orderDetails.delivery_address && (
          <div style={deliveryAlertStyle}>
            <LocationOn sx={{ fontSize: 18, color: '#f59e0b' }} />
            <div>
              <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '2px' }}>
                Commande de livraison
              </div>
              <div style={{ fontSize: '13px', color: '#92400e' }}>
                {orderDetails.delivery_address}
              </div>
            </div>
          </div>
        )}

        {orderDetails.notes && (
          <div style={notesAlertStyle}>
            <Note sx={{ fontSize: 18, color: '#3b82f6' }} />
            <div>
              <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '2px' }}>
                Instructions spéciales
              </div>
              <div style={{ fontSize: '13px', color: '#1e40af' }}>
                {orderDetails.notes}
              </div>
            </div>
          </div>
        )}

        <div className="order-waiting-items-section">
          <h2 className="order-waiting-section-title">Votre commande</h2>
          <div className="order-waiting-items">
            {groupedItems.map((item, index) => {
              const imageUrl = item.imageUrl
                ? `${baseImageUrl}${item.imageUrl.startsWith('/') ? '' : '/'}${item.imageUrl}`
                : 'https://via.placeholder.com/40?text=Aucune+Image';
              const itemTotalPrice = safeParseFloat(item.baseUnitPrice, 0) * safeParseInt(item.quantity, 1);

              return (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  className={`order-waiting-item-row ${itemsVisible ? 'visible' : ''}`}
                  style={{ transitionDelay: `${index * 0.1}s` }}
                >
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="order-waiting-item-image"
                    onError={(e) => (e.target.src = 'https://via.placeholder.com/40?text=Aucune+Image')}
                  />
                  <div className="order-waiting-item-details">
                    <span className="order-waiting-item-name">{item.name}</span>
                    {item.supplementName && (
                      <span className="order-waiting-item-option">
                        + {item.supplementName} {safeParseFloat(item.supplementPrice, 0) > 0 && `(+${safeParseFloat(item.supplementPrice, 0).toFixed(2)} DT)`}
                      </span>
                    )}
                    {(item.options || []).map((opt, optIdx) => (
                      <span key={optIdx} className="order-waiting-item-option">
                        + {opt.name} (+${safeParseFloat(opt.price, 0).toFixed(2)} DT)
                      </span>
                    ))}
                    <span className="order-waiting-item-total">{itemTotalPrice.toFixed(2)} DT</span>
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
            <span className="order-waiting-total-value">{safeParseFloat(orderDetails.total_price).toFixed(2)} DT</span>
          </div>
        </div>
      </div>

      <div className="order-waiting-url-section">
        <p className="order-waiting-url-text">URL de la commande actuelle :</p>
        <p className="order-waiting-url-value" title={currentUrl}>{currentUrl}</p>
        <p className="order-waiting-instruction">
          Veuillez sauvegarder cette URL pour suivre l'état de votre commande ultérieurement, par exemple, lors du paiement ou pour vérifier les mises à jour. Nous vous recommandons de la copier dans un endroit sécurisé pour votre commodité.
        </p>
        <center>
          <button
            onClick={handleCopyUrl}
            className="order-waiting-button"
            onMouseDown={(e) => (e.target.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.target.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
          >
            Copier l'URL de la commande
          </button>
        </center>
      </div>

      <button
        onClick={handleReturnHome}
        className="order-waiting-button order-waiting-home-button"
        onMouseDown={(e) => (e.target.style.transform = 'scale(0.96)')}
        onMouseUp={(e) => (e.target.style.transform = 'scale(1)')}
        onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
      >
        Retour à l'accueil
      </button>
    </div>
  );
}

export default OrderWaiting;
