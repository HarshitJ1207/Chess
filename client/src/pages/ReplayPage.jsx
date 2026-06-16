import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import {
  Box, Paper, Typography, IconButton, Button, Divider, CircularProgress,
  Chip, Tooltip,
} from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';

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

function MoveList({ moves, currentPly, onSelect }) {
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ n: i / 2 + 1, w: { san: moves[i], ply: i + 1 }, b: moves[i + 1] ? { san: moves[i + 1], ply: i + 2 } : null });
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
      {pairs.map((p) => (
        <Box key={p.n} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 28 }}>{p.n}.</Typography>
          <Typography
            variant="body2"
            sx={{
              minWidth: 52,
              cursor: 'pointer',
              fontWeight: currentPly === p.w.ply ? 700 : 400,
              color: currentPly === p.w.ply ? 'primary.main' : 'text.primary',
              '&:hover': { color: 'primary.light' },
            }}
            onClick={() => onSelect(p.w.ply)}
          >
            {p.w.san}
          </Typography>
          {p.b && (
            <Typography
              variant="body2"
              sx={{
                cursor: 'pointer',
                fontWeight: currentPly === p.b.ply ? 700 : 400,
                color: currentPly === p.b.ply ? 'primary.main' : 'text.secondary',
                '&:hover': { color: 'primary.light' },
              }}
              onClick={() => onSelect(p.b.ply)}
            >
              {p.b.san}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

export default function ReplayPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [ply, setPly] = useState(0);
  const [copied, setCopied] = useState(false);
  const [arrows, setArrows] = useState([]);

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

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      justifyContent: 'center',
      alignItems: { xs: 'center', md: 'flex-start' },
      gap: 2,
      p: { xs: 1, sm: 2 },
    }}>
      {/* Board */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: { xs: '100%', sm: 480, md: 560 } }}>
        <Box>
          <Chessboard
            options={{
              position: currentFen,
              allowDragging: false,
              allowDrawingArrows: true,
              arrows,
              onArrowsChange: ({ arrows: a }) => setArrows(a),
              animationDurationInMs: 150,
            }}
          />
        </Box>

        {/* Nav controls */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
          <IconButton onClick={() => setPly(0)} disabled={ply === 0}><FirstPageIcon /></IconButton>
          <IconButton onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}><NavigateBeforeIcon /></IconButton>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', minWidth: 60, textAlign: 'center' }}>
            {ply}/{maxPly}
          </Typography>
          <IconButton onClick={() => setPly((p) => Math.min(maxPly, p + 1))} disabled={ply === maxPly}><NavigateNextIcon /></IconButton>
          <IconButton onClick={() => setPly(maxPly)} disabled={ply === maxPly}><LastPageIcon /></IconButton>
        </Box>
      </Box>

      {/* Sidebar */}
      <Paper sx={{ width: '100%', maxWidth: { xs: '100%', md: 300 }, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: { md: 560 } }}>
        <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
          {game && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Chip
                  label={resultLabel(game.result)}
                  size="medium"
                  color={game.result === '1-0' ? 'success' : game.result === '0-1' ? 'error' : 'primary'}
                  variant="filled"
                />
                <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', color: 'text.secondary' }}>
                  {game.termination}
                </Typography>
              </Box>
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2">White: <strong>{game.whiteUsername}</strong></Typography>
                <Typography variant="body2">Black: <strong>{game.blackUsername}</strong></Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {Math.ceil(sanMoves.length / 2)} moves ({sanMoves.length} plies)
              </Typography>
            </>
          )}
        </Box>
        <Divider />

        {/* Move list */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1, maxHeight: 400 }}>
          <MoveList moves={sanMoves} currentPly={ply} onSelect={setPly} />
        </Box>

        <Divider />

        {/* PGN */}
        {game?.pgn && (
          <Box sx={{ p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">PGN</Typography>
              <Tooltip title={copied ? 'Copied!' : 'Copy PGN'}>
                <IconButton size="small" onClick={handleCopyPgn}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" component="pre" sx={{ fontSize: 10, color: 'text.secondary', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {game.pgn}
            </Typography>
          </Box>
        )}

        <Divider />
        <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
          <Button size="small" onClick={() => navigate('/history')} sx={{ flex: 1 }}>History</Button>
          <Button size="small" variant="contained" onClick={() => navigate('/queue')} sx={{ flex: 1 }}>Play</Button>
        </Box>
      </Paper>
    </Box>
  );
}
