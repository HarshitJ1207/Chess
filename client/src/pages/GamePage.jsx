import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import {
  Box, Paper, Typography, Button, Divider, TextField, IconButton,
  List, ListItem, Chip, Alert, Tooltip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import FlagIcon from '@mui/icons-material/Flag';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { useAuthStore } from '../store';
import { useGameSocket } from '../hooks/useGameSocket';
import { useClock } from '../hooks/useClock';
import ClockDisplay from '../components/ClockDisplay';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function MoveList({ moves }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [moves]);

  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
      {pairs.map((p) => (
        <Box key={p.n} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 28 }}>{p.n}.</Typography>
          <Typography variant="body2" sx={{ minWidth: 52 }}>{p.w}</Typography>
          <Typography variant="body2" color="text.secondary">{p.b ?? ''}</Typography>
        </Box>
      ))}
      <div ref={endRef} />
    </Box>
  );
}

function Chat({ messages, onSend }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 200 }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5 }}>Chat</Typography>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {messages.map((m, i) => (
          <Box key={i} sx={{ mb: 0.5 }}>
            <Typography component="span" variant="caption" color="primary.main">{m.user}: </Typography>
            <Typography component="span" variant="caption">{m.text}</Typography>
          </Box>
        ))}
        <div ref={endRef} />
      </Box>
      <Divider />
      <Box sx={{ display: 'flex', gap: 1, p: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          inputProps={{ maxLength: 200 }}
        />
        <IconButton size="small" onClick={handleSend} color="primary"><SendIcon fontSize="small" /></IconButton>
      </Box>
    </Box>
  );
}

export default function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { token, userId, username } = useAuthStore();

  const [fen, setFen] = useState(START_FEN);
  const [myColor, setMyColor] = useState(null); // 'white' | 'black'
  const [activeColor, setActiveColor] = useState('white');
  const [sanMoves, setSanMoves] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [gameOver, setGameOver] = useState(null); // { result, termination, winner }
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting | connected | disconnected
  const [drawOffered, setDrawOffered] = useState(false);
  const [opponentDrawOffer, setOpponentDrawOffer] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalSquares, setLegalSquares] = useState([]);

  const actionCounter = useRef(0);
  const chessRef = useRef(new Chess());
  const { whiteMs, blackMs, sync } = useClock();

  const handleMessage = useCallback((msg) => {
    switch (msg.t) {
      case 'init': {
        setWsStatus('connected');
        setMyColor(msg.d.color);
        if (msg.d.fen) {
          setFen(msg.d.fen);
          chessRef.current.load(msg.d.fen);
        }
        if (msg.d.clock) {
          sync(msg.d.clock, msg.d.turn ?? 'white');
          setActiveColor(msg.d.turn ?? 'white');
        }
        if (msg.d.moves) setSanMoves(msg.d.moves.map(m => (typeof m === 'string' ? m : (m?.san ?? m?.uci ?? JSON.stringify(m)))));
        break;
      }
      case 'move': {
        const d = msg.d;
        chessRef.current.load(d.fen);
        setFen(d.fen);
        setSelectedSquare(null);
        setLegalSquares([]);
        const nextActive = d.ply % 2 === 0 ? 'white' : 'black';
        setActiveColor(nextActive);
        if (d.clock) sync(d.clock, nextActive);
        if (d.san) {
          const san = typeof d.san === 'string' ? d.san : (d.san?.san ?? d.san?.uci ?? JSON.stringify(d.san));
          setSanMoves((prev) => [...prev, san]);
        }
        break;
      }
      case 'chat': {
        setChatMessages((prev) => [...prev, { user: msg.d.color, text: msg.d.msg }]);
        break;
      }
      case 'draw': {
        if (msg.d.action === 'offer') {
          setOpponentDrawOffer(true);
        } else if (msg.d.action === 'declined') {
          setDrawOffered(false);
        }
        break;
      }
      case 'end': {
        setGameOver(msg.d);
        sync(msg.d.clock ?? { white: 0, black: 0 }, null);
        break;
      }
      case '_error':
      case '_close': {
        setWsStatus('disconnected');
        break;
      }
    }
  }, [sync]);

  const { send } = useGameSocket(gameId, token, handleMessage);

  function handlePieceDrop({ sourceSquare, targetSquare, piece }) {
    if (!myColor || activeColor !== myColor) return false;
    return attemptMove(sourceSquare, targetSquare);
  }

  function attemptMove(from, to) {
    const chess = chessRef.current;
    const piece = chess.get(from);
    if (!piece) return false;

    // Check promotion
    const isPromotion = piece.type === 'p' &&
      ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

    const uci = `${from}${to}${isPromotion ? 'q' : ''}`;
    const move = chess.move({ from, to, promotion: isPromotion ? 'q' : undefined });
    if (!move) return false;

    // Optimistic local update
    setFen(chess.fen());
    setSanMoves((prev) => [...prev, move.san]);
    setSelectedSquare(null);
    setLegalSquares([]);

    send({ t: 'move', d: { u: uci, a: ++actionCounter.current } });
    return true;
  }

  function handleSquareClick({ square, piece }) {
    if (!myColor || activeColor !== myColor) return;
    const chess = chessRef.current;

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null);
        setLegalSquares([]);
        return;
      }
      // Try to move
      const moved = attemptMove(selectedSquare, square);
      if (!moved) {
        // Maybe selecting a new piece
        const p = chess.get(square);
        if (p && p.color === (myColor === 'white' ? 'w' : 'b')) {
          selectSquare(square);
        } else {
          setSelectedSquare(null);
          setLegalSquares([]);
        }
      }
    } else {
      const p = chess.get(square);
      if (p && p.color === (myColor === 'white' ? 'w' : 'b')) {
        selectSquare(square);
      }
    }
  }

  function selectSquare(square) {
    setSelectedSquare(square);
    const moves = chessRef.current.moves({ square, verbose: true });
    setLegalSquares(moves.map((m) => m.to));
  }

  function buildSquareStyles() {
    const styles = {};
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(10, 113, 88, 0.5)' };
    }
    legalSquares.forEach((sq) => {
      styles[sq] = {
        background: 'radial-gradient(circle, rgba(10,113,88,0.5) 25%, transparent 25%)',
      };
    });
    return styles;
  }

  function handleResign() {
    send({ t: 'resign' });
  }

  function handleDrawOffer() {
    setDrawOffered(true);
    send({ t: 'draw', d: { action: 'offer' } });
  }

  function handleDrawAccept() {
    setOpponentDrawOffer(false);
    send({ t: 'draw', d: { action: 'accept' } });
  }

  function handleDrawDecline() {
    setOpponentDrawOffer(false);
    send({ t: 'draw', d: { action: 'declined' } });
  }

  function handleChatSend(text) {
    send({ t: 'chat', d: { text } });
    setChatMessages((prev) => [...prev, { user: username, text }]);
  }

  const opponentColor = myColor === 'white' ? 'black' : 'white';
  const myMs = myColor === 'white' ? whiteMs : blackMs;
  const opponentMs = myColor === 'white' ? blackMs : whiteMs;
  const isMyTurn = activeColor === myColor;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 2, p: 2, minHeight: '90vh' }}>
      {/* Board column */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Opponent info + clock */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body1" fontWeight={600} color="text.secondary">
            Opponent ({opponentColor})
          </Typography>
          <ClockDisplay ms={opponentMs} active={!isMyTurn && !gameOver} color={opponentColor} />
        </Box>

        {/* Chessboard */}
        <Box sx={{ width: { xs: 320, sm: 480, md: 560 } }}>
          <Chessboard
            options={{
              position: fen,
              boardOrientation: myColor ?? 'white',
              animationDurationInMs: 100,
              allowDragging: isMyTurn && !gameOver,
              canDragPiece: ({ piece }) => {
                if (!myColor || !isMyTurn || gameOver) return false;
                const pieceColor = piece[0] === 'w' ? 'white' : 'black';
                return pieceColor === myColor;
              },
              onPieceDrop: handlePieceDrop,
              onSquareClick: handleSquareClick,
              squareStyles: buildSquareStyles(),
              allowDrawingArrows: true,
            }}
          />
        </Box>

        {/* My info + clock */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body1" fontWeight={600}>
            {username} ({myColor ?? '…'})
          </Typography>
          <ClockDisplay ms={myMs} active={isMyTurn && !gameOver} color={myColor ?? '…'} />
        </Box>
      </Box>

      {/* Sidebar */}
      <Paper sx={{ width: 260, display: 'flex', flexDirection: 'column', height: 600, p: 0, overflow: 'hidden' }}>
        {/* Status bar */}
        <Box sx={{ px: 2, py: 1, bgcolor: wsStatus === 'disconnected' ? 'error.dark' : 'background.paper' }}>
          {wsStatus === 'disconnected' && (
            <Alert severity="error" sx={{ py: 0 }}>Connection lost</Alert>
          )}
          {gameOver && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {gameOver.result === '1-0' ? 'White wins' :
                 gameOver.result === '0-1' ? 'Black wins' : 'Draw'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {gameOver.termination}
              </Typography>
            </Box>
          )}
          {opponentDrawOffer && !gameOver && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption">Draw offered</Typography>
              <Button size="small" variant="contained" onClick={handleDrawAccept}>Accept</Button>
              <Button size="small" variant="outlined" onClick={handleDrawDecline}>Decline</Button>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Move list */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          <MoveList moves={sanMoves} />
        </Box>

        <Divider />

        {/* Chat */}
        <Chat messages={chatMessages} onSend={handleChatSend} />

        <Divider />

        {/* Controls */}
        {!gameOver && (
          <Box sx={{ display: 'flex', gap: 1, p: 1 }}>
            <Tooltip title="Resign">
              <IconButton size="small" color="error" onClick={handleResign}>
                <FlagIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={drawOffered ? 'Draw offered' : 'Offer draw'}>
              <span>
                <IconButton size="small" onClick={handleDrawOffer} disabled={drawOffered}>
                  <HandshakeIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="outlined" onClick={() => navigate('/')}>
              Home
            </Button>
          </Box>
        )}
        {gameOver && (
          <Box sx={{ display: 'flex', gap: 1, p: 1 }}>
            <Button size="small" variant="contained" onClick={() => navigate('/queue')} sx={{ flex: 1 }}>
              Play again
            </Button>
            <Button size="small" variant="outlined" onClick={() => navigate(`/replay/${gameId}`)}>
              Review
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
