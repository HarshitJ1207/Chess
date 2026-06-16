import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import {
  Box, Paper, Typography, IconButton, Button, Divider, CircularProgress,
  Chip, Tooltip
} from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';
import GameBoard from '../components/GameBoard';
import PlayerCard from '../components/PlayerCard';
import MoveList from '../components/MoveList';

function buildPositions(uciMoves) {
  const chess = new Chess();
  const positions = [{ fen: chess.fen(), san: null }];
  for (const uci of uciMoves) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci[4] || undefined;
    try {
      const move = chess.move({ from, to, promotion });
      positions.push({ fen: chess.fen(), san: move.san });
    } catch {
      break;
    }
  }
  return positions;
}

export default function ReplayPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { token, username } = useAuthStore();
  const [ply, setPly] = useState(0);
  const [copied, setCopied] = useState(false);
  const [arrows, setArrows] = useState([]);

  const [whiteRating, setWhiteRating] = useState(null);
  const [blackRating, setBlackRating] = useState(null);

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => api.getGame(gameId, token),
    enabled: !!gameId && !!token,
  });

  const uciMoves = useMemo(() => {
    if (!game?.moves) return [];
    return game.moves.map((m) => m.uci ?? m);
  }, [game]);

  const positions = useMemo(() => buildPositions(uciMoves), [uciMoves]);
  const sanMoves = useMemo(() => positions.slice(1).map((p) => p.san), [positions]);
  const maxPly = positions.length - 1;

  const currentFen = positions[ply]?.fen ?? positions[0].fen;

  // Fetch player ratings
  useEffect(() => {
    if (game?.whiteUsername && token) {
      api.getRating(game.whiteUsername, token)
        .then(r => setWhiteRating(Math.round(r.rating)))
        .catch(() => setWhiteRating(1500));
    }
    if (game?.blackUsername && token) {
      api.getRating(game.blackUsername, token)
        .then(r => setBlackRating(Math.round(r.rating)))
        .catch(() => setBlackRating(1500));
    }
  }, [game, token]);

  // Handle board orientation: look at the board from our player's perspective if we played black
  const boardOrientation = game && game.blackUsername === username ? 'black' : 'white';

  function handleCopyPgn() {
    if (game?.pgn) {
      navigator.clipboard.writeText(game.pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function resultLabel(r) {
    if (r === '1-0') return 'White wins';
    if (r === '0-1') return 'Black wins';
    return 'Draw';
  }

  function formatTerminationReason(termination) {
    if (!termination) return '';
    const map = {
      draw_agreement: 'Draw by Agreement',
      threefold: 'Threefold Repetition',
      stalemate: 'Stalemate',
      insufficient_material: 'Insufficient Material',
      fifty_move: '50-Move Rule',
      timeout: 'Timeout',
      resignation: 'Resignation',
      checkmate: 'Checkmate',
      abort: 'Aborted',
      draw: 'Draw by Agreement'
    };
    const normalized = termination.toLowerCase().replace(/[-]/g, '_');
    return map[normalized] || (termination.charAt(0).toUpperCase() + termination.slice(1).replace(/_/g, ' '));
  }

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'center',
        alignItems: { xs: 'center', md: 'flex-start' },
        gap: { xs: 2.5, sm: 3, md: 4 },
        p: { xs: 1.5, sm: 3 },
        minHeight: '90vh',
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Board Column */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
          maxWidth: 560,
          flexShrink: 0,
        }}
      >
        {/* Top Profile Card */}
        {game && (
          <PlayerCard
            username={boardOrientation === 'white' ? game.blackUsername : game.whiteUsername}
            rating={boardOrientation === 'white' ? (blackRating ?? 1500) : (whiteRating ?? 1500)}
            colorLabel={boardOrientation === 'white' ? 'BLACK' : 'WHITE'}
          />
        )}

        {/* Board Container */}
        <GameBoard
          position={currentFen}
          boardOrientation={boardOrientation}
          arePiecesDraggable={false}
          allowDrawingArrows={true}
          arrows={arrows}
          onArrowsChange={setArrows}
          animationDurationInMs={150}
        />

        {/* Bottom Profile Card */}
        {game && (
          <PlayerCard
            username={boardOrientation === 'white' ? game.whiteUsername : game.blackUsername}
            rating={boardOrientation === 'white' ? (whiteRating ?? 1500) : (blackRating ?? 1500)}
            colorLabel={boardOrientation === 'white' ? 'WHITE' : 'BLACK'}
          />
        )}

        {/* Nav controls */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mt: 0.5, p: 1, bgcolor: 'rgba(30, 28, 25, 0.4)', borderRadius: '12px', border: '1px solid #2a2825' }}>
          <IconButton onClick={() => setPly(0)} disabled={ply === 0} sx={{ color: 'text.secondary' }}><FirstPageIcon /></IconButton>
          <IconButton onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0} sx={{ color: 'text.secondary' }}><NavigateBeforeIcon /></IconButton>
          <Typography variant="body2" fontWeight={700} sx={{ alignSelf: 'center', minWidth: 64, textAlign: 'center', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5 }}>
            {ply} / {maxPly}
          </Typography>
          <IconButton onClick={() => setPly((p) => Math.min(maxPly, p + 1))} disabled={ply === maxPly} sx={{ color: 'text.secondary' }}><NavigateNextIcon /></IconButton>
          <IconButton onClick={() => setPly(maxPly)} disabled={ply === maxPly} sx={{ color: 'text.secondary' }}><LastPageIcon /></IconButton>
        </Box>
      </Box>

      {/* Sidebar Game Panel */}
      <Paper
        elevation={4}
        sx={{
          width: '100%',
          maxWidth: { xs: 560, md: 320 },
          display: 'flex',
          flexDirection: 'column',
          height: { xs: 'auto', md: 664 },
          bgcolor: 'rgba(30, 28, 25, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
        }}
      >
        <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {game && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Chip
                  label={resultLabel(game.result)}
                  size="medium"
                  color={game.result === '1-0' ? 'success' : game.result === '0-1' ? 'error' : 'primary'}
                  variant="filled"
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {formatTerminationReason(game.termination)}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" component="div">
                Played on: {game.playedAt ? new Date(game.playedAt).toLocaleString() : 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
                Length: {Math.ceil(sanMoves.length / 2)} moves ({sanMoves.length} plies)
              </Typography>
            </>
          )}
        </Box>

        {/* Move list */}
        <Box sx={{ flex: 1, minHeight: { xs: 120, md: 0 }, overflowY: 'auto', p: 1.5, bgcolor: 'rgba(0,0,0,0.15)' }}>
          <MoveList moves={sanMoves} currentPly={ply} onSelect={setPly} />
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

        {/* PGN */}
        {game?.pgn && (
          <Box sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.12)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>PGN Data</Typography>
              <Tooltip title={copied ? 'Copied!' : 'Copy PGN'}>
                <IconButton size="small" onClick={handleCopyPgn} sx={{ bgcolor: 'rgba(255,255,255,0.03)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ bgcolor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', p: 1, maxHeight: 110, overflowY: 'auto' }}>
              <Typography variant="caption" component="pre" sx={{ fontSize: 10, fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {game.pgn}
              </Typography>
            </Box>
          </Box>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
        
        {/* Buttons footer */}
        <Box sx={{ p: 1.5, display: 'flex', gap: 1.5, bgcolor: 'background.paper' }}>
          <Button size="medium" variant="outlined" color="inherit" onClick={() => navigate('/history')} sx={{ flex: 1, borderRadius: '8px', textTransform: 'none', fontWeight: 700, borderColor: 'rgba(255,255,255,0.1)' }}>
            Match History
          </Button>
          <Button size="medium" variant="contained" color="primary" onClick={() => navigate('/queue')} sx={{ flex: 1, borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}>
            Play
          </Button>
        </Box>
        
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', bgcolor: 'background.paper', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
          <Button 
            size="small" 
            variant="text" 
            onClick={() => navigate('/')} 
            sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.75rem', fontWeight: 500, '&:hover': { color: 'text.primary', bgcolor: 'transparent' } }}
          >
            Leave Match Table
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
