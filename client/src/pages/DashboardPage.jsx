import { useState } from 'react';
import {
  Box, Grid, Paper, Typography, Button,
  Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';
import { formatUsername } from '../utils/username';

// Icons
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';

const CHESS_QUOTES = [
  { text: "Every chess master was once a beginner.", author: "Irving Chernev" },
  { text: "Chess is the struggle against the error.", author: "Johannes Zukertort" },
  { text: "Play the opening like a book, the middlegame like a magician, and the endgame like a machine.", author: "Rudolf Spielmann" },
  { text: "I don't believe in psychology. I believe in good moves.", author: "Bobby Fischer" },
  { text: "Chess is mental torture.", author: "Garry Kasparov" },
  { text: "The blunders are all there on the board, waiting to be made.", author: "Savielly Tartakower" },
  { text: "In chess, as in life, opportunity sometimes knocks only once.", author: "Al Horowitz" }
];


function StatsCard({ username, token }) {
  const { data: ratingData } = useQuery({
    queryKey: ['rating', username],
    queryFn: () => api.getRating(username, token),
    enabled: !!username && !!token,
  });

  const { data: historyData } = useQuery({
    queryKey: ['history-count', username],
    queryFn: () => api.getHistory(username, 0, 1, token),
    enabled: !!username && !!token,
  });

  return (
    <Paper sx={{ p: 3, border: '1px solid #2a2825', borderRadius: '16px', height: '100%' }}>
      <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonIcon color="primary" /> Profile & Stats
      </Typography>
      <Box sx={{ mt: 2.5 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: '12px', textAlign: 'center', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Rating</Typography>
              <Typography variant="h5" fontWeight={800} color="primary.main">
                {ratingData ? Math.round(ratingData.rating) : '1500'}
              </Typography>
              <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
                ±{ratingData ? ratingData.ratingDeviation?.toFixed(0) : '350'} RD
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: '12px', textAlign: 'center', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Games Played</Typography>
              <Typography variant="h5" fontWeight={800} color="secondary.main">
                {historyData ? historyData.totalElements : '0'}
              </Typography>
              <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>Completed</Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}

function QuickPlayCard({ label, description, icon, onClick }) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        cursor: 'pointer',
        bgcolor: 'background.paper',
        border: '1px solid #2a2825',
        borderRadius: '12px',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          bgcolor: 'action.hover',
          transform: 'translateY(-2px)',
          borderColor: 'primary.main',
          boxShadow: '0 4px 20px rgba(10, 113, 88, 0.15)',
        }
      }}
    >
      <Box sx={{
        p: 1.25,
        borderRadius: '10px',
        bgcolor: 'rgba(10, 113, 88, 0.1)',
        color: 'primary.main',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </Box>
      <Box sx={{ textAlign: 'left', flexGrow: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
      </Box>
      <PlayArrowIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.5 }} />
    </Paper>
  );
}

function RecentGames({ username, token }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['recent-history', username],
    queryFn: () => api.getHistory(username, 0, 3, token),
    enabled: !!username && !!token,
  });

  if (isLoading) return <CircularProgress size={20} />;
  if (!data?.content?.length) return (
    <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
      <Typography variant="body2">No games played yet. Join a queue to start!</Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {data.content.map((game) => {
        const isWhite = game.whiteUsername === username;
        const opp = isWhite ? game.blackUsername : game.whiteUsername;
        let outcome = 'draw';
        if (game.result === '1-0') outcome = isWhite ? 'win' : 'loss';
        else if (game.result === '0-1') outcome = isWhite ? 'loss' : 'win';

        return (
          <Paper
            key={game.gameId}
            elevation={0}
            onClick={() => navigate(`/replay/${game.gameId}`)}
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'background.paper',
              border: '1px solid #2a2825',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'primary.main',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {outcome === 'win' ? (
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} />
              ) : outcome === 'loss' ? (
                <CancelIcon sx={{ color: 'error.main', fontSize: 18 }} />
              ) : (
                <RemoveCircleIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
              )}
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={600}>vs {formatUsername(opp)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {game.playedAt ? new Date(game.playedAt).toLocaleDateString() : ''}
                </Typography>
              </Box>
            </Box>
          </Paper>
        );
      })}
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

  const rows = expanded ? data : data.slice(0, 8);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', pb: 1, borderBottom: '1px solid rgba(255,255,255,0.1)', mb: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', width: 36 }}>#</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>Player</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', width: 65, textAlign: 'right', paddingRight: 0.5 }}>Rating</Typography>
      </Box>

      {/* Rows */}
      <Box
        sx={{
          maxHeight: expanded ? 400 : 'none',
          overflowY: expanded ? 'auto' : 'visible',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          msOverflowStyle: 'none',
        }}
      >
        {rows.map((entry, i) => (
          <Box
            key={entry.username}
            sx={{
              display: 'flex',
              alignItems: 'center',
              py: 1,
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)'
            }}
          >
            {/* Rank */}
            <Box sx={{ width: 36, display: 'flex', alignItems: 'center' }}>
              {i === 0 ? <EmojiEventsIcon sx={{ color: '#f6c90e', fontSize: 16 }} /> :
               i === 1 ? <EmojiEventsIcon sx={{ color: '#c0c0c0', fontSize: 16 }} /> :
               i === 2 ? <EmojiEventsIcon sx={{ color: '#cd7f32', fontSize: 16 }} /> :
               <Typography variant="body2" color="text.secondary">{i + 1}</Typography>}
            </Box>

            {/* Player Name */}
            <Box sx={{ flexGrow: 1, minWidth: 0, mr: 2 }}>
              <Typography
                variant="body2"
                fontWeight={500}
                noWrap
                sx={{ textOverflow: 'ellipsis', overflow: 'hidden' }}
                title={formatUsername(entry.username)}
              >
                {formatUsername(entry.username)}
              </Typography>
            </Box>

            {/* Rating */}
            <Typography variant="body2" fontWeight={600} sx={{ width: 65, textAlign: 'right', paddingRight: 0.5 }}>
              {Math.round(entry.rating)}
            </Typography>
          </Box>
        ))}
      </Box>

      {data.length > 8 && (
        <Button
          size="small"
          onClick={() => setExpanded((e) => !e)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mt: 1.5, color: 'text.secondary', textTransform: 'none', width: '100%' }}
        >
          {expanded ? 'Show less' : `Show more`}
        </Button>
      )}
    </Box>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { username, token, anonymous } = useAuthStore();
  const [quote] = useState(() => CHESS_QUOTES[Math.floor(Math.random() * CHESS_QUOTES.length)]);

  function startQueue(timeControl) {
    navigate('/queue', { state: { timeControl, autoPlay: true } });
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Hero Banner */}
      <Box
        sx={{
          p: { xs: 3, sm: 4 },
          mb: 4,
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(10, 113, 88, 0.35) 0%, rgba(10, 113, 88, 0.05) 100%)',
          border: '1px solid rgba(10, 113, 88, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
          textAlign: 'left',
        }}
      >
        <Typography variant="h4" fontWeight={900} mb={1} sx={{ letterSpacing: '-0.5px' }}>
          {anonymous ? 'Welcome!' : <>Welcome back, <span style={{ color: '#81c784' }}>{formatUsername(username)}</span>!</>}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 650, lineHeight: 1.6 }}>
          Challenge chess players around the globe. Jump into a fast match, review your play history, or check your placement on the leaderboard below.
        </Typography>
      </Box>

      {/* Main Layout Grid */}
      <Grid container spacing={3}>
        {/* Left Section (Lobby, Stats, Recent Games) */}
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Quick Play Card */}
            <Paper sx={{ p: 3, border: '1px solid #2a2825', borderRadius: '16px' }}>
              <Typography variant="h6" fontWeight={700} mb={2} sx={{ textAlign: 'left' }}>
                Quick Play Lobby
              </Typography>
              <Box sx={{ mt: 2.5 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <QuickPlayCard
                      label="1+0 Bullet"
                      description="Lightning-fast 1 minute games"
                      icon={<FlashOnIcon />}
                      onClick={() => startQueue('1+0')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <QuickPlayCard
                      label="3+0 Blitz"
                      description="Rapid-fire 3 minute chess"
                      icon={<LocalFireDepartmentIcon />}
                      onClick={() => startQueue('3+0')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <QuickPlayCard
                      label="5+0 Blitz"
                      description="Standard 5 minute blitz"
                      icon={<LocalFireDepartmentIcon />}
                      onClick={() => startQueue('5+0')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <QuickPlayCard
                      label="10+0 Rapid"
                      description="Perfect pace for deep games"
                      icon={<AccessTimeIcon />}
                      onClick={() => startQueue('10+0')}
                    />
                  </Grid>
                </Grid>
              </Box>
              
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={() => navigate('/queue')}
                sx={{ mt: 2.5, py: 1.2, borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
              >
                View All Time Controls
              </Button>
            </Paper>

            {/* Bottom Row: Stats & Recent Games (Hidden for Guests) */}
            {!anonymous && (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StatsCard username={username} token={token} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Paper sx={{ p: 3, border: '1px solid #2a2825', borderRadius: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1, textAlign: 'left' }}>
                        <HistoryIcon color="primary" /> Recent Games
                      </Typography>
                      <Box sx={{ mt: 2.5 }}>
                        <RecentGames username={username} token={token} />
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      onClick={() => navigate('/history')}
                      sx={{ mt: 2.5, py: 1, borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                    >
                      View Full Match History
                    </Button>
                  </Paper>
                </Grid>
              </Grid>
            )}

          </Box>
        </Grid>

        {/* Right Section (Leaderboard & Quotes) */}
        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Leaderboard */}
            <Paper sx={{ p: 3, border: '1px solid #2a2825', borderRadius: '16px' }}>
              <Typography variant="h6" fontWeight={700} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1, textAlign: 'left' }}>
                <EmojiEventsIcon sx={{ color: '#f6c90e' }} /> Global Leaderboard
              </Typography>
              <Box sx={{ mt: 2.5 }}>
                <Leaderboard token={token} />
              </Box>
            </Paper>

            {/* Chess Quote of the Day */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: '1px solid rgba(255, 255, 255, 0.05)',
                background: 'rgba(255, 255, 255, 0.015)',
                borderRadius: '16px',
                textAlign: 'left',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <FormatQuoteIcon
                sx={{
                  position: 'absolute',
                  top: -10,
                  right: -10,
                  fontSize: 80,
                  color: 'rgba(255, 255, 255, 0.03)',
                  transform: 'rotate(180deg)'
                }}
              />
              <Typography variant="body2" sx={{ fontStyle: 'italic', lineHeight: 1.6, zIndex: 1, position: 'relative' }} mb={1.5}>
                "{quote.text}"
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                — {quote.author}
              </Typography>
            </Paper>

          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
