import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Link, Alert, Divider } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../api';
import { useAuthStore } from '../store';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [googleData, setGoogleData] = useState(null);
  const [googleUsername, setGoogleUsername] = useState('');
  const [googleError, setGoogleError] = useState('');

  function validate(data) {
    const e = {};
    if (data.username.length < 3 || data.username.length > 20) {
      e.username = 'Must be 3-20 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
      e.username = 'Letters, numbers, and underscores only';
    }
    
    if (data.password.length < 8) {
      e.password = 'At least 8 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const mutation = useMutation({
    mutationFn: (userData) => api.register(userData),
    onSuccess: (data, variables) => {
      setAuth(data.token, variables.username);
      navigate('/');
    },
    onError: (error) => {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || '';
      if (status === 409 || msg.toLowerCase().includes('conflict') || msg.toLowerCase().includes('already exists')) {
        setErrors((prev) => ({ ...prev, username: 'Username is already taken' }));
      }
    }
  });

  const googleMutation = useMutation({
    mutationFn: (token) => api.loginGoogle(token),
    onSuccess: (data, token) => {
      if (data.requiresRegistration) {
        setGoogleData({ token, email: data.email });
        setGoogleUsername(data.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, ''));
      } else {
        setAuth(data.token, data.username);
        navigate('/');
      }
    },
  });

  const googleRegisterMutation = useMutation({
    mutationFn: (username) => api.registerGoogle({ token: googleData.token, username }),
    onSuccess: (data) => {
      setAuth(data.token, data.username);
      navigate('/');
    },
    onError: (error) => {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || '';
      if (status === 409 || msg.toLowerCase().includes('conflict') || msg.toLowerCase().includes('taken')) {
        setGoogleError('Username is already taken. Please choose another one.');
      } else {
        setGoogleError(error?.response?.data?.message || 'Registration failed');
      }
    }
  });

  function handleGoogleRegister() {
    const trimmed = googleUsername.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      setGoogleError('Username must be 3-20 characters');
      return;
    }
    googleRegisterMutation.mutate(trimmed);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const data = {
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password
    };
    if (validate(data)) mutation.mutate(data);
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '85vh', py: 4 }}>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 380,
          mx: 2,
          borderRadius: '20px',
          bgcolor: 'background.paper',
          border: '1px solid #2a2825',
          textAlign: 'center',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Logo and Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 3 }}>
          <img src="/chessblitz-icon.svg" alt="ChessBlitz Logo" style={{ width: 32, height: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '0.5px' }}>
            ChessBlitz
          </Typography>
        </Box>

        {mutation.isError && !errors.username && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {mutation.error?.response?.data?.message || mutation.error?.message || 'Registration failed'}
          </Alert>
        )}
        {googleMutation.isError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {googleMutation.error?.response?.data?.message || googleMutation.error?.message || 'Google sign up failed'}
          </Alert>
        )}

        {googleData ? (
          <Box sx={{ animation: 'fadeIn 0.3s ease-in-out' }}>
            <Typography variant="h6" fontWeight={750} mb={1}>
              Choose a Username
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Almost there! You are signing up with <b>{googleData.email}</b>. 
              Please pick a unique username for your ChessBlitz account.
            </Typography>
            {googleError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>{googleError}</Alert>}
            <TextField
              fullWidth
              label="Username"
              value={googleUsername}
              onChange={(e) => {
                setGoogleUsername(e.target.value.replace(/\s/g, ''));
                setGoogleError('');
              }}
              InputProps={{ sx: { borderRadius: '10px' } }}
              autoFocus
              sx={{ mb: 3 }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                fullWidth
                variant="outlined"
                color="inherit"
                onClick={() => setGoogleData(null)}
                sx={{ borderRadius: '10px', fontWeight: 600, textTransform: 'none', py: 1.2, borderColor: 'divider' }}
              >
                Cancel
              </Button>
              <Button 
                fullWidth
                variant="contained" 
                onClick={handleGoogleRegister} 
                loading={googleRegisterMutation.isPending}
                sx={{ borderRadius: '10px', fontWeight: 700, textTransform: 'none', py: 1.2 }}
              >
                Complete
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Typography variant="h6" fontWeight={750} mb={0.5}>
              Sign up
            </Typography>
            
            <Box sx={{ mt: 3.5 }}>
              <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  label="Username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.replace(/\s/g, '') }))}
                  error={!!errors.username}
                  helperText={errors.username}
                  required
                  autoFocus
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.replace(/\s/g, '') }))}
                  required
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
                <TextField
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value.trim() }))}
                  error={!!errors.password}
                  helperText={errors.password || 'Minimum 8 characters'}
                  required
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  loading={mutation.isPending}
                  sx={{
                    py: 1.4,
                    borderRadius: '10px',
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: '0.95rem'
                  }}
                >
                  Register
                </Button>
              </Box>
              
              <Divider sx={{ my: 3.5, color: 'text.secondary', fontSize: '0.85rem', '&::before, &::after': { borderColor: 'divider' } }}>
                OR
              </Divider>
              
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                  onSuccess={(credentialResponse) => googleMutation.mutate(credentialResponse.credential)}
                  onError={() => console.error('Google Signup Failed')}
                  theme="filled_black"
                  shape="rectangular"
                  text="continue_with"
                  width="316px"
                />
              </Box>
            </Box>

            <Typography variant="body2" sx={{ mt: 4, color: 'text.secondary', textAlign: 'center' }}>
              Have an account?{' '}
              <Link component={RouterLink} to="/login" sx={{ fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}
