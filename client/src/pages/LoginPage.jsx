import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Link, Alert, Divider } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ username: '', password: '' });

  const mutation = useMutation({
    mutationFn: () => api.login(form),
    onSuccess: (data) => {
      setAuth(data.token, data.username ?? form.username);
      navigate('/');
    },
  });

  const anonMutation = useMutation({
    mutationFn: () => api.loginAnonymous(),
    onSuccess: (data) => {
      setAuth(data.token, data.username, true);
      navigate('/');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate();
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
          Sign in
        </Typography>

        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {mutation.error?.message || 'Login failed'}
          </Alert>
        )}
        {anonMutation.isError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {anonMutation.error?.message || 'Guest login failed'}
          </Alert>
        )}

        <Box sx={{ mt: 3.5 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
              autoFocus
              InputProps={{ sx: { borderRadius: '10px' } }}
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
              Sign in
            </Button>
            
            <Divider sx={{ my: 1, color: 'text.secondary', fontSize: '0.85rem' }}>OR</Divider>
            
            <Button
              variant="outlined"
              size="large"
              loading={anonMutation.isPending}
              onClick={() => anonMutation.mutate()}
              sx={{
                py: 1.4,
                borderRadius: '10px',
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '0.95rem',
                color: 'text.secondary',
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'text.primary',
                  bgcolor: 'rgba(255,255,255,0.05)'
                }
              }}
            >
              Play as Guest
            </Button>
          </Box>
        </Box>

        {/* TODO: Add Google OAuth client integration in the future */}

        <Typography variant="body2" sx={{ mt: 4, color: 'text.secondary', textAlign: 'center' }}>
          No account?{' '}
          <Link component={RouterLink} to="/register" sx={{ fontWeight: 600, textDecoration: 'none' }}>Register</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
