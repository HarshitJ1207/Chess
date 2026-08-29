import { Box, Typography } from '@mui/material';
import { memo, useRef, useEffect } from 'react';

function MoveList({ moves, currentPly, onSelect }) {
  const scrollRef = useRef(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [moves, currentPly]);

  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    const wPly = i + 1;
    const bPly = i + 2;
    pairs.push({
      n: i / 2 + 1,
      w: { san: moves[i], ply: wPly },
      b: moves[i + 1] ? { san: moves[i + 1], ply: bPly } : null,
    });
  }

  if (moves.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', py: 4 }}>
        <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.6 }}>
          No moves played yet
        </Typography>
      </Box>
    );
  }

  const isInteractive = onSelect !== undefined;

  return (
    <Box ref={scrollRef} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, height: '100%', overflowY: 'auto' }}>
      {pairs.map((p, idx) => (
        <Box
          key={p.n}
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.5,
            px: 1.5,
            bgcolor: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
            borderRadius: '4px',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {p.n}.
          </Typography>
          
          {/* White Move */}
          <Typography
            variant="body2"
            sx={{
              minWidth: 80,
              cursor: isInteractive ? 'pointer' : 'default',
              fontWeight: isInteractive && currentPly === p.w.ply ? 800 : (isInteractive ? 600 : 750),
              color: isInteractive && currentPly === p.w.ply ? '#26a69a' : 'text.primary',
              textShadow: isInteractive && currentPly === p.w.ply ? '0 0 8px rgba(38,166,154,0.4)' : 'none',
              bgcolor: isInteractive && currentPly === p.w.ply ? 'rgba(38,166,154,0.12)' : 'transparent',
              px: isInteractive ? 0.75 : 0,
              py: isInteractive ? 0.25 : 0,
              borderRadius: '4px',
              transition: 'all 0.15s ease',
              '&:hover': isInteractive ? { bgcolor: 'rgba(255,255,255,0.05)', color: 'primary.light' } : {},
            }}
            onClick={() => isInteractive && onSelect(p.w.ply)}
          >
            {p.w.san}
          </Typography>
          
          {/* Black Move */}
          {p.b && (
            <Typography
              variant="body2"
              sx={{
                cursor: isInteractive ? 'pointer' : 'default',
                fontWeight: isInteractive && currentPly === p.b.ply ? 800 : (isInteractive ? 500 : 500),
                color: isInteractive && currentPly === p.b.ply ? '#26a69a' : 'text.secondary',
                textShadow: isInteractive && currentPly === p.b.ply ? '0 0 8px rgba(38,166,154,0.4)' : 'none',
                bgcolor: isInteractive && currentPly === p.b.ply ? 'rgba(38,166,154,0.12)' : 'transparent',
                px: isInteractive ? 0.75 : 0,
                py: isInteractive ? 0.25 : 0,
                borderRadius: '4px',
                transition: 'all 0.15s ease',
                '&:hover': isInteractive ? { bgcolor: 'rgba(255,255,255,0.05)', color: 'primary.light' } : {},
              }}
              onClick={() => isInteractive && onSelect(p.b.ply)}
            >
              {p.b.san}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

export default memo(MoveList);
