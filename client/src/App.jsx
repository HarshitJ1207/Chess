import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import { useAuthStore } from './store';
import NavBar from './components/NavBar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import QueuePage from './pages/QueuePage';
import GamePage from './pages/GamePage';
import HistoryPage from './pages/HistoryPage';
import ReplayPage from './pages/ReplayPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function RequireAuth({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

function RequireRegistered({ children }) {
  const token = useAuthStore((s) => s.token);
  const anonymous = useAuthStore((s) => s.anonymous);
  if (!token) return <Navigate to="/login" replace />;
  if (anonymous) return <Navigate to="/queue" replace />;
  return children;
}

function AppLayout() {
  const location = useLocation();
  const hideNavBar = location.pathname === '/login' || location.pathname === '/register';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {!hideNavBar && <NavBar />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/queue" element={<RequireAuth><QueuePage /></RequireAuth>} />
        <Route path="/game/:gameId" element={<RequireAuth><GamePage /></RequireAuth>} />
        <Route path="/history" element={<RequireRegistered><HistoryPage /></RequireRegistered>} />
        <Route path="/replay/:gameId" element={<RequireRegistered><ReplayPage /></RequireRegistered>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
