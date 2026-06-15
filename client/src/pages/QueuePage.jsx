import { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, ToggleButton, ToggleButtonGroup, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';

const TIME_CONTROLS = [
  { label: '1+0', value: '1+0' },
  { label: '3+0', value: '3+0' },
  { label: '5+0', value: '5+0' },
  { label: '10+0', value: '10+0' },
  { label: '15+10', value: '15+10' },
];

export default function QueuePage() {
  const navigate = useNavigate();
  const { token, userId } = useAuthStore();
  const [tc, setTc] = useState('10+0');
  const [waitSecs, setWaitSecs] = useState(0);
  const [queued, setQueued] = useState(false);

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

  async function poll(initial) {
    // After queuing, poll by re-queueing (idempotent on the server)
    // or navigate when we get MATCHED back from a future queue call
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
    // Store interval for cancel cleanup
    window.__queueInterval = interval;
  }

  function handleCancel() {
    clearInterval(window.__queueInterval);
    setQueued(false);
    setWaitSecs(0);
    api.dequeue(tc, token).catch(() => {}); // best effort, ignore errors
  }

  function handlePlay() {
    setWaitSecs(0);
    mutation.mutate();
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 400, mx: 2, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} mb={1}>Find a Game</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Select time control
        </Typography>

        <ToggleButtonGroup
          value={tc}
          exclusive
          onChange={(_, v) => v && setTc(v)}
          sx={{ mb: 3, flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}
        >
          {TIME_CONTROLS.map((t) => (
            <ToggleButton key={t.value} value={t.value} sx={{ minWidth: 60 }}>
              {t.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {queued ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress color="primary" />
            <Typography variant="body1">Waiting for opponent…</Typography>
            <Typography variant="h6" fontWeight={700} color="text.secondary">
              {String(Math.floor(waitSecs / 60)).padStart(2, '0')}:{String(waitSecs % 60).padStart(2, '0')}
            </Typography>
            <Button variant="outlined" color="error" onClick={handleCancel}>Cancel</Button>
          </Box>
        ) : (
          <Button
            variant="contained"
            size="large"
            onClick={handlePlay}
            loading={mutation.isPending}
            sx={{ fontWeight: 700, px: 6, py: 1.5 }}
          >
            Play
          </Button>
        )}

        {mutation.isError && (
          <Typography color="error" variant="body2" mt={2}>
            {mutation.error?.message || 'Failed to join queue'}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
