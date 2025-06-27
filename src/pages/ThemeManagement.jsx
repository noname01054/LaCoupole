import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
} from '@mui/material';

function ThemeManagement() {
  const [theme, setTheme] = useState({
    primary_color: '#ff6b35',
    secondary_color: '#ff8c42',
    background_color: '#faf8f5',
    text_color: '#1f2937',
  });
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Apply theme to CSS custom properties
  const applyTheme = (themeData) => {
    document.documentElement.style.setProperty('--primary-color', themeData.primary_color);
    document.documentElement.style.setProperty('--secondary-color', themeData.secondary_color);
    document.documentElement.style.setProperty('--background-color', themeData.background_color);
    document.documentElement.style.setProperty('--text-color', themeData.text_color);
  };

  useEffect(() => {
    const fetchUserAndTheme = async () => {
      try {
        const response = await api.get('/check-auth');
        const currentUser = response.data;
        console.log('Session response:', currentUser); // Debug log
        if (!currentUser || !currentUser.id) {
          toast.error('User not authenticated. Please log in again.');
          return;
        }
        if (currentUser.role !== 'admin') {
          toast.error('Admin access required');
          return;
        }
        setUserId(currentUser.id);
        setIsAdmin(true);

        const themeResponse = await api.getTheme();
        console.log('Theme response:', themeResponse.data); // Debug log
        setTheme(themeResponse.data);
        applyTheme(themeResponse.data); // Apply theme on load
      } catch (error) {
        console.error('Error fetching session or theme:', error);
        toast.error(error.response?.data?.error || 'Failed to load theme');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndTheme();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTheme((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !isAdmin) {
      toast.error('User not authenticated or lacks admin access. Please log in again.');
      return;
    }
    setLoading(true);

    try {
      await api.updateTheme(theme);
      toast.success('Theme updated successfully');
      applyTheme(theme); // Apply updated theme
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error(error.response?.data?.error || 'Failed to update theme');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <Box sx={{ padding: '20px', textAlign: 'center' }}>
        <Typography variant="h6" sx={{ color: 'red' }}>
          Admin access required
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ padding: '24px', maxWidth: '600px', margin: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'var(--text-color)' }}>
        Theme Management
      </Typography>
      <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Primary Color"
            name="primary_color"
            type="color"
            value={theme.primary_color}
            onChange={handleInputChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Secondary Color"
            name="secondary_color"
            type="color"
            value={theme.secondary_color}
            onChange={handleInputChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Background Color"
            name="background_color"
            type="color"
            value={theme.background_color}
            onChange={handleInputChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Text Color"
            name="text_color"
            type="color"
            value={theme.text_color}
            onChange={handleInputChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              background: 'var(--primary-color)',
              color: '#fff',
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': { background: 'var(--secondary-color)' },
            }}
            fullWidth
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Save Theme'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default ThemeManagement;
