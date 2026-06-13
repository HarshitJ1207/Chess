import { Box, Typography } from '@mui/material';
import { formatClock } from '../hooks/useClock';

export default function ClockDisplay({ ms, active, color }) {
  const isLow = ms !== null && ms < 30_000;

  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        borderRadius: 1,
        bgcolor: active ? (isLow ? 'error.dark' : 'primary.main') : 'background.paper',
        border: '1px solid',
        borderColor: active ? 'transparent' : '#2a2825',
        minWidth: 90,
        textAlign: 'center',
        transition: 'background-color 0.2s',
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: active ? '#fff' : isLow ? 'error.main' : 'text.primary',
          letterSpacing: 1,
        }}
      >
        {formatClock(ms)}
      </Typography>
      <Typography variant="caption" sx={{ color: active ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>
        {color}
      </Typography>
    </Box>
  );
}
