import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Link, Alert } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (form.username.length < 3 || form.username.length > 20) {
      e.username = 'Must be 3-20 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      e.username = 'Letters, numbers, and underscores only';
    }
    
    if (form.password.length < 8) {
      e.password = 'At least 8 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const mutation = useMutation({
    mutationFn: () => api.register(form),
    onSuccess: (data) => {
      setAuth(data.token, form.username);
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

  function handleSubmit(e) {
    e.preventDefault();
    if (validate()) mutation.mutate();
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

        <Typography variant="h6" fontWeight={750} mb={0.5}>
          Create account
        </Typography>
        {mutation.isError && !errors.username && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {mutation.error?.response?.data?.message || mutation.error?.message || 'Registration failed'}
          </Alert>
        )}

        <Box sx={{ mt: 3.5 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              InputProps={{ sx: { borderRadius: '10px' } }}
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
        </Box>

        {/* TODO: Add Google OAuth client integration in the future */}

        <Typography variant="body2" sx={{ mt: 4, color: 'text.secondary', textAlign: 'center' }}>
          Have an account?{' '}
          <Link component={RouterLink} to="/login" sx={{ fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
