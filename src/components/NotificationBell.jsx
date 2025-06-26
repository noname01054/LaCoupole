import { useState, useEffect, useRef } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Divider,
  CircularProgress,
  Button,
} from '@mui/material';
import { Notifications as NotificationsIcon, Receipt, TableBar, CheckCircle } from '@mui/icons-material';
import { api } from '../services/api';
import { toast } from 'react-toastify';

const notificationStyles = {
  notificationList: {
    width: '360px',
    maxHeight: '400px',
    overflowY: 'auto',
    padding: 0,
  },
  notificationItem: {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease-out',
    '&:hover': {
      backgroundColor: '#f9fafb',
    },
  },
  unread: {
    backgroundColor: '#eff6ff',
    fontWeight: '500',
  },
  read: {
    backgroundColor: '#ffffff',
    color: '#6b7280',
  },
  icon: {
    fontSize: 20,
    color: '#6b7280',
  },
  timestamp: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '4px',
  },
  emptyMessage: {
    padding: '16px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
  },
  bellButton: {
    padding: '8px',
  },
  popover: {
    marginTop: '8px',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
  },
  clearButton: {
    padding: '6px 12px',
    fontSize: '13px',
    textTransform: 'none',
    color: '#2563eb',
    '&:hover': {
      backgroundColor: '#eff6ff',
    },
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px',
  },
};

function NotificationBell({ user, navigate, notifications, handleNewNotification, socket }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const hasInteracted = useRef(false);

  // Preload audio separately
  useEffect(() => {
    if (!user) return;

    const audioPath = '/assets/notification.mp3';
    audioRef.current = new Audio(audioPath);
    audioRef.current.preload = 'auto';

    fetch(audioPath, { method: 'HEAD' })
      .then((response) => {
        if (!response.ok) {
          console.error(`Audio file not found at ${audioPath}`, { timestamp: new Date().toISOString() });
          toast.error('Notification sound file is missing.');
        } else {
          console.log(`Audio file preloaded successfully: ${audioPath}`, { timestamp: new Date().toISOString() });
        }
      })
      .catch((err) => {
        console.error('Error checking audio file:', err, { timestamp: new Date().toISOString() });
        toast.error('Failed to load notification sound.');
      });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [user]);

  // Handle user interaction and socket events
  useEffect(() => {
    if (!user || !socket) return;

    const handleInteraction = () => {
      hasInteracted.current = true;
      console.log('User interaction detected, audio playback enabled', { timestamp: new Date().toISOString() });
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    const playSound = () => {
      if (audioRef.current && hasInteracted.current) {
        audioRef.current.currentTime = 0; // Reset to start
        audioRef.current.play().catch((err) => {
          console.error('Audio play error:', err, { timestamp: new Date().toISOString() });
          toast.warn('Notification sound blocked by browser.');
        });
      }
    };

    const handleSocketNotification = (notification) => {
      if (notification?.type === 'order' && !notification.is_read) {
        console.log('New order notification received, attempting to play sound:', notification, {
          timestamp: new Date().toISOString(),
        });
        playSound();
      }
      handleNewNotification(notification);
    };

    socket.on('newNotification', handleSocketNotification);

    // Force sound check on socket connect
    socket.on('connect', () => {
      console.log('Socket connected, checking for pending notifications', { timestamp: new Date().toISOString() });
      const unreadOrder = notifications.find((n) => n.type === 'order' && !n.is_read);
      if (unreadOrder) {
        console.log('Found unread order notification, playing sound:', unreadOrder, {
          timestamp: new Date().toISOString(),
        });
        playSound();
      }
    });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      socket.off('newNotification', handleSocketNotification);
      socket.off('connect');
    };
  }, [user, socket, notifications, handleNewNotification]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    hasInteracted.current = true;
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await api.markNotificationRead(notification.id);
        handleNewNotification({
          ...notification,
          is_read: 1,
        });
      }
      handleClose();
      if (notification.type === 'order' && notification.reference_id) {
        navigate(`/staff?expandOrder=${notification.reference_id}&scrollTo=${notification.reference_id}`);
      } else if (notification.type === 'order') {
        console.warn('Invalid order notification: missing reference_id', notification, { timestamp: new Date().toISOString() });
        toast.error('Cannot navigate to order: invalid order ID');
        navigate('/staff');
      } else if (notification.type === 'reservation') {
        navigate(`/reservation/${notification.reference_id}`);
      }
    } catch (err) {
      console.error('Error processing notification:', err, { timestamp: new Date().toISOString() });
      toast.error('Failed to process notification');
    }
  };

  const handleClearNotifications = async () => {
    try {
      setIsLoading(true);
      await api.clearNotifications();
      handleNewNotification({ clearAll: true });
      toast.success('All notifications cleared');
    } catch (err) {
      console.error('Error clearing notifications:', err, { timestamp: new Date().toISOString() });
      toast.error('Failed to clear notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const open = Boolean(anchorEl);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <IconButton onClick={handleClick} sx={notificationStyles.bellButton}>
        <Badge badgeContent={unreadCount} color="primary">
          <NotificationsIcon sx={{ color: '#374151' }} />
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={notificationStyles.popover}
      >
        <Box sx={notificationStyles.header}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography sx={notificationStyles.title}>Notifications</Typography>
            {notifications.length > 0 && (
              <Button
                onClick={handleClearNotifications}
                sx={notificationStyles.clearButton}
                disabled={isLoading}
              >
                Clear All
              </Button>
            )}
          </Box>
        </Box>
        {isLoading ? (
          <Box sx={notificationStyles.loadingContainer}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Typography sx={notificationStyles.emptyMessage}>
            No notifications yet
          </Typography>
        ) : (
          <List sx={notificationStyles.notificationList}>
            {notifications.map((notification, index) => (
              <ListItem
                key={notification.id || index}
                sx={[notificationStyles.notificationItem, notification.is_read ? notificationStyles.read : notificationStyles.unread]}
                onClick={() => handleNotificationClick(notification)}
              >
                <ListItemIcon>
                  {notification.type === 'order' ? (
                    <Receipt sx={notificationStyles.icon} />
                  ) : notification.type === 'reservation' ? (
                    <TableBar sx={notificationStyles.icon} />
                  ) : (
                    <CheckCircle sx={notificationStyles.icon} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={notification.message}
                  secondary={
                    <Typography sx={notificationStyles.timestamp}>
                      {new Date(notification.created_at).toLocaleString()}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}

export default NotificationBell;