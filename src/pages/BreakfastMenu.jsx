import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import {
  ShoppingCartOutlined,
  ArrowBackIosOutlined,
  CheckCircleOutlined,
  CategoryOutlined,
  RemoveOutlined,
  AddOutlined,
  ExpandMoreOutlined,
  ExpandLessOutlined,
} from '@mui/icons-material';
import './css/BreakfastMenu.css';

function BreakfastMenu({ addToCart }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [breakfasts, setBreakfasts] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [selectedOptions, setSelectedOptions] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [expandedOptions, setExpandedOptions] = useState({});
  const [addingToCart, setAddingToCart] = useState({});

  const getImageUrl = (imageUrl) => {
    if (!imageUrl || imageUrl === '/Uploads/undefined' || imageUrl === 'null') {
      return '/placeholder.jpg';
    }
    return `${api.defaults.baseURL.replace('/api', '')}${imageUrl}`;
  };

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchData = async () => {
      try {
        setLoading(true);
        let breakfastsData = [];

        if (id) {
          const [breakfastResponse, optionsResponse, groupsResponse] = await Promise.all([
            api.getBreakfast(id),
            api.getBreakfastOptions(id),
            api.getBreakfastOptionGroups(id),
          ]);
          if (!breakfastResponse.data.availability) {
            throw new Error('Breakfast is not available');
          }
          breakfastsData = [{
            ...breakfastResponse.data,
            options: optionsResponse.data || [],
            optionGroups: groupsResponse.data || [],
          }];
        } else {
          const breakfastResponse = await api.getBreakfasts();
          breakfastsData = await Promise.all(
            breakfastResponse.data
              .filter((b) => b.availability)
              .map(async (breakfast) => {
                const [optionsResponse, groupsResponse] = await Promise.all([
                  api.getBreakfastOptions(breakfast.id),
                  api.getBreakfastOptionGroups(breakfast.id),
                ]);
                return {
                  ...breakfast,
                  options: optionsResponse.data || [],
                  optionGroups: groupsResponse.data || [],
                };
              })
          );
        }

        setBreakfasts(breakfastsData);
        const initialQuantities = {};
        const initialOptions = {};
        const initialExpanded = {};
        breakfastsData.forEach((b) => {
          initialQuantities[b.id] = 1;
          initialOptions[b.id] = {};
          initialExpanded[b.id] = false;
        });
        setQuantities(initialQuantities);
        setSelectedOptions(initialOptions);
        setExpandedOptions(initialExpanded);
      } catch (error) {
        console.error('Error fetching breakfasts:', error);
        toast.error(error.response?.data?.error || 'Failed to load breakfasts');
        setError('Failed to load breakfasts');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleOptionChange = useCallback((breakfastId, groupId, optionId) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [breakfastId]: {
        ...prev[breakfastId],
        [groupId]: optionId,
      },
    }));
    setValidationErrors((prev) => ({
      ...prev,
      [breakfastId]: {
        ...prev[breakfastId],
        [groupId]: false,
      },
    }));
  }, []);

  const toggleOptionsExpanded = useCallback((breakfastId) => {
    setExpandedOptions((prev) => ({
      ...prev,
      [breakfastId]: !prev[breakfastId],
    }));
  }, []);

  const handleAddToCart = useCallback(
    async (breakfast) => {
      try {
        setAddingToCart((prev) => ({ ...prev, [breakfast.id]: true }));
        
        const selectedGroupOptions = selectedOptions[breakfast.id] || {};
        const requiredGroups = breakfast.optionGroups.map((g) => g.id);
        const missingGroups = requiredGroups.filter((gId) => !selectedGroupOptions[gId]);
        
        if (missingGroups.length > 0) {
          toast.error('Please select one option for each option group');
          setValidationErrors((prev) => ({
            ...prev,
            [breakfast.id]: {
              ...prev[breakfast.id],
              ...missingGroups.reduce((acc, gId) => ({ ...acc, [gId]: true }), {}),
            },
          }));
          return;
        }

        const selectedOptionIds = Object.values(selectedGroupOptions).filter((id) => id);
        const basePrice = parseFloat(breakfast.price) || 0;
        const optionsPrice = breakfast.options
          .filter((opt) => selectedOptionIds.includes(opt.id))
          .reduce((sum, opt) => sum + parseFloat(opt.additional_price), 0);
        const totalPrice = (basePrice + optionsPrice) * (quantities[breakfast.id] || 1);

        const itemToAdd = {
          breakfast_id: parseInt(breakfast.id),
          name: breakfast.name || 'Unknown Breakfast',
          unit_price: basePrice,
          total_price: totalPrice,
          quantity: parseInt(quantities[breakfast.id]) || 1,
          image_url: getImageUrl(breakfast.image_url),
          option_ids: selectedOptionIds,
          options: breakfast.options
            .filter((opt) => selectedOptionIds.includes(opt.id))
            .map((opt) => ({
              ...opt,
              group_title: breakfast.optionGroups.find((g) => g.id === opt.group_id)?.title || 'Unknown Group',
            })),
          cartItemId: `${breakfast.id}-${Date.now()}`,
        };
        
        await addToCart(itemToAdd);
        toast.success(`${breakfast.name} added to cart!`);
        setQuantities((prev) => ({ ...prev, [breakfast.id]: 1 }));
        setSelectedOptions((prev) => ({ ...prev, [breakfast.id]: {} }));
        setValidationErrors((prev) => ({ ...prev, [breakfast.id]: {} }));
      } catch (error) {
        console.error('Error adding to cart:', error);
        toast.error(error.response?.data?.error || 'Failed to add to cart');
      } finally {
        setAddingToCart((prev) => ({ ...prev, [breakfast.id]: false }));
      }
    },
    [addToCart, quantities, selectedOptions]
  );

  const calculatePriceBreakdown = useCallback(
    (breakfast) => {
      const basePrice = parseFloat(breakfast.price) || 0;
      const optionsPrice = breakfast.options
        .filter((opt) => Object.values(selectedOptions[breakfast.id] || {}).includes(opt.id))
        .reduce((sum, opt) => sum + parseFloat(opt.additional_price), 0);
      const quantity = quantities[breakfast.id] || 1;
      const total = (basePrice + optionsPrice) * quantity;
      return {
        basePrice: basePrice.toFixed(2),
        optionsPrice: optionsPrice.toFixed(2),
        total: total.toFixed(2),
      };
    },
    [quantities, selectedOptions]
  );

  const breakfastList = useMemo(() => {
    return breakfasts.map((breakfast, index) => {
      const imageSrc = getImageUrl(breakfast.image_url);
      const priceBreakdown = calculatePriceBreakdown(breakfast);
      const optionsByGroup = breakfast.optionGroups.reduce((acc, group) => {
        const groupOptions = breakfast.options.filter((opt) => opt.group_id === group.id);
        if (groupOptions.length > 0) {
          acc[group.id] = {
            title: group.title,
            options: groupOptions,
          };
        }
        return acc;
      }, {});

      const hasOptions = Object.keys(optionsByGroup).length > 0;
      const isExpanded = expandedOptions[breakfast.id];
      const isAddingToCart = addingToCart[breakfast.id];

      return (
        <div 
          key={breakfast.id} 
          className={`breakfast-menu__breakfast-card breakfast-menu__breakfast-card--index-${index}`}
        >
          <div className="breakfast-menu__image-section">
            <div className="breakfast-menu__image-container">
              <img
                src={imageSrc}
                alt={breakfast.name || 'Breakfast'}
                className="breakfast-menu__product-image"
                loading="lazy"
                onError={(e) => (e.target.src = '/placeholder.jpg')}
              />
              <div className="breakfast-menu__image-overlay">
                <div className={`breakfast-menu__availability-badge ${breakfast.availability ? 'breakfast-menu__available-badge' : 'breakfast-menu__unavailable-badge'}`}>
                  <CheckCircleOutlined className="breakfast-menu__availability-icon" />
                  {breakfast.availability ? 'Available' : 'Unavailable'}
                </div>
              </div>
            </div>
          </div>

          <div className="breakfast-menu__content-section">
            <div className="breakfast-menu__product-header">
              <h2 className="breakfast-menu__product-title">
                {breakfast.name || 'Unknown Breakfast'}
              </h2>
              <div className="breakfast-menu__price-badge">
                ${priceBreakdown.basePrice}
              </div>
            </div>

            <p className="breakfast-menu__product-description">
              {breakfast.description || 'No description available.'}
            </p>

            {hasOptions && (
              <div className="breakfast-menu__options-section">
                <button
                  className="breakfast-menu__options-toggle"
                  onClick={() => toggleOptionsExpanded(breakfast.id)}
                >
                  <CategoryOutlined className="breakfast-menu__category-icon" />
                  <span>Customize ({Object.keys(optionsByGroup).length} options)</span>
                  {isExpanded ? 
                    <ExpandLessOutlined className="breakfast-menu__expand-icon" /> : 
                    <ExpandMoreOutlined className="breakfast-menu__expand-icon" />
                  }
                </button>

                <div 
                  className={`breakfast-menu__options-content ${isExpanded ? 'breakfast-menu__options-content--expanded' : ''}`}
                >
                  {Object.entries(optionsByGroup).map(([groupId, group]) => (
                    <div
                      key={groupId}
                      className={`breakfast-menu__option-group ${validationErrors[breakfast.id]?.[groupId] ? 'breakfast-menu__option-group--error' : ''}`}
                    >
                      <div className="breakfast-menu__group-title">
                        {group.title}
                        {validationErrors[breakfast.id]?.[groupId] && (
                          <span className="breakfast-menu__error-indicator">*</span>
                        )}
                      </div>
                      <div className="breakfast-menu__options-grid">
                        {group.options.map((opt) => {
                          const isSelected = selectedOptions[breakfast.id]?.[groupId] === opt.id;
                          return (
                            <label
                              key={opt.id}
                              className={`breakfast-menu__option-item ${isSelected ? 'breakfast-menu__option-item--selected' : ''}`}
                            >
                              <input
                                type="radio"
                                name={`group-${breakfast.id}-${groupId}`}
                                checked={isSelected}
                                onChange={() => handleOptionChange(breakfast.id, groupId, opt.id)}
                                disabled={!breakfast.availability}
                                className="breakfast-menu__hidden-radio"
                              />
                              <div className="breakfast-menu__option-content">
                                <span className="breakfast-menu__option-name">
                                  {opt.option_name}
                                </span>
                                <span className="breakfast-menu__option-price">
                                  +${parseFloat(opt.additional_price).toFixed(2)}
                                </span>
                              </div>
                              <div className={`breakfast-menu__radio-indicator ${isSelected ? 'breakfast-menu__radio-indicator--selected' : ''}`}>
                                {isSelected && <div className="breakfast-menu__radio-indicator-dot"></div>}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="breakfast-menu__bottom-section">
              <div className="breakfast-menu__quantity-price-row">
                <div className="breakfast-menu__quantity-section">
                  <span className="breakfast-menu__quantity-label">Qty</span>
                  <div className="breakfast-menu__quantity-controls">
                    <button
                      className={`breakfast-menu__quantity-btn ${quantities[breakfast.id] <= 1 || !breakfast.availability ? 'breakfast-menu__quantity-btn--disabled' : ''}`}
                      onClick={() =>
                        setQuantities((prev) => ({
                          ...prev,
                          [breakfast.id]: Math.max(1, prev[breakfast.id] - 1),
                        }))
                      }
                      disabled={quantities[breakfast.id] <= 1 || !breakfast.availability}
                    >
                      <RemoveOutlined className="breakfast-menu__remove-icon" />
                    </button>
                    <span className="breakfast-menu__quantity-display">
                      {quantities[breakfast.id]}
                    </span>
                    <button
                      className={`breakfast-menu__quantity-btn ${!breakfast.availability ? 'breakfast-menu__quantity-btn--disabled' : ''}`}
                      onClick={() =>
                        setQuantities((prev) => ({
                          ...prev,
                          [breakfast.id]: prev[breakfast.id] + 1,
                        }))
                      }
                      disabled={!breakfast.availability}
                    >
                      <AddOutlined className="breakfast-menu__add-icon" />
                    </button>
                  </div>
                </div>

                <div className="breakfast-menu__total-price">
                  <span className="breakfast-menu__total-label">Total</span>
                  <span className="breakfast-menu__total-amount">
                    ${priceBreakdown.total}
                  </span>
                </div>
              </div>

              <button
                className={`breakfast-menu__add-to-cart-btn ${isAddingToCart ? 'breakfast-menu__add-to-cart-btn--loading' : ''} ${!breakfast.availability ? 'breakfast-menu__add-to-cart-btn--disabled' : ''}`}
                onClick={() => handleAddToCart(breakfast)}
                disabled={!breakfast.availability || isAddingToCart}
              >
                {isAddingToCart ? (
                  <>
                    <div className="breakfast-menu__loading-spinner"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <ShoppingCartOutlined className="breakfast-menu__cart-icon" />
                    {breakfast.availability ? 'Add to Cart' : 'Unavailable'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    });
  }, [breakfasts, quantities, selectedOptions, validationErrors, expandedOptions, addingToCart, 
      handleAddToCart, handleOptionChange, toggleOptionsExpanded]);

  if (error) {
    return (
      <div className="breakfast-menu__container">
        <div className="breakfast-menu__error-container">
          <div className="breakfast-menu__error-icon">🍽️</div>
          <p className="breakfast-menu__error-text">{error}</p>
          <button className="breakfast-menu__retry-button" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="breakfast-menu__container">
        <div className="breakfast-menu__loading-container">
          <div className="breakfast-menu__main-loading-spinner"></div>
          <p className="breakfast-menu__loading-text">Loading delicious breakfasts...</p>
        </div>
      </div>
    );
  }

  if (breakfasts.length === 0) {
    return (
      <div className="breakfast-menu__container">
        <div className="breakfast-menu__error-container">
          <div className="breakfast-menu__error-icon">🔍</div>
          <p className="breakfast-menu__error-text">No breakfasts available</p>
          <button className="breakfast-menu__retry-button" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="breakfast-menu__container">
      <div className="breakfast-menu__header">
        <button
          className="breakfast-menu__header-back-btn"
          onClick={() => navigate(-1)}
        >
          <ArrowBackIosOutlined className="breakfast-menu__back-icon" />
        </button>
        <h1 className="breakfast-menu__header-title">
          {id ? breakfasts[0]?.name || 'Breakfast' : 'Breakfast Menu'}
        </h1>
        <div className="breakfast-menu__header-spacer"></div>
      </div>

      <div className="breakfast-menu__content">
        {breakfastList}
      </div>
    </div>
  );
}

export default BreakfastMenu;