import { Box } from '@mui/material';
import { Chessboard } from 'react-chessboard';

export default function GameBoard({
  position,
  boardOrientation = 'white',
  onSquareClick,
  onPieceDrop,
  squareStyles = {},
  arePiecesDraggable = false,
  animationDurationInMs = 150,
  allowDrawingArrows = false,
  arrows = [],
  onArrowsChange,
}) {
  return (
    <Box 
      sx={{ 
        width: '100%', 
        maxWidth: 560, 
        aspectRatio: '1 / 1',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
        border: '4px solid #1e1c19',
      }}
    >
      <Chessboard
        options={{
          position,
          boardOrientation,
          onSquareClick,
          onPieceDrop,
          squareStyles,
          allowDragging: arePiecesDraggable,
          arePiecesDraggable,
          allowDrawingArrows,
          arrows,
          onArrowsChange: onArrowsChange ? ({ arrows: a }) => onArrowsChange(a) : undefined,
          animationDurationInMs,
          customDarkSquareStyle: { backgroundColor: '#769656' },
          customLightSquareStyle: { backgroundColor: '#eeeed2' },
        }}
      />
    </Box>
  );
}
