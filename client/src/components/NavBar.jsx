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
        <Box
          onClick={() => navigate('/')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', mr: 4 }}
        >
          <img src="/chessblitz-icon.svg" alt="ChessBlitz Logo" style={{ width: 28, height: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '0.5px' }}>
            ChessBlitz
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {username ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            <Button onClick={() => navigate('/history')} sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'inline-flex' } }}>History</Button>
            <Button onClick={() => navigate('/')} sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'inline-flex' } }}>Home</Button>
            <Button
              onClick={handleLogout}
              variant="outlined"
              color="error"
              size="small"
              sx={{
                borderRadius: '8px',
                px: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Logout
            </Button>
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
