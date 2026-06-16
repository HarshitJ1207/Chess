import { useState, useEffect } from 'react';
import {
  Box, Grid, Paper, Typography, Button, CircularProgress, Divider
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';

// Icons
import FlashOnIcon from '@mui/icons-material/FlashOn';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';

const TIME_CONTROLS_DETAILS = [
  {
    value: '1+0',
    label: '1+0 Bullet',
    type: 'Bullet',
    description: 'Blazing fast lightning chess. Focus and pure speed.',
    icon: <FlashOnIcon />,
    waitEstimate: 'Very Fast (~10s)'
  },
  {
    value: '3+0',
    label: '3+0 Blitz',
    type: 'Blitz',
    description: 'Dynamic speed chess. The most popular time control.',
    icon: <LocalFireDepartmentIcon />,
    waitEstimate: 'Instant (~4s)'
  },
  {
    value: '5+0',
    label: '5+0 Blitz',
    type: 'Blitz',
    description: 'Classic blitz chess. Great balance of time and flow.',
    icon: <LocalFireDepartmentIcon />,
    waitEstimate: 'Instant (~6s)'
  },
  {
    value: '10+0',
    label: '10+0 Rapid',
    type: 'Rapid',
    description: 'Strategic chess. Enough time for solid calculation.',
    icon: <AccessTimeIcon />,
    waitEstimate: 'Standard (~12s)'
  },
  {
    value: '15+10',
    label: '15+10 Classical',
    type: 'Classical',
    description: 'Traditional slow chess with 10-second increment.',
    icon: <HourglassEmptyIcon />,
    waitEstimate: 'Slow (~30s)'
  }
];

const radarAnimation = `
  @keyframes radarScale {
    0% {
      transform: scale(0.95);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.4);
      opacity: 0.15;
    }
    100% {
      transform: scale(0.95);
      opacity: 0.5;
    }
  }
`;

function TimeControlCard({ detail, selected, onClick, disabled }) {
  return (
    <Paper
      elevation={0}
      onClick={disabled ? undefined : onClick}
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        cursor: disabled ? 'default' : 'pointer',
        bgcolor: selected ? 'rgba(10, 113, 88, 0.08)' : 'background.paper',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : '#2a2825',
        borderRadius: '16px',
        opacity: disabled ? 0.6 : 1,
        boxShadow: selected ? '0 4px 20px rgba(10, 113, 88, 0.15)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': disabled ? {} : {
          bgcolor: selected ? 'rgba(10, 113, 88, 0.12)' : 'action.hover',
          transform: 'translateY(-1px)',
          borderColor: selected ? 'primary.main' : 'primary.light',
        }
      }}
    >
      <Box sx={{
        p: 1.5,
        borderRadius: '12px',
        bgcolor: selected ? 'primary.main' : 'rgba(255, 255, 255, 0.03)',
        color: selected ? '#fff' : 'text.secondary',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}>
        {detail.icon}
      </Box>
      <Box sx={{ textAlign: 'left', flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight={700} color={selected ? 'primary.main' : 'text.primary'}>
            {detail.label}
          </Typography>
          <Typography variant="caption" sx={{ px: 1, py: 0.25, borderRadius: '4px', bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'text.secondary' }}>
            {detail.type}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          {detail.description}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function QueuePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuthStore();
  const [tc, setTc] = useState(location.state?.timeControl || '10+0');
  const [waitSecs, setWaitSecs] = useState(0);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    if (location.state?.autoPlay) {
      window.history.replaceState({}, document.title);
      mutation.mutate();
    }
  }, []);

  useEffect(() => {
    if (!queued) return;
    const interval = setInterval(() => setWaitSecs((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [queued]);

  const mutation = useMutation({
    mutationFn: () => api.queue({ timeControl: tc, elo: 1500 }, token),
    onSuccess: (data) => {
      if (data.status === 'MATCHED') {
        navigate(`/game/${data.gameId}`, { state: { color: data.color } });
      } else {
        setQueued(true);
        poll(data);
      }
    },
  });

  async function poll() {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 120) { clearInterval(interval); setQueued(false); return; } // 2 min timeout
      try {
        const r = await api.queue({ timeControl: tc, elo: 1500 }, token);
        if (r.status === 'MATCHED') {
          clearInterval(interval);
          navigate(`/game/${r.gameId}`, { state: { color: r.color } });
        }
      } catch {
        // keep polling
      }
    }, 2000);
    window.__queueInterval = interval;
  }

  function handleCancel() {
    clearInterval(window.__queueInterval);
    setQueued(false);
    setWaitSecs(0);
    api.dequeue(tc, token).catch(() => {});
  }

  function handlePlay() {
    setWaitSecs(0);
    mutation.mutate();
  }

  const selectedDetail = TIME_CONTROLS_DETAILS.find((item) => item.value === tc);

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
      <style>{radarAnimation}</style>
      
      {/* Header Banner */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, textAlign: 'left' }}>
        <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(10, 113, 88, 0.1)', color: 'primary.main' }}>
          <SportsEsportsIcon fontSize="large" />
        </Box>
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="h5" fontWeight={800}>Matchmaking Arena</Typography>
          <Typography variant="body2" color="text.secondary">
            {queued ? 'Searching for your next match...' : 'Select your time control and enter the matchmaking queue.'}
          </Typography>
        </Box>
      </Box>

      {queued ? (
        /* Focused Searching State (Centered Card) */
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 5,
              width: '100%',
              maxWidth: 460,
              border: '1px solid',
              borderColor: 'primary.main',
              borderRadius: '24px',
              bgcolor: 'background.paper',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(10, 113, 88, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {/* Glowing Radar Search Animation */}
            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: 90, height: 90 }}>
              <Box
                sx={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '2px solid #0a7158',
                  animation: 'radarScale 2s infinite ease-out',
                }}
              />
              <CircularProgress size={70} thickness={4} color="primary" />
              <SearchIcon sx={{ position: 'absolute', color: 'primary.main', fontSize: 30 }} />
            </Box>

            <Box>
              <Typography variant="h6" fontWeight={800} mb={0.5}>Finding Opponent</Typography>
              <Typography variant="body2" color="text.secondary" display="block">
                Searching for a player in the <strong>{selectedDetail?.label}</strong> queue...
              </Typography>
            </Box>

            <Typography variant="h3" fontWeight={900} color="primary.main" sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', my: 1 }}>
              {String(Math.floor(waitSecs / 60)).padStart(2, '0')}:{String(waitSecs % 60).padStart(2, '0')}
            </Typography>

            <Button
              variant="outlined"
              color="error"
              size="large"
              onClick={handleCancel}
              sx={{
                borderRadius: '10px',
                px: 5,
                textTransform: 'none',
                fontWeight: 600,
                width: '100%',
                py: 1.2
              }}
            >
              Cancel Search
            </Button>
          </Paper>
        </Box>
      ) : (
        /* Setup State: Input directly under Time Controls */
        <Grid container spacing={4}>
          {/* Left Side: Time Control Selection + Enter Queue Button */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ textAlign: 'left', mb: 1 }}>
                Available Time Controls
              </Typography>
              
              {TIME_CONTROLS_DETAILS.map((detail) => (
                <TimeControlCard
                  key={detail.value}
                  detail={detail}
                  selected={tc === detail.value}
                  onClick={() => setTc(detail.value)}
                  disabled={queued}
                />
              ))}

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handlePlay}
                loading={mutation.isPending}
                sx={{ mt: 2, py: 1.75, borderRadius: '12px', fontWeight: 700, textTransform: 'none', fontSize: '1.05rem' }}
              >
                Enter Matchmaking Queue
              </Button>
            </Box>
          </Grid>

          {/* Right Side: Matchmaking Rules Info */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'sticky', top: 24 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ textAlign: 'left', mb: 1 }}>
                Matchmaking Info
              </Typography>

              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  border: '1px solid #2a2825',
                  borderRadius: '20px',
                  bgcolor: 'background.paper',
                  textAlign: 'left',
                }}
              >
                <Typography variant="h6" fontWeight={850} mb={1.5} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoIcon color="primary" fontSize="small" /> Matchmaking Rules
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} color="text.primary">Rating Ranges</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5} sx={{ lineHeight: 1.5 }}>
                      The system pairs adjacent ELO ratings within a 200 rating window, expanding dynamically over time to ensure fast pairings.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} color="text.primary">Auto-Abort Rules</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5} sx={{ lineHeight: 1.5 }}>
                      Games must start within 15 seconds. If a player fails to connect or make a move, the game is aborted without penalty.
                      {/* TODO: Implement server-side auto-abort cleanup in game-service if player fails to connect or move */}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} color="text.primary">Queue Speed</Typography>
                    <Typography variant="caption" color="primary.main" fontWeight={700} display="block" mt={0.5}>
                      {selectedDetail?.waitEstimate}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      )}

      {mutation.isError && (
        <Typography color="error" variant="body2" sx={{ mt: 2 }}>
          {mutation.error?.message || 'Failed to join queue'}
        </Typography>
      )}
    </Box>
  );
}
