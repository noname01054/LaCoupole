import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { initSocket, getSocket } from '../services/socket';
import { toast } from 'react-toastify';
import { useState, useEffect, useCallback, memo } from 'react';
import { debounce } from 'lodash';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  Button,
  ListSubheader,
  Collapse,
  useMediaQuery,
  Slide,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Work as WorkIcon,
  Logout as LogoutIcon,
  LocalCafe as CafeIcon,
  Restaurant as RestaurantIcon,
  LocalOffer as PromotionIcon,
  Group as GroupIcon,
  TableBar as TableIcon,
  Receipt as OrderIcon,
  Category as CategoryIcon,
  Home as HomeIcon,
  ExpandLess,
  ExpandMore,
  ChevronRight as ChevronRightIcon,
  ShoppingCart as ShoppingCartIcon,
  AddCircleOutline as AddCircleOutlineIcon,
  Image as ImageIcon,
  Palette as PaletteIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { lazy, Suspense } from 'react';
import './css/Header.css';

const NotificationBell = lazy(() => import('./NotificationBell'));

const Header = memo(
  ({ cart, setIsCartOpen, user, handleLogout }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [categories, setCategories] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSection, setExpandedSection] = useState('');
    const socket = getSocket();

    const adminLinks = [
      { to: '/admin', label: 'Dashboard', icon: <AdminPanelSettingsIcon />, primary: true },
      { to: '/admin/add-menu-item', label: 'Add Menu Item', icon: <AddCircleOutlineIcon /> },
      { to: '/admin/manage-menu-items', label: 'Menu Items', icon: <RestaurantIcon /> },
      { to: '/admin/supplements', label: 'Manage Supplements', icon: <RestaurantIcon /> },
      { to: '/admin/breakfasts', label: 'Breakfasts', icon: <CafeIcon /> },
      { to: '/admin/promotions', label: 'Promotions', icon: <PromotionIcon /> },
      { to: '/admin/users', label: 'Staff Management', icon: <GroupIcon /> },
      { to: '/admin/tables', label: 'Table Management', icon: <TableIcon /> },
      { to: '/admin/orders', label: 'Order Management', icon: <OrderIcon /> },
      { to: '/admin/categories', label: 'Categories', icon: <CategoryIcon /> },
      { to: '/admin/table-reservations', label: 'Table Reservations', icon: <TableIcon /> },
      { to: '/admin/banners', label: 'Banner Management', icon: <ImageIcon /> },
      { to: '/admin/theme', label: 'Theme Management', icon: <PaletteIcon /> },
    ];

    const staffLinks = [
      { to: '/staff', label: 'Staff Dashboard', icon: <WorkIcon />, primary: true },
      { to: '/staff/table-reservations', label: 'Table Reservations', icon: <TableIcon /> },
    ];

    const publicLinks = [
      { to: '/', label: 'All Products', icon: <HomeIcon />, primary: true },
      ...categories.map((category) => ({
        to: `/category/${category.id}`,
        label: category.name,
        icon: <RestaurantIcon />,
      })),
    ];

    const fetchNotifications = async () => {
      try {
        const res = await api.getNotifications({ is_read: 0 });
        setNotifications(
          res.data.map((n) => ({
            ...n,
            is_read: Number(n.is_read),
            created_at: new Date(n.created_at),
          }))
        );
      } catch (err) {
        console.error('Error fetching notifications:', err);
        toast.error('Failed to load notifications');
      }
    };

    const handleNewNotification = useCallback(
      (notification) => {
        if (notification.clearAll) {
          setNotifications([]);
          return;
        }
        if (!notification.id) {
          console.warn('Invalid notification received:', notification);
          return;
        }
        setNotifications((prev) => {
          const exists = prev.find((n) => n.id === notification.id);
          const updated = exists
            ? prev.map((n) =>
                n.id === notification.id
                  ? {
                      ...n,
                      ...notification,
                      is_read: Number(notification.is_read),
                      created_at: new Date(notification.created_at),
                    }
                  : n
              )
            : [
                {
                  ...notification,
                  is_read: Number(notification.is_read || 0),
                  created_at: new Date(notification.created_at),
                },
                ...prev,
              ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          if (!notification.is_read) {
            console.log('New unread notification added:', notification);
            toast.info(notification.message, { autoClose: 3000 });
          }
          return updated;
        });
      },
      []
    );

    const debouncedSearch = useCallback(
      debounce((query) => {
        if (query.trim()) {
          navigate(`/search?q=${encodeURIComponent(query)}`);
          setSearchQuery('');
          setIsMobileMenuOpen(false);
        }
      }, 300),
      [navigate]
    );

    const handleSearch = (e) => {
      e.preventDefault();
      debouncedSearch(searchQuery);
    };

    useEffect(() => {
      let mounted = true;
      let cleanup = () => {};

      const fetchCategories = async () => {
        try {
          const res = await api.get('/categories');
          if (mounted) setCategories(res.data || []);
        } catch (error) {
          if (mounted) {
            toast.error(error.response?.data?.error || 'Failed to fetch categories');
            setCategories([]);
          }
        }
      };

      const setupSocket = async () => {
        try {
          cleanup = await initSocket(
            () => {},
            () => {},
            () => {},
            () => {},
            () => {},
            () => {},
            handleNewNotification
          );
        } catch (err) {
          console.error('Socket initialization failed:', err);
          toast.error('Failed to connect to real-time updates');
        }
      };

      if (!user || !['admin', 'server'].includes(user?.role)) {
        fetchCategories();
      } else {
        fetchNotifications();
        setupSocket();
      }

      return () => {
        mounted = false;
        if (typeof cleanup === 'function') cleanup();
      };
    }, [user, handleNewNotification]);

    const renderDesktopNavItems = useCallback(() => {
      const links = user?.role === 'admin' ? adminLinks : user?.role === 'server' ? staffLinks : publicLinks.slice(0, 4);
      return links.map((link) => (
        <Button
          key={link.to}
          component={Link}
          to={link.to}
          startIcon={link.icon}
          variant={link.primary ? 'contained' : 'outlined'}
          className="header-desktop-button"
        >
          {link.label}
        </Button>
      ));
    }, [user?.role, categories]);

    const renderMenuSection = useCallback(
      (title, links, isPrimary = false) => (
        <Box className="header-menu-section" key={title}>
          <ListSubheader className="header-list-subheader">
            {title}
          </ListSubheader>
          {links.map((link) => (
            <NavItem key={link.to} link={link} isPrimary={isPrimary} onClick={() => setIsMobileMenuOpen(false)} />
          ))}
        </Box>
      ),
      []
    );

    const renderMobileMenuContent = useCallback(() => {
      const isAdmin = user?.role === 'admin';
      const isStaff = user?.role === 'server';

      return (
        <Box className="header-drawer-content">
          {(!isAdmin && !isStaff) && (
            <Box className="header-search-box">
              <TextField
                fullWidth
                size="small"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon className="header-search-icon" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          <Box className="header-menu-container">
            {isAdmin ? (
              <>
                {renderMenuSection('Administrative Panel', adminLinks.filter((link) => link.primary))}
                <ListItemButton
                  onClick={() => setExpandedSection(expandedSection === 'management' ? '' : 'management')}
                  className="header-list-item"
                >
                  <ListItemIcon className="header-list-item-icon">
                    <CategoryIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Management Tools"
                    className="header-list-item-text"
                  />
                  {expandedSection === 'management' ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={expandedSection === 'management'} timeout={100}>
                  <Box className="header-management-tools">
                    {renderMenuSection('Tools', adminLinks.filter((link) => !link.primary))}
                  </Box>
                </Collapse>
              </>
            ) : isStaff ? (
              renderMenuSection('Staff Portal', staffLinks)
            ) : (
              renderMenuSection('Menu', publicLinks)
            )}
          </Box>

          <Box className="header-user-section">
            {user && (
              <Box className="header-user-info">
                <Avatar className="header-avatar">
                  {user.role === 'admin' ? '👑' : user.role === 'server' ? '👷' : '👤'}
                </Avatar>
                <Box>
                  <Typography
                    variant="subtitle1"
                    className="header-user-name"
                  >
                    {user.name || 'User'}
                  </Typography>
                  <Chip
                    label={`${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Account`}
                    size="small"
                    className="header-user-chip"
                  />
                </Box>
              </Box>
            )}
            {user ? (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                className="header-signout-button"
              >
                Sign Out
              </Button>
            ) : (
              <Button
                fullWidth
                variant="contained"
                startIcon={<PersonIcon />}
                onClick={() => {
                  navigate('/login');
                  setIsMobileMenuOpen(false);
                }}
                className="header-login-button"
              >
                Staff Login
              </Button>
            )}
          </Box>
        </Box>
      );
    }, [user, searchQuery, expandedSection, categories, handleLogout, navigate]);

    return (
      <>
        <AppBar position="fixed" elevation={0} className="header-appbar">
          <Toolbar className="header-toolbar">
            <IconButton edge="start" onLstItemButton
              onClick={() => setIsMobileMenuOpen(true)} className="header-icon-button">
              <MenuIcon />
            </IconButton>

            <Typography
              component={Link}
              to={user?.role === 'admin' ? '/admin' : user?.role === 'server' ? '/staff' : '/'}
              className="header-logo"
            >
              <CafeIcon className="header-logo-icon" />
              Café Local
            </Typography>

            <Box className="header-desktop-nav">{renderDesktopNavItems()}</Box>

            <Box className="header-actions">
              {['admin', 'server'].includes(user?.role) && (
                <Suspense fallback={<Box className="header-icon-button" />}>
                  <NotificationBell
                    user={user}
                    navigate={navigate}
                    notifications={notifications}
                    handleNewNotification={handleNewNotification}
                    socket={socket}
                  />
                </Suspense>
              )}
              {(!user?.role || !['admin', 'server'].includes(user?.role)) && (
                <IconButton onClick={() => setIsCartOpen(true)} className="header-icon-button">
                  <Badge
                    badgeContent={(cart || []).reduce((acc, item) => acc + (item.quantity || 0), 0)}
                    max={300}
                    className="header-badge"
                  >
                    <ShoppingCartIcon className="header-cart-icon" />
                  </Badge>
                </IconButton>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Drawer
          anchor="left"
          open={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          className="header-drawer"
          ModalProps={{ keepMounted: false }}
        >
          <Slide direction="right" in={isMobileMenuOpen} timeout={100}>
            <Box>
              <Box className="header-drawer-header">
                <Typography
                  variant="h6"
                  className="header-drawer-title"
                >
                  <CafeIcon className="header-drawer-icon" />
                  Café Local
                </Typography>
                <IconButton onClick={() => setIsMobileMenuOpen(false)} className="header-icon-button">
                  <CloseIcon />
                </IconButton>
              </Box>

              {renderMobileMenuContent()}
            </Box>
          </Slide>
        </Drawer>

        <Box className="header-spacer" />
      </>
    );
  },
  (prev, next) =>
    prev.cart?.length === next.cart?.length &&
    prev.setIsCartOpen === next.setIsCartOpen &&
    prev.user?.role === next.user?.role &&
    prev.user?.name === next.user?.name &&
    prev.handleLogout === next.handleLogout
);

const NavItem = memo(
  ({ link, isPrimary, onClick }) => (
    <ListItemButton
      component={Link}
      to={link.to}
      onClick={onClick}
      className={isPrimary ? 'header-primary-list-item' : 'header-list-item'}
    >
      <ListItemIcon className="header-list-item-icon">
        {link.icon}
      </ListItemIcon>
      <ListItemText
        primary={link.label}
        className="header-list-item-text"
      />
      {!isPrimary && <ChevronRightIcon className="header-chevron-icon" />}
    </ListItemButton>
  ),
  (prev, next) => prev.link.to === next.link.to && prev.isPrimary === next.isPrimary
);

export default Header;
