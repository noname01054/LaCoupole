import { useState } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LoginIcon from '@mui/icons-material/Login';
import { v4 as uuidv4 } from 'uuid';
import './css/Login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/login', { email, password });
      const { user, token } = res.data;
      if (!user || !user.id || !user.email || !user.role) {
        throw new Error('Invalid user data received from server');
      }
      if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined') {
        throw new Error('Invalid or missing token received from server');
      }
      localStorage.setItem('jwt_token', token);
      const sessionId = `user-${user.id}-${uuidv4()}`;
      localStorage.setItem('sessionId', sessionId);
      api.defaults.headers.common['X-Session-Id'] = sessionId;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('Login successful', { user: { id: user.id, email: user.email, role: user.role }, token: token.substring(0, 10) + '...', sessionId });
      toast.success('Logged in successfully');
      onLogin(user, token);
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || error.message || 'Login failed');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('sessionId');
      delete api.defaults.headers.common['X-Session-Id'];
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-background-circle1"></div>
      <div className="login-background-circle2"></div>
      <div className="login-background-circle3"></div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-icon-container">
            <LoginIcon className="login-header-icon" />
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-group">
            <div 
              className={`login-input-container ${focusedField === 'email' ? 'login-input-container--focused' : ''}`}
            >
              <EmailIcon className={`login-input-icon ${focusedField === 'email' || email ? 'login-input-icon--active' : ''}`} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="Email address"
                required
                className="login-animated-input"
              />
            </div>
          </div>

          <div className="login-input-group">
            <div 
              className={`login-input-container ${focusedField === 'password' ? 'login-input-container--focused' : ''}`}
            >
              <LockIcon className={`login-input-icon ${focusedField === 'password' || password ? 'login-input-icon--active' : ''}`} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Password"
                required
                className="login-animated-input"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="login-visibility-button"
              >
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className={`login-submit-button ${isLoading ? 'login-submit-button--disabled' : ''}`}
          >
            <span className="login-button-content">
              {isLoading && <div className="login-spinner"></div>}
              {isLoading ? 'Signing in...' : 'Sign In'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;