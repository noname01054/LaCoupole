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
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { lazy, Suspense } from 'react';

const NotificationBell = lazy(() => import('./NotificationBell'));

const iosStyles = {
  header: {
    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    color: '#fff',
    minHeight: '56px',
    '@media (max-width: 767px)': { minHeight: '64px' },
  },
  toolbar: {
    minHeight: '56px',
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    '@media (max-width: 767px)': { minHeight: '64px' },
  },
  logo: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    color: '#fff',
    fontWeight: 600,
    fontSize: '18px',
    '@media (max-width: 767px)': { fontSize: '16px' },
  },
  iconButton: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    '@media (max-width: 767px)': { width: '44px', height: '44px' },
  },
  drawer: {
    '& .MuiDrawer-paper': {
      width: '280px',
      backgroundColor: '#f8f9fa',
      borderTopRightRadius: '16px',
      borderBottomRightRadius: '16px',
      boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.1)',
      '@media (max-width: 767px)': { width: '260px' },
    },
    '& .MuiBackdrop-root': {
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
  },
  drawerHeader: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    backgroundColor: '#fff',
    '@media (max-width: 767px)': { padding: '16px 20px' },
  },
  drawerContent: {
    padding: '12px 0',
    height: 'calc(100vh - 72px)',
    overflowY: 'auto',
    '@media (max-width: 767px)': { height: 'calc(100vh - 80px)' },
  },
  searchBox: {
    margin: '12px 20px',
    '& .MuiTextField-root': {
      '& .MuiOutlinedInput-root': {
        borderRadius: '8px',
        backgroundColor: '#fff',
        border: '1px solid rgba(0, 0, 0, 0.06)',
        '&:hover': { borderColor: 'rgba(0, 0, 0, 0.1)' },
        '&.Mui-focused': { borderColor: '#ff9800' },
      },
    },
    '@media (max-width: 767px)': { margin: '12px 20px' },
  },
  listItem: {
    margin: '2px 12px',
    borderRadius: '8px',
    '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.06)' },
    '@media (max-width: 767px)': { margin: '2px 12px' },
  },
  primaryListItem: {
    margin: '2px 12px',
    borderRadius: '8px',
    backgroundColor: '#ff9800',
    color: '#fff',
    '&:hover': { backgroundColor: '#f57c00' },
    '@media (max-width: 767px)': { margin: '2px 12px' },
  },
  userSection: {
    padding: '16px 20px',
    backgroundColor: '#fff',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    marginTop: 'auto',
    '@media (max-width: 767px)': { padding: '16px 20px' },
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    '@media (max-width: 767px)': { gap: '10px', marginBottom: '12px' },
  },
  desktopNav: {
    display: 'none',
    '@media (min-width: 768px)': { display: 'flex', gap: '10px', position: 'absolute', right: '12px' },
  },
  desktopButton: {
    borderRadius: '16px',
    textTransform: 'none',
    fontWeight: 500,
    padding: '4px 12px',
    '@media (max-width: 767px)': { padding: '4px 12px' },
  },
};

const NavItem = memo(
  ({ link, isPrimary, onClick }) => (
    <ListItemButton
      component={Link}
      to={link.to}
      onClick={onClick}
      sx={isPrimary ? iosStyles.primaryListItem : iosStyles.listItem}
    >
      <ListItemIcon sx={{ color: isPrimary ? '#fff' : '#ff9800', minWidth: '36px' }}>
        {link.icon}
      </ListItemIcon>
      <ListItemText
        primary={link.label}
        sx={{
          '& .MuiListItemText-primary': {
            fontSize: '15px',
            fontWeight: isPrimary ? 600 : 500,
            color: isPrimary ? '#fff' : '#000',
            '@media (max-width: 767px)': { fontSize: '14px' },
          },
        }}
      />
      {!isPrimary && <ChevronRightIcon sx={{ color: '#C7C7CC', fontSize: '16px' }} />}
    </ListItemButton>
  ),
  (prev, next) => prev.link.to === next.link.to && prev.isPrimary === next.isPrimary
);

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
          sx={{
            ...iosStyles.desktopButton,
            backgroundColor: link.primary ? '#ff9800' : 'transparent',
            color: link.primary ? '#fff' : '#fff',
            borderColor: '#fff',
            '&:hover': { backgroundColor: link.primary ? '#f57c00' : 'rgba(255, 255, 255, 0.2)' },
          }}
        >
          {link.label}
        </Button>
      ));
    }, [user?.role, categories]);

    const renderMenuSection = useCallback(
      (title, links, isPrimary = false) => (
        <Box sx={{ marginBottom: '12px' }} key={title}>
          <ListSubheader
            sx={{
              backgroundColor: 'transparent',
              color: '#8E8E93',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              paddingLeft: '20px',
              paddingBottom: '6px',
              '@media (max-width: 767px)': { paddingLeft: '16px', fontSize: '11px' },
            }}
          >
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
        <Box sx={iosStyles.drawerContent}>
          {(!isAdmin && !isStaff) && (
            <Box sx={iosStyles.searchBox}>
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
                      <SearchIcon sx={{ color: '#8E8E93' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          <Box sx={{ paddingBottom: '80px' }}>
            {isAdmin ? (
              <>
                {renderMenuSection('Administrative Panel', adminLinks.filter((link) => link.primary))}
                <ListItemButton
                  onClick={() => setExpandedSection(expandedSection === 'management' ? '' : 'management')}
                  sx={iosStyles.listItem}
                >
                  <ListItemIcon sx={{ color: '#ff9800', minWidth: '36px' }}>
                    <CategoryIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Management Tools"
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontSize: '15px',
                        fontWeight: 500,
                        '@media (max-width: 767px)': { fontSize: '14px' },
                      },
                    }}
                  />
                  {expandedSection === 'management' ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={expandedSection === 'management'} timeout={100}>
                  <Box sx={{ paddingLeft: '12px' }}>
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

          <Box sx={iosStyles.userSection}>
            {user && (
              <Box sx={iosStyles.userInfo}>
                <Avatar sx={{ width: '36px', height: '36px', backgroundColor: '#ff9800', fontSize: '16px' }}>
                  {user.role === 'admin' ? '👑' : user.role === 'server' ? '👷' : '👤'}
                </Avatar>
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, marginBottom: '4px', '@media (max-width: 767px)': { fontSize: '13px' } }}
                  >
                    {user.name || 'User'}
                  </Typography>
                  <Chip
                    label={`${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Account`}
                    size="small"
                    sx={{ backgroundColor: '#ffe0b2', color: '#ff9800', fontSize: '11px', fontWeight: 500 }}
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
                sx={{
                  borderRadius: '8px',
                  borderColor: '#e65100',
                  color: '#e65100',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': { backgroundColor: 'rgba(230, 81, 0, 0.06)' },
                }}
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
                sx={{
                  borderRadius: '8px',
                  backgroundColor: '#ff9800',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': { backgroundColor: '#f57c00' },
                }}
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
        <AppBar position="fixed" elevation={0} sx={iosStyles.header}>
          <Toolbar sx={iosStyles.toolbar}>
            <IconButton edge="start" onClick={() => setIsMobileMenuOpen(true)} sx={iosStyles.iconButton}>
              <MenuIcon sx={{ color: '#fff' }} />
            </IconButton>

            <Typography
              component={Link}
              to={user?.role === 'admin' ? '/admin' : user?.role === 'server' ? '/staff' : '/'}
              sx={iosStyles.logo}
            >
              <CafeIcon sx={{ fontSize: '22px', color: '#fff', '@media (max-width: 767px)': { fontSize: '16px' } }} />
              Café Local
            </Typography>

            <Box sx={iosStyles.desktopNav}>{renderDesktopNavItems()}</Box>

            <Box sx={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
              {['admin', 'server'].includes(user?.role) && (
                <Suspense fallback={<Box sx={iosStyles.iconButton} />}>
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
                <IconButton onClick={() => setIsCartOpen(true)} sx={iosStyles.iconButton}>
                  <Badge
                    badgeContent={(cart || []).reduce((acc, item) => acc + (item.quantity || 0), 0)}
                    max={300}
                    sx={{
                      '& .MuiBadge-badge': {
                        backgroundColor: '#e65100',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                        minWidth: '18px',
                        height: '18px',
                        borderRadius: '9px',
                        border: '1.5px solid #fff',
                        '@media (max-width: 767px)': { fontSize: '11px', minWidth: '16px', height: '16px' },
                      },
                    }}
                  >
                    <ShoppingCartIcon sx={{ color: '#fff', '@media (max-width: 767px)': { fontSize: '20px' } }} />
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
          sx={iosStyles.drawer}
          ModalProps={{ keepMounted: false }}
        >
          <Slide direction="right" in={isMobileMenuOpen} timeout={100}>
            <Box>
              <Box sx={iosStyles.drawerHeader}>
                <Typography
                  variant="h6"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600',
                    '@media (max-width: 767px)': { fontSize: '16px' },
                  }}
                >
                  <CafeIcon sx={{ color: '#ff9800', '@media (max-width: 767px)': { fontSize: '20px' } }} />
                  Café Local
                </Typography>
                <IconButton onClick={() => setIsMobileMenuOpen(false)} sx={iosStyles.iconButton}>
                  <CloseIcon />
                </IconButton>
              </Box>

              {renderMobileMenuContent()}
            </Box>
          </Slide>
        </Drawer>

        <Box sx={{ height: '56px', '@media (max-width: 767px)': { height: '64px' } }} />
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

export default Header;