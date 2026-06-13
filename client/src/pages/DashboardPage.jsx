import { useState } from 'react';
import {
  Box, Grid, Paper, Typography, Button, Avatar, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Collapse,
  CircularProgress, Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

function RatingCard({ userId, token }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rating', userId],
    queryFn: () => api.getRating(userId, token),
    enabled: !!userId && !!token,
  });

  if (isLoading) return <CircularProgress size={20} />;
  if (!data) return null;

  return (
    <Box>
      <Typography variant="h3" fontWeight={700} color="primary.main">
        {Math.round(data.rating)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        RD {data.ratingDeviation?.toFixed(0)} · Glicko-2
      </Typography>
    </Box>
  );
}

function Leaderboard({ token }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.getLeaderboard(token),
    enabled: !!token,
  });

  if (isLoading) return <CircularProgress size={20} />;
  if (!data) return <Typography color="text.secondary">No data</Typography>;

  const rows = expanded ? data.slice(0, 50) : data.slice(0, 10);

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: 'text.secondary', width: 40 }}>#</TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>Player</TableCell>
            <TableCell sx={{ color: 'text.secondary' }} align="right">Rating</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((entry, i) => (
            <TableRow key={entry.playerId} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell>
                {i === 0 ? <EmojiEventsIcon sx={{ color: '#f6c90e', fontSize: 16 }} /> :
                 i === 1 ? <EmojiEventsIcon sx={{ color: '#c0c0c0', fontSize: 16 }} /> :
                 i === 2 ? <EmojiEventsIcon sx={{ color: '#cd7f32', fontSize: 16 }} /> :
                 <Typography variant="body2" color="text.secondary">{i + 1}</Typography>}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{entry.username ?? entry.playerId}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={600}>{Math.round(entry.rating)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data.length > 10 && (
        <Button
          size="small"
          onClick={() => setExpanded((e) => !e)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mt: 1, color: 'text.secondary' }}
        >
          {expanded ? 'Show less' : `Show top 50 (${data.length} total)`}
        </Button>
      )}
    </Box>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { userId, username, token } = useAuthStore();

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: 3 }}>
      <Grid container spacing={3}>
        {/* Profile + Play */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 24 }}>
                {username?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>{username}</Typography>
                <Typography variant="body2" color="text.secondary">Active player</Typography>
              </Box>
            </Box>

            <Divider />
            <RatingCard userId={userId} token={token} />
            <Divider />

            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/queue')}
              sx={{ fontWeight: 700, py: 1.5 }}
            >
              Play
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/history')}
            >
              Game History
            </Button>
          </Paper>
        </Grid>

        {/* Leaderboard */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Leaderboard</Typography>
            <Leaderboard token={token} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
