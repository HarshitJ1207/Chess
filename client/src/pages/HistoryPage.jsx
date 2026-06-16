import { useState } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  TablePagination, CircularProgress, Chip, Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import BlockIcon from '@mui/icons-material/Block';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';

function formatTermination(termination) {
  if (!termination) return '—';
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

function resultChip(result, isWhite) {
  if (result === '1/2-1/2') {
    return (
      <Chip
        icon={<RemoveCircleIcon style={{ color: '#b0bec5', fontSize: 16 }} />}
        label="Draw"
        size="small"
        sx={{
          bgcolor: 'rgba(144, 164, 174, 0.12)',
          color: '#b0bec5',
          fontWeight: 600,
          border: '1px solid rgba(144, 164, 174, 0.25)',
        }}
      />
    );
  }
  
  if (result === '*' || result === 'aborted' || result === 'abort') {
    return (
      <Chip
        icon={<BlockIcon style={{ color: '#b0bec5', fontSize: 16 }} />}
        label="Aborted"
        size="small"
        sx={{
          bgcolor: 'rgba(120, 144, 156, 0.12)',
          color: '#b0bec5',
          fontWeight: 600,
          border: '1px solid rgba(120, 144, 156, 0.25)',
        }}
      />
    );
  }

  const won = (result === '1-0' && isWhite) || (result === '0-1' && !isWhite);

  if (won) {
    return (
      <Chip
        icon={<CheckCircleIcon style={{ color: '#81c784', fontSize: 16 }} />}
        label="Won"
        size="small"
        sx={{
          bgcolor: 'rgba(76, 175, 80, 0.15)',
          color: '#81c784',
          fontWeight: 700,
          border: '1px solid rgba(76, 175, 80, 0.3)',
        }}
      />
    );
  } else {
    return (
      <Chip
        icon={<CancelIcon style={{ color: '#e57373', fontSize: 16 }} />}
        label="Lost"
        size="small"
        sx={{
          bgcolor: 'rgba(244, 67, 54, 0.12)',
          color: '#e57373',
          fontWeight: 700,
          border: '1px solid rgba(244, 67, 54, 0.25)',
        }}
      />
    );
  }
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { username, token } = useAuthStore();
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['history', username, page],
    queryFn: () => api.getHistory(username, page, pageSize, token),
    enabled: !!username && !!token,
  });

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress />
    </Box>
  );

  if (isError) return (
    <Box sx={{ p: 4 }}>
      <Typography color="error">Failed to load history.</Typography>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Game History</Typography>
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>Date</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>Result</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>Opponent</TableCell>
                <TableCell sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>Termination</TableCell>
                <TableCell sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>Moves</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.content?.map((game) => {
                const opp = game.whiteUsername === username ? game.blackUsername : game.whiteUsername;
                return (
                  <TableRow key={game.gameId} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {game.playedAt ? new Date(game.playedAt).toLocaleDateString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{resultChip(game.result, game.whiteUsername === username)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{opp}</Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Typography variant="body2" color="text.secondary">{formatTermination(game.termination)}</Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="body2">{game.moves?.length ?? '—'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => navigate(`/replay/${game.gameId}`)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={data?.totalElements ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
        />
      </Paper>
    </Box>
  );
}
