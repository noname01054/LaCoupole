import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CoffeeIcon from '@mui/icons-material/Coffee';
import SearchIcon from '@mui/icons-material/Search';
import { v4 as uuidv4 } from 'uuid';
import React from 'react';
import './css/CartModal.css';

const CartItem = React.memo(({ item, itemSupplements, breakfastOptions, supplementSelections, handleQuantityChange, handleSupplementChange, api }) => {
  const imageSrc = useMemo(() => {
    let src = '/placeholder.jpg';
    if (item.image_url && item.image_url !== '/Uploads/undefined' && item.image_url !== 'null') {
      src = item.image_url;
    }
    return src;
  }, [item.image_url]);

  const displayPrice = parseFloat(item.sale_price || item.unit_price || item.regular_price) || 0;
  const supplementPrice = parseFloat(supplementSelections[item.cartItemId]?.additional_price || item.supplement_price || 0) || 0;
  const breakfastOptionPrices = item.option_ids?.reduce((sum, optionId) => {
    const option = breakfastOptions.find(o => o.id === optionId);
    return sum + (parseFloat(option?.additional_price) || 0);
  }, 0) || 0;

  return (
    <li className="cart-modal-item">
      <div className="cart-modal-item-header">
        <div className="cart-modal-item-image">
          <img
            src={imageSrc}
            srcSet={`
              ${imageSrc}?w=48 1x,
              ${imageSrc}?w=96 2x
            `}
            alt={item.name || 'Item'}
            className="cart-modal-item-img"
            loading="lazy"
            decoding="async"
            onError={(e) => { e.target.src = '/placeholder.jpg'; }}
          />
        </div>
        <div className="cart-modal-item-details">
          <h4 className="cart-modal-item-name">{item.name || 'Unnamed Item'}</h4>
          <div className="cart-modal-item-price">
            {(displayPrice + breakfastOptionPrices + supplementPrice).toFixed(2)} DT
            {supplementPrice > 0 && (
              <span className="cart-modal-supplement-price">+${supplementPrice.toFixed(2)} (Supplement)</span>
            )}
            {breakfastOptionPrices > 0 && (
              <span className="cart-modal-supplement-price">+${breakfastOptionPrices.toFixed(2)} (Options)</span>
            )}
          </div>
          {item.breakfast_id && item.option_ids && (
            <div className="cart-modal-breakfast-options">
              {breakfastOptions
                .filter(option => item.option_ids.includes(option.id))
                .map(option => (
                  <span key={option.id} className="cart-modal-option-detail">
                    {option.option_name} ({parseFloat(option.additional_price || 0).toFixed(2)}+DT)
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {!item.breakfast_id && upplements?.length > 0 && (
        <select
          onChange={(e) => handleSupplementChange(item.cartItemId, e.target.value)}
          value={supplementSelections[item.cartItemId]?.supplement_id || item.supplement_id || '0'}
          className="cart-modal-supplement-select"
        >
          <option value="0">Aucun supplément</option>
          {upplements.map((s) => (
            <option key={s.supplement_id} value={s.supplement_id}>
              {s.name} (+${parseFloat(s.additional_price || 0).toFixed(2)})
            </option>
          ))}
        </select>
      )}

      <div className="cart-modal-quantity-controls">
        <div className="cart-modal-quantity-buttons">
          <button
            onClick={() => handleQuantityChange(item.cartItemId, item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="cart-modal-quantity-button"
          >
            <RemoveIcon fontSize="small" />
          </button>
          <span className="cart-modal-quantity-number">{item.quantity || 1}</span>
          <button
            onClick={() => handleQuantityChange(item.cartItemId, item.quantity + 1)}
            className="cart-modal-quantity-button"
          >
            <AddIcon fontSize="small" />
          </button>
        </div>
        <button
          onClick={() => handleQuantityChange(item.cartItemId, 0)}
          className="cart-modal-delete-button"
        >
          <DeleteIcon fontSize="small" />
        </button>
      </div>
    </li>
  );
});

function CartModal({
  isOpen,
  onClose,
  cart = [],
  updateQuantity,
  orderType,
  setOrderType,
  deliveryAddress,
  setDeliveryAddress,
  clearCart,
  sessionId,
  socket
}) {
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [supplementSelections, setSupplementSelections] = useState({});
  const [upplements, setupplements] = useState({});
  const [breakfastOptions, setBreakfastOptions] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const touchStartY = useRef(null);
  const submissionLockRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen || orderType !== 'local') {
      setTableId('');
      setTableSearch('');
      return;
    }

    api.getTables()
      .then((res) => setTables(res.data?.filter(table => table.id && table.table_number) || []))
      .catch((error) => {
        console.error('Failed to load tables:', error);
        toast.error('Failed to load tables');
        setTables([]);
      });
  }, [isOpen, orderType]);

  useEffect(() => {
    if (!isOpen || !cart.length) {
      setItemSupplements({});
      setSupplementSelections({});
      setBreakfastOptions({});
      return;
    }

    const fetchSupplementsAndOptions = async () => {
      const supplementsData = {};
      const optionsData = {};
      const uniqueItemIds = [...new Set(cart.map((item) => item.item_id || item.breakfast_id))].slice(0, 5);
      for (const itemId of uniqueItemIds) {
        if (!itemId || isNaN(itemId)) continue;
        try {
          const itemType = cart.find(i => i.item_id === itemId || i.breakfast_id === itemId)?.breakfast_id ? 'breakfast' : 'menu';
          if (itemType === 'menu') {
            const res = await api.getSupplementsByMenuItem(itemId);
            supplementsData[itemId] = res.data?.filter(s => s.supplement_id && s.name) || [];
          } else if (itemType === 'breakfast') {
            const res = await api.getBreakfastOptions(itemId);
            optionsData[itemId] = res.data?.filter(o => o.id && o.option_name) || [];
          }
        } catch (error) {
          console.error(`Failed to fetch data for item ${itemId}:`, error);
          supplementsData[itemId] = [];
          optionsData[itemId] = [];
        }
      }
      setItemSupplements(supplementsData);
      setBreakfastOptions(optionsData);
    };

    fetchSupplementsAndOptions();
  }, [cart, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let localSessionId = localStorage.getItem('sessionId');
    if (!localSessionId) {
      localSessionId = uuidv4();
      localStorage.setItem('sessionId', localSessionId);
    }
  }, [isOpen]);

  const aggregatedCart = useMemo(() => {
    const acc = {};
    cart.forEach((item) => {
      if (!item.cartItemId || (!item.item_id && !item.breakfast_id)) return;
      const key = item.breakfast_id
        ? `${item.breakfast_id}_${item.option_ids?.sort().join('-') || 'no-options'}`
        : `${item.item_id}_${item.supplement_id || 'no-supplement'}_${item.cartItemId}`;
      if (!acc[key]) {
        acc[key] = { ...item, quantity: 0 };
      }
      acc[key].quantity += item.quantity || 1;
    });
    return Object.values(acc).filter(item => item.quantity > 0);
  }, [cart]);

  const calculateTotal = useMemo(() => {
    return (aggregatedCart || [])
      .reduce((sum, item) => {
        const basePrice = parseFloat(item.sale_price || item.unit_price || item.regular_price) || 0;
        if (basePrice < 0) return sum;
        const supplementPrice = parseFloat(supplementSelections[item.cartItemId]?.additional_price || item.supplement_price || 0) || 0;
        const breakfastOptionPrices = item.option_ids?.reduce((sum, optionId) => {
          const option = (breakfastOptions[item.breakfast_id] || []).find(o => o.id === optionId);
          return sum + (parseFloat(option?.additional_price) || 0);
        }, 0) || 0;
        return sum + item.quantity * (basePrice + supplementPrice + breakfastOptionPrices);
      }, 0)
      .toFixed(2);
  }, [aggregatedCart, supplementSelections, breakfastOptions]);

  const total = calculateTotal;
  const itemCount = useMemo(() => (cart || []).reduce((sum, item) => sum + (item.quantity || 0), 0), [cart]);

  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return tables;
    return tables.filter((table) =>
      table.table_number.toString().toLowerCase().includes(tableSearch.toLowerCase())
    );
  }, [tables, tableSearch]);

  const handleQuantityChange = useCallback((cartItemId, newQuantity) => {
    const item = cart.find((i) => i.cartItemId === cartItemId);
    if (!item) return;

    if (newQuantity === 0) {
      updateQuantity(cartItemId, 0);
      setSupplementSelections((prev) => {
        const newSelections = { ...prev };
        delete newSelections[cartItemId];
        return newSelections;
      });
    } else if (newQuantity > 0) {
      updateQuantity(cartItemId, newQuantity);
    }
  }, [cart, updateQuantity]);

  const handleSupplementChange = useCallback((cartItemId, supplementId) => {
    const parsedSupplementId = supplementId === '0' ? null : parseInt(supplementId);
    const item = cart.find((i) => i.cartItemId === cartItemId);
    if (!item || item.breakfast_id) return;

    const supplement = parsedSupplementId
      ? (itemSupplements[item.item_id] || []).find((s) => s.supplement_id === parsedSupplementId)
      : null;

    setSupplementSelections((prev) => ({
      ...prev,
      [cartItemId]: supplement,
    }));

    updateQuantity(cartItemId, item.quantity, {
      supplement_id: parsedSupplementId,
      supplement_name: supplement?.name || null,
      supplement_price: parseFloat(supplement?.additional_price || 0),
    });
  }, [cart, itemSupplements, updateQuantity]);

  const validateOrder = useCallback(() => {
    if (!cart?.length) return 'Cart is empty';
    if (orderType === 'local' && !tableId) return 'Please select a table';
    if (orderType === 'delivery' && !deliveryAddress?.trim()) return 'Please enter a delivery address';
    // No tableId or deliveryAddress required for 'imported' orders

    for (const item of cart) {
      const id = item.item_id || item.breakfast_id;
      if (!id || isNaN(id) || id <= 0) return `Invalid item ID: ${id}`;
      if (!item.quantity || item.quantity <= 0) return `Invalid quantity for ${item.name || 'item'}`;
      const basePrice = parseFloat(item.sale_price || item.unit_price || item.regular_price) || 0;
      if (basePrice <= 0) return `Invalid price for ${item.name || 'item'}`;
      if (item.supplement_id && !item.supplement_name) return `Invalid supplement for ${item.name || 'item'}`;
      if (item.breakfast_id && item.option_ids?.length) {
        const options = breakfastOptions[item.breakfast_id] || [];
        const groups = [...new Set(options.map(o => o.group_id).filter(id => id))];
        const selectedGroups = [...new Set(options.filter(o => item.option_ids.includes(o.id)).map(o => o.group_id))];
        if (groups.length && selectedGroups.length !== groups.length) {
          return `Select one option from each of the ${groups.length} groups for ${item.name || 'item'}`;
        }
      }
    }
    return null;
  }, [cart, orderType, tableId, deliveryAddress, breakfastOptions]);

  const handlePlaceOrder = useCallback(async () => {
    if (submissionLockRef.current || isSubmitting) return;

    const lockId = uuidv4();
    submissionLockRef.current = lockId;
    setIsSubmitting(true);

    try {
      const validationError = validateOrder();
      if (validationError) throw new Error(validationError);

      let localSessionId = localStorage.getItem('sessionId');
      if (!localSessionId) {
        localSessionId = uuidv4();
        localStorage.setItem('sessionId', localSessionId);
      }

      const orderItems = aggregatedCart.map((item) => {
        let unitPrice = parseFloat(item.sale_price || item.unit_price || item.regular_price) || 0;
        if (unitPrice <= 0) throw new Error(`Invalid price for ${item.name || 'item'}`);

        if (item.breakfast_id && item.option_ids) {
          const options = breakfastOptions[item.breakfast_id] || [];
          const optionPrices = item.option_ids.reduce((sum, optionId) => {
            const option = options.find(o => o.id === optionId);
            return sum + (parseFloat(option?.additional_price) || 0);
          }, 0);
          unitPrice += optionPrices;
        }

        const supplement = item.breakfast_id ? null : (supplementSelections[item.cartItemId] || {
          supplement_id: item.supplement_id || null,
          name: item.supplement_name || null,
          additional_price: parseFloat(item.supplement_price || 0),
        });

        if (supplement && !item.breakfast_id) {
          unitPrice += parseFloat(supplement.additional_price || 0);
        }

        return {
          ...(item.breakfast_id ? { breakfast_id: parseInt(item.breakfast_id) } : { item_id: parseInt(item.item_id) }),
          quantity: parseInt(item.quantity || 1),
          unit_price: parseFloat(unitPrice.toFixed(2)),
          ...(supplement && !item.breakfast_id ? { supplement_id: parseInt(supplement.supplement_id) } : {}),
          ...(supplement && !item.breakfast_id ? { supplement_name: supplement.name } : {}),
          ...(supplement && !item.breakfast_id ? { supplement_price: parseFloat(supplement.additional_price) } : {}),
          ...(item.breakfast_id && item.option_ids ? { option_ids: item.option_ids } : {}),
        };
      });

      const orderData = {
        breakfastItems: orderItems.filter(item => item.breakfast_id),
        items: orderItems.filter(item => item.item_id),
        total_price: parseFloat(total),
        order_type: orderType,
        table_id: orderType === 'local' ? parseInt(tableId) : null,
        delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : null,
        session_id: sessionId,
      };

      const response = await api.submitOrder(orderData, {
        headers: { 'X-Session-Id': sessionId },
      });
      if (!response.data?.orderId) throw new Error('Order creation failed: No orderId returned');

      socket.emit('newOrder', {
        id: response.data.orderId,
        ...orderData,
        created_at: new Date().toISOString(),
        approved: 0,
        status: 'received',
      });

      clearCart();
      setSupplementSelections({});
      setTableId('');
      setTableSearch('');
      setDeliveryAddress('');
      toast.success(`Order placed successfully! ${orderType === 'imported' ? 'Please proceed to pickup.' : ''}`);

      navigate(`/order-waiting/${response.data.orderId}`, { state: { sessionId } });
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to place order';
      if (error.response?.status === 429) {
        toast.error('Please wait before placing another order.');
      } else if (message.includes('Price mismatch')) {
        toast.error('Price mismatch detected. Please refresh and try again.');
      } else {
        toast.error(message);
      }
    } finally {
      submissionLockRef.current = null;
      setIsSubmitting(false);
    }
  }, [orderType, tableId, deliveryAddress, aggregatedCart, supplementSelections, total, clearCart, navigate, validateOrder, breakfastOptions, sessionId, socket]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setSupplementSelections({});
      setTableId('');
      setTableSearch('');
      setDragOffset(0);
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const touchY = e.touches[0].clientY - rect.top;
      if (touchY > 50) {
        touchStartY.current = null;
      }
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartY.current) return;

    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    const content = contentRef.current;

    if (content && deltaY < 0 && content.scrollTop > 0) {
      return;
    } else if (content && deltaY > 0 && content.scrollTop === 0) {
      setDragOffset(Math.min(deltaY, 300));
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragOffset > 150) {
      handleClose();
    } else {
      setDragOffset(0);
    }
    touchStartY.current = null;
  }, [dragOffset, handleClose]);

  useEffect(() => {
    const modal = modalRef.current;
    if (modal && isOpen) {
      modal.addEventListener('touchstart', handleTouchStart, { passive: true });
      modal.addEventListener('touchmove', handleTouchMove, { passive: false });
      modal.addEventListener('touchend', handleTouchEnd, { passive: true });
      return () => {
        modal.removeEventListener('touchstart', handleTouchStart);
        modal.removeEventListener('touchmove', handleTouchMove);
        modal.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isOpen, handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (!isOpen && !isClosing) return null;

  return (
    <div className="cart-modal-overlay" style={{ '--animation': isClosing ? 'cart-modal-fadeOut 0.2s ease-out forwards' : 'cart-modal-fadeIn 0.2s ease-out' }}>
      <div
        ref={modalRef}
        className="cart-modal"
        style={{ transform: `translateY(${dragOffset}px)` }}
      >
        <div className="cart-modal-handle" />
        <div className="cart-modal-header">
          <button
            onClick={handleClose}
            className="cart-modal-close-button"
          >
            <CloseIcon fontSize="small" />
          </button>
          <h3 className="cart-modal-title">Votre panier</h3>
          <div className="cart-modal-badge">{itemCount} Articles</div>
        </div>

        <div ref={contentRef} className="cart-modal-content">
          {cart.length === 0 ? (
            <div className="cart-modal-empty-cart">
              <CoffeeIcon className="cart-modal-empty-cart-icon" />
              <p className="cart-modal-empty-cart-text">Your cart is empty</p>
              <p className="cart-modal-empty-cart-subtext">Add some delicious items to get started!</p>
            </div>
          ) : (
            <>
              <ul className="cart-modal-cart-list">
                {aggregatedCart.map((item) => (
                  <CartItem
                    key={item.cartItemId}
                    item={item}
                    itemSupplements={item.breakfast_id ? [] : (itemSupplements[item.item_id] || [])}
                    breakfastOptions={item.breakfast_id ? (breakfastOptions[item.breakfast_id] || []) : []}
                    supplementSelections={supplementSelections}
                    handleQuantityChange={handleQuantityChange}
                    handleSupplementChange={handleSupplementChange}
                    api={api}
                  />
                ))}
              </ul>

              <div className="cart-modal-summary">
                <div className="cart-modal-total-price">Total: {total}DT</div>

                <div className="cart-modal-form-group">
                  <label className="cart-modal-label">
                    <RestaurantIcon style={{ fontSize: '14px', color: 'var(--background-color) === "#ffffff" ? "#333" : var(--text-color)' }} />
                    Type de commande
                  </label>
                  <select
                    onChange={(e) => setOrderType(e.target.value)}
                    value={orderType}
                    className="cart-modal-select"
                  >
                    <option value="local">Local (sur place)</option>
                    <option value="delivery">Livraison (chez toi)</option>
                    <option value="imported">Importé (prendre à emporter)</option>
                  </select>
                </div>

                {orderType === 'local' && (
                  <>
                    <div className="cart-modal-form-group">
                      <label className="cart-modal-label">
                        <RestaurantIcon style={{ fontSize: '14px', color: 'var(--background-color) === "#ffffff" ? "#333" : var(--text-color)' }} />
                        Recherche Des Tbales
                      </label>
                      <div className="cart-modal-table-search-container">
                        <SearchIcon className="cart-modal-table-search-icon" />
                        <input
                          type="text"
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                          placeholder="Entrez le numéro de votre table"
                          className="cart-modal-table-search-input"
                        />
                      </div>
                    </div>
                    <div className="cart-modal-form-group">
                      <label className="cart-modal-label">
                        <RestaurantIcon style={{ fontSize: '14px', color: 'var(--background-color) === "#ffffff" ? "#333" : var(--text-color)' }} />
                        Choisir la table
                      </label>
                      <div className="cart-modal-table-list-container">
                        {filteredTables.length > 0 ? (
                          <ul className="cart-modal-table-list">
                            {filteredTables.map((t) => (
                              <li
                                key={t.id}
                                className={`cart-modal-table-item ${tableId === t.id ? 'cart-modal-table-item-selected' : ''}`}
                                onClick={() => setTableId(t.id)}
                              >
                                Table {t.table_number}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="cart-modal-table-list-empty">No tables found</div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {orderType === 'delivery' && (
                  <div className="cart-modal-form-group">
                    <label className="cart-modal-label">
                      <LocalShippingIcon style={{ fontSize: '14px', color: 'var(--background-color) === "#ffffff" ? "#333" : var(--text-color)' }} />
                      Delivery Address
                    </label>
                    <input
                      value={deliveryAddress || ''}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter your delivery address"
                      className="cart-modal-input"
                    />
                  </div>
                )}

                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting}
                  className="cart-modal-place-order-button"
                  style={{
                    background: isSubmitting
                      ? 'rgba(0, 0, 0, 0.3)'
                      : 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                    opacity: isSubmitting ? 0.7 : 1,
                    pointerEvents: isSubmitting ? 'none' : 'auto',
                    color: 'var(--background-color) === "#ffffff" ? "#333" : var(--text-color)'
                  }}
                >
                  {isSubmitting ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--background-color) === "#ffffff" ? "#333" : var(--text-color)' }}>
                      <div className="cart-modal-spinner"></div>
                      Placing Order...
                    </div>
                  ) : (
                    `Place Order -${total} DT`
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CartModal;
