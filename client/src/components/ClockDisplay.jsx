import { Box, Typography } from '@mui/material';

export default function ClockDisplay({ ms, active, color }) {
  const isLow = ms !== null && ms < 30000;

  // Premium clock format: show tenths of a second if time is under 10s
  const formatTime = (timeMs) => {
    if (timeMs === null || timeMs === undefined) return '--:--';
    const totalMs = Math.max(0, timeMs);
    
    if (totalMs < 10000) {
      // Under 10s: show e.g. 9.4
      return (totalMs / 1000).toFixed(1);
    }
    
    const totalSec = Math.ceil(totalMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Box
      sx={{
        px: 2,
        py: 0.75,
        borderRadius: '8px',
        bgcolor: '#0e0e0c',
        border: '2px solid',
        borderColor: active 
          ? (isLow ? '#f44336' : '#0a7158')
          : 'rgba(255,255,255,0.05)',
        minWidth: 100,
        textAlign: 'center',
        boxShadow: active 
          ? (isLow 
              ? '0 0 12px rgba(244, 67, 54, 0.4)' 
              : '0 0 12px rgba(10, 113, 88, 0.4)')
          : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        // Subtle pulse animation if low time and active
        animation: active && isLow ? 'pulse-clock 1s infinite alternate' : 'none',
        '@keyframes pulse-clock': {
          '0%': { borderColor: '#f44336', boxShadow: '0 0 6px rgba(244, 67, 54, 0.2)' },
          '100%': { borderColor: '#d32f2f', boxShadow: '0 0 16px rgba(244, 67, 54, 0.6)' }
        }
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: '"Courier New", Courier, monospace',
          color: active 
            ? (isLow ? '#ff5252' : '#26a69a')
            : (isLow ? '#b71c1c' : '#a0998f'),
          textShadow: active 
            ? (isLow 
                ? '0 0 8px rgba(255, 82, 82, 0.6)' 
                : '0 0 8px rgba(38, 166, 154, 0.6)')
            : 'none',
          letterSpacing: 0.5,
          fontSize: '1.6rem',
          lineHeight: 1.1,
        }}
      >
        {formatTime(ms)}
      </Typography>
      <Typography 
        variant="caption" 
        sx={{ 
          fontSize: '0.65rem', 
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
          mt: 0.25,
          color: active ? 'text.primary' : 'text.disabled' 
        }}
      >
        {color}
      </Typography>
    </Box>
  );
}

