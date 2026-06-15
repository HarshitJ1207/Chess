import { AppBar, Toolbar, Typography, Button, Box, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

export default function NavBar() {
  const navigate = useNavigate();
  const { username, clearAuth } = useAuthStore();

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <AppBar position="static" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid #2a2825' }} elevation={0}>
      <Toolbar>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, cursor: 'pointer', color: 'primary.main', mr: 4 }}
          onClick={() => navigate('/')}
        >
          ♟ Chess
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {username ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            <Button onClick={() => navigate('/history')} sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'inline-flex' } }}>History</Button>
            <Button onClick={() => navigate('/')} sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'inline-flex' } }}>Home</Button>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
              {username[0].toUpperCase()}
            </Avatar>
            <Typography variant="body2" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'block' } }}>{username}</Typography>
            <Button onClick={handleLogout} sx={{ color: 'text.secondary' }}>Logout</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => navigate('/login')}>Login</Button>
            <Button variant="contained" onClick={() => navigate('/register')}>Register</Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
