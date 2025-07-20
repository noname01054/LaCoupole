import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
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
  ({ cart, setIsCartOpen, user, handleLogout, theme: customTheme }) => {
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
      { to: '/admin/breakfasts', label: 'Breakfasts', icon: <RestaurantIcon /> },
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

      if (!user || !['admin', 'server'].includes(user?.role)) {
        fetchCategories();
      } else {
        fetchNotifications();
      }

      return () => {
        mounted = false;
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
            borderRadius: '16px',
            textTransform: 'none',
            fontWeight: 500,
            padding: '4px 12px',
            backgroundColor: link.primary ? 'var(--primary-color)' : 'transparent',
            color: 'var(--text-color)',
            borderColor: 'var(--text-color)',
            '&:hover': {
              backgroundColor: link.primary ? 'var(--secondary-color)' : 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          {link.label}
        </Button>
      ));
    }, [user?.role, categories]);

    const renderMenuSection = useCallback(
      (title, links, isPrimary = false) => (
        <Box className="header-menu-section" key={title}>
          <ListSubheader sx={{ backgroundColor: 'transparent', color: '#8E8E93', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', paddingLeft: '20px', paddingBottom: '6px' }}>
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
        <Box className="header-drawer-content" sx={{ backgroundColor: 'var(--background-color)' }}>
          {(!isAdmin && !isStaff) && (
            <Box className="header-search-box" sx={{ margin: '12px 20px' }}>
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    backgroundColor: '#fff',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    '&:hover': { borderColor: 'rgba(0, 0, 0, 0.1)' },
                    '&.Mui-focused': { borderColor: 'var(--primary-color)' },
                  },
                }}
              />
            </Box>
          )}

          <Box className="header-menu-container" sx={{ paddingBottom: '80px' }}>
            {isAdmin ? (
              <>
                {renderMenuSection('Administrative Panel', adminLinks.filter((link) => link.primary))}
                <ListItemButton
                  onClick={() => setExpandedSection(expandedSection === 'management' ? '' : 'management')}
                  sx={{ margin: '2px 12px', borderRadius: '8px' }}
                >
                  <ListItemIcon sx={{ color: 'var(--primary-color)', minWidth: '36px' }}>
                    <CategoryIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Management Tools"
                    primaryTypographyProps={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-color)' }}
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

          <Box className="header-user-section" sx={{ padding: '16px 20px', backgroundColor: '#fff', borderTop: '1px solid rgba(0, 0, 0, 0.06)', marginTop: 'auto' }}>
            {user && (
              <Box className="header-user-info" sx={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Avatar sx={{ width: '36px', height: '36px', backgroundColor: 'var(--primary-color)', fontSize: '16px' }}>
                  {user.role === 'admin' ? '👑' : user.role === 'server' ? '👷' : '👤'}
                </Avatar>
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: '4px' }}
                  >
                    {user.name || 'User'}
                  </Typography>
                  <Chip
                    label={`${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Account`}
                    size="small"
                    sx={{ backgroundColor: 'var(--secondary-color)', color: 'var(--primary-color)', fontSize: '11px', fontWeight: 500 }}
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
                  borderColor: 'var(--primary-color)',
                  color: 'var(--primary-color)',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.06)' },
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
                  backgroundColor: 'var(--primary-color)',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': { backgroundColor: 'var(--secondary-color)' },
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
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            background: `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)`,
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            color: 'var(--text-color)',
            minHeight: { xs: '64px', md: '56px' },
          }}
        >
          <Toolbar sx={{ minHeight: { xs: '64px', md: '56px' }, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton
              edge="start"
              onClick={() => setIsMobileMenuOpen(true)}
              sx={{ width: { xs: '44px', md: '40px' }, height: { xs: '44px', md: '40px' }, borderRadius: '8px', backgroundColor: 'transparent', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' } }}
            >
              <MenuIcon />
            </IconButton>

            <Typography
              component={Link}
              to={user?.role === 'admin' ? '/admin' : user?.role === 'server' ? '/staff' : '/'}
              sx={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                color: 'var(--text-color)',
                fontWeight: 600,
                fontSize: { xs: '16px', md: '18px' },
              }}
            >
              {customTheme?.logo_url ? (
                <img
                  src={customTheme.logo_url}
                  alt="Café Logo"
                  style={{ maxHeight: '40px', maxWidth: '100px' }}
                  onError={(e) => {
                    console.error('Error loading logo image:', customTheme.logo_url);
                    e.target.src = '/placeholder.jpg';
                  }}
                />
              ) : (
                <>
                  <RestaurantIcon sx={{ fontSize: { xs: '16px', md: '22px' }, color: 'var(--text-color)' }} />
                  Café Local
                </>
              )}
            </Typography>

            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: '10px', position: 'absolute', right: '12px' }}>
              {renderDesktopNavItems()}
            </Box>

            <Box sx={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
              {['admin', 'server'].includes(user?.role) && (
                <Suspense fallback={<Box sx={{ width: '40px', height: '40px' }} />}>
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
                <IconButton
                  onClick={() => setIsCartOpen(true)}
                  sx={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'transparent', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' } }}
                >
                  <Badge
                    badgeContent={(cart || []).reduce((acc, item) => acc + (item.quantity || 0), 0)}
                    max={300}
                    sx={{
                      '& .MuiBadge-badge': {
                        backgroundColor: 'var(--primary-color)',
                        color: 'var(--text-color)',
                        fontSize: { xs: '11px', md: '12px' },
                        fontWeight: 600,
                        minWidth: { xs: '16px', md: '18px' },
                        height: { xs: '16px', md: '18px' },
                        borderRadius: '9px',
                        border: '1.5px solid var(--text-color)',
                      },
                    }}
                  >
                    <ShoppingCartIcon sx={{ color: 'var(--text-color)', fontSize: { xs: '20px', md: '24px' } }} />
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
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: '260px', md: '280px' },
              backgroundColor: 'var(--background-color)',
              borderTopRightRadius: '16px',
              borderBottomRightRadius: '16px',
              boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.1)',
            },
            '& .MuiBackdrop-root': { backgroundColor: 'rgba(0, 0, 0, 0.3)' },
          }}
        >
          <Slide direction="right" in={isMobileMenuOpen} timeout={100}>
            <Box>
              <Box sx={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', backgroundColor: '#fff' }}>
                <Typography
                  variant="h6"
                  sx={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: { xs: '16px', md: '18px' } }}
                >
                  {customTheme?.logo_url ? (
                    <img
                      src={customTheme.logo_url}
                      alt="Café Logo"
                      style={{ maxHeight: '40px', maxWidth: '100px' }}
                      onError={(e) => {
                        console.error('Error loading logo image:', customTheme.logo_url);
                        e.target.src = '/placeholder.jpg';
                      }}
                    />
                  ) : (
                    <>
                      <RestaurantIcon sx={{ fontSize: { xs: '20px', md: '24px' }, color: 'var(--primary-color)' }} />
                      Café Local
                    </>
                  )}
                </Typography>
                <IconButton
                  onClick={() => setIsMobileMenuOpen(false)}
                  sx={{ width: { xs: '44px', md: '40px' }, height: { xs: '44px', md: '40px' }, borderRadius: '8px', backgroundColor: 'transparent', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' } }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>

              {renderMobileMenuContent()}
            </Box>
          </Slide>
        </Drawer>

        <Box sx={{ height: { xs: '64px', md: '56px' } }} />
      </>
    );
  },
  (prev, next) =>
    prev.cart?.length === next.cart?.length &&
    prev.setIsCartOpen === next.setIsCartOpen &&
    prev.user?.role === next.user?.role &&
    prev.user?.name === next.user?.name &&
    prev.handleLogout === next.handleLogout &&
    prev.theme?.logo_url === next.theme?.logo_url
);

const NavItem = memo(
  ({ link, isPrimary, onClick }) => (
    <ListItemButton
      component={Link}
      to={link.to}
      onClick={onClick}
      sx={{
        margin: '2px 12px',
        borderRadius: '8px',
        backgroundColor: isPrimary ? 'var(--primary-color)' : 'transparent',
        color: isPrimary ? 'var(--text-color)' : '#000',
        '&:hover': { backgroundColor: isPrimary ? 'var(--secondary-color)' : 'rgba(0, 0, 0, 0.06)' },
      }}
    >
      <ListItemIcon sx={{ color: isPrimary ? 'var(--text-color)' : 'var(--primary-color)', minWidth: '36px' }}>
        {link.icon}
      </ListItemIcon>
      <ListItemText
        primary={link.label}
        primaryTypographyProps={{ fontSize: '15px', fontWeight: isPrimary ? 600 : 500, color: isPrimary ? 'var(--text-color)' : '#000' }}
      />
      {!isPrimary && <ChevronRightIcon sx={{ color: '#C7C7CC', fontSize: '16px' }} />}
    </ListItemButton>
  ),
  (prev, next) => prev.link.to === next.link.to && prev.isPrimary === next.isPrimary
);

export default Header;
