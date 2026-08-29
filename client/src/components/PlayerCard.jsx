import { memo } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { formatUsername } from '../utils/username';

function PlayerCard({
  username,
  rating = 1500,
  active = false,
  colorLabel = '',
  rightElement,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 1.5,
        bgcolor: 'rgba(30, 28, 25, 0.4)',
        border: '1px solid',
        borderColor: active ? 'rgba(10, 113, 88, 0.4)' : '#2a2825',
        borderRadius: '12px',
        width: '100%',
        boxShadow: active ? '0 0 15px rgba(10, 113, 88, 0.1)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body1" fontWeight={700} noWrap sx={{ color: 'text.primary' }}>
          {formatUsername(username)}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Rating: {username?.startsWith('anon-') ? '—' : rating}
        </Typography>
      </Box>
      {rightElement ? (
        rightElement
      ) : (
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          {colorLabel}
        </Typography>
      )}
    </Paper>
  );
}

export default memo(PlayerCard);
