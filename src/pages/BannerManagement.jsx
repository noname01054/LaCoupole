import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';

function BannerManagement() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({ id: null, link: '', is_enabled: true, image: null });
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserAndBanners = async () => {
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

        const bannersResponse = await api.getBanners({ user_id: currentUser.id });
        console.log('Banners response:', bannersResponse.data); // Debug log
        setBanners(bannersResponse.data || []);
      } catch (error) {
        console.error('Error fetching session or banners:', error);
        toast.error(error.response?.data?.error || 'Failed to load banners');
      }
    };

    fetchUserAndBanners();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !isAdmin) {
      toast.error('User not authenticated or lacks admin access. Please log in again.');
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('link', form.link);
    formData.append('is_enabled', form.is_enabled);
    if (form.image) {
      formData.append('image', form.image);
    }

    try {
      console.log('Submitting banner with user_id:', userId); // Debug log
      if (form.id) {
        await api.updateBanner(form.id, formData);
        toast.success('Banner updated successfully');
      } else {
        await api.addBanner(formData);
        toast.success('Banner created successfully');
      }

      const response = await api.getBanners({ user_id: userId });
      setBanners(response.data || []);
      setForm({ id: null, link: '', is_enabled: true, image: null });
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error(error.response?.data?.error || 'Failed to save banner');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (banner) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    setForm({
      id: banner.id,
      link: banner.link,
      is_enabled: banner.is_enabled,
      image: null,
    });
  };

  const handleDelete = async (id) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this banner?')) return;

    try {
      await api.deleteBanner(id, { user_id: userId });
      setBanners(banners.filter((banner) => banner.id !== id));
      toast.success('Banner deleted successfully');
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error(error.response?.data?.error || 'Failed to delete banner');
    }
  };

  const toggleEnable = async (banner) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('link', banner.link);
      formData.append('is_enabled', !banner.is_enabled);

      await api.updateBanner(banner.id, formData);
      setBanners(
        banners.map((b) =>
          b.id === banner.id ? { ...b, is_enabled: !b.is_enabled } : b
        )
      );
      toast.success(`Banner ${banner.is_enabled ? 'disabled' : 'enabled'} successfully`);
    } catch (error) {
      console.error('Error toggling banner status:', error);
      toast.error(error.response?.data?.error || 'Failed to update banner status');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Banner Management</h2>
      {!isAdmin && <p style={{ color: 'red' }}>You need admin access to manage banners.</p>}
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Banner Link:
            <input
              type="text"
              name="link"
              value={form.link}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              required
              disabled={!isAdmin}
            />
          </label>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Image:
            <input
              type="file"
              name="image"
              accept="image/jpeg,image/png"
              onChange={handleInputChange}
              style={{ marginTop: '5px' }}
              required={!form.id}
              disabled={!isAdmin}
            />
          </label>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Enabled:
            <input
              type="checkbox"
              name="is_enabled"
              checked={form.is_enabled}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, is_enabled: e.target.checked }))
              }
              style={{ marginLeft: '10px' }}
              disabled={!isAdmin}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading || !isAdmin}
          style={{
            padding: '10px 20px',
            background: '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: (loading || !isAdmin) ? 'not-allowed' : 'pointer',
          }}
        >
          {form.id ? 'Update Banner' : 'Add Banner'}
        </button>
        {form.id && (
          <button
            type="button"
            onClick={() => setForm({ id: null, link: '', is_enabled: true, image: null })}
            style={{
              padding: '10px 20px',
              background: '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              marginLeft: '10px',
            }}
            disabled={!isAdmin}
          >
            Cancel Edit
          </button>
        )}
      </form>

      <h3>Banners</h3>
      {banners.length === 0 ? (
        <p>No banners available.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>ID</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Image</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Link</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Enabled</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {banners.map((banner) => (
              <tr key={banner.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{banner.id}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {banner.image_url && (
                    <img
                      src={`${import.meta.env.VITE_API_URL || 'http://192.168.1.13:5000'}${banner.image_url}`}
                      alt="Banner"
                      style={{ width: '100px', height: 'auto' }}
                    />
                  )}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{banner.link}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {banner.is_enabled ? 'Yes' : 'No'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <button
                    onClick={() => handleEdit(banner)}
                    style={{
                      padding: '5px 10px',
                      background: '#2196F3',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      marginRight: '5px',
                    }}
                    disabled={!isAdmin}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    style={{
                      padding: '5px 10px',
                      background: '#d32f2f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      marginRight: '5px',
                    }}
                    disabled={!isAdmin}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => toggleEnable(banner)}
                    style={{
                      padding: '5px 10px',
                      background: banner.is_enabled ? '#FF9800' : '#4CAF50',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                    }}
                    disabled={!isAdmin}
                  >
                    {banner.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default BannerManagement;