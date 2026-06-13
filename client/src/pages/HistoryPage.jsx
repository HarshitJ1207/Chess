import { useState } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  TablePagination, CircularProgress, Chip, Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../store';

function resultChip(result) {
  if (result === '1-0') return <Chip label="White wins" size="small" sx={{ bgcolor: '#f0f0f0', color: '#111' }} />;
  if (result === '0-1') return <Chip label="Black wins" size="small" sx={{ bgcolor: '#333', color: '#fff' }} />;
  return <Chip label="Draw" size="small" color="default" />;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { userId, token } = useAuthStore();
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['history', userId, page],
    queryFn: () => api.getHistory(userId, page, pageSize, token),
    enabled: !!userId && !!token,
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
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'text.secondary' }}>Date</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Result</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Termination</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Moves</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.content?.map((game) => (
              <TableRow key={game.gameId} hover>
                <TableCell>
                  <Typography variant="body2">
                    {game.createdAt ? new Date(game.createdAt).toLocaleDateString() : '—'}
                  </Typography>
                </TableCell>
                <TableCell>{resultChip(game.result)}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{game.termination}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{game.moves?.length ?? '—'}</Typography>
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => navigate(`/replay/${game.gameId}`)}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
