import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import {
  Box, Paper, Typography, Button, Divider, TextField, IconButton,
  Alert, Tooltip,
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
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1 }}>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: { xs: 150, sm: 200 }, minHeight: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5 }}>Chat</Typography>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {messages.map((m, i) => (
          <Box key={i} sx={{ mb: 0.5 }}>
            <Typography component="span" variant="caption" color="primary.main">{m.user}: </Typography>
            <Typography component="span" variant="caption" sx={{ wordBreak: 'break-word' }}>{m.text}</Typography>
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
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [opponentUsername, setOpponentUsername] = useState('Opponent');

  const actionCounter = useRef(0);
  const chessRef = useRef(new Chess());
  const { whiteMs, blackMs, sync } = useClock();

  function clearMoveSelection() {
    setMoveFrom('');
    setOptionSquares({});
  }

  function isMyPiece(square) {
    const piece = chessRef.current.get(square);
    return Boolean(piece && piece.color === (myColor === 'white' ? 'w' : 'b'));
  }

  const handleMessage = useCallback((msg) => {
    switch (msg.t) {
      case 'init': {
        setWsStatus('connected');
        setMyColor(msg.d.color);
        const oppName = msg.d.color === 'white' ? (msg.d.blackUsername ?? 'Opponent') : (msg.d.whiteUsername ?? 'Opponent');
        setOpponentUsername(oppName);
        if (msg.d.fen) {
          setFen(msg.d.fen);
          chessRef.current.load(msg.d.fen);
        }
        setMoveFrom('');
        setOptionSquares({});
        setDrawOffered(false);
        setOpponentDrawOffer(false);
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
        setMoveFrom('');
        setOptionSquares({});
        setDrawOffered(false);
        setOpponentDrawOffer(false);
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
        if (msg.d.from !== userId) {
          setChatMessages((prev) => [...prev, { user: msg.d.color, text: msg.d.msg }]);
        }
        break;
      }
      case 'draw': {
        if (msg.d.action === 'offer') {
          const offeredByMe = msg.d.by === myColor;
          setDrawOffered(offeredByMe);
          setOpponentDrawOffer(!offeredByMe);
        } else if (msg.d.action === 'declined' || msg.d.action === 'decline') {
          setDrawOffered(false);
          setOpponentDrawOffer(false);
        }
        break;
      }
      case 'end': {
        setGameOver(msg.d);
        setMoveFrom('');
        setOptionSquares({});
        setDrawOffered(false);
        setOpponentDrawOffer(false);
        sync(msg.d.clock ?? { white: 0, black: 0 }, null);
        break;
      }
      case '_connecting': {
        setWsStatus('connecting');
        break;
      }
      case '_open': {
        setWsStatus('connected');
        break;
      }
      case '_error':
      case '_close': {
        setWsStatus('disconnected');
        break;
      }
    }
  }, [myColor, sync, userId]);

  const { send } = useGameSocket(gameId, token, handleMessage);

  function getMoveOptions(square) {
    const moves = chessRef.current.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares = {};
    for (const move of moves) {
      const target = chessRef.current.get(move.to);
      const source = chessRef.current.get(square);
      newSquares[move.to] = {
        background: target && target.color !== source?.color
          ? 'radial-gradient(circle, rgba(10,113,88,0.4) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(10,113,88,0.4) 25%, transparent 25%)',
        borderRadius: '50%',
      };
    }

    newSquares[square] = { backgroundColor: 'rgba(10, 113, 88, 0.6)' };
    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick({ square }) {
    if (!myColor || activeColor !== myColor) return;
    const chess = chessRef.current;

    // No piece selected yet
    if (!moveFrom) {
      if (isMyPiece(square)) {
        const hasMoveOptions = getMoveOptions(square);
        if (hasMoveOptions) {
          setMoveFrom(square);
        }
      }
      return;
    }

    // Check if it's a valid move
    const moves = chess.moves({ square: moveFrom, verbose: true });
    const foundMove = moves.find(m => m.to === square);

    if (!foundMove) {
      // Invalid move, check if clicking new piece
      if (isMyPiece(square)) {
        const hasMoveOptions = getMoveOptions(square);
        setMoveFrom(hasMoveOptions ? square : '');
      } else {
        clearMoveSelection();
      }
      return;
    }

    // Valid move found
    const isPromotion = chess.get(moveFrom).type === 'p' &&
      ((chess.get(moveFrom).color === 'w' && square[1] === '8') ||
       (chess.get(moveFrom).color === 'b' && square[1] === '1'));

    try {
      chess.move({ from: moveFrom, to: square, promotion: 'q' });
      setFen(chess.fen());
      setSanMoves((prev) => [...prev, foundMove.san]);

      const uci = `${moveFrom}${square}${isPromotion ? 'q' : ''}`;
      send({ t: 'move', d: { u: uci, a: ++actionCounter.current } });

      clearMoveSelection();
    } catch {
      // Move failed, try selecting the clicked square as new piece
      if (isMyPiece(square)) {
        const hasMoveOptions = getMoveOptions(square);
        setMoveFrom(hasMoveOptions ? square : '');
      } else {
        clearMoveSelection();
      }
    }
  }

  function onPieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare || !myColor || activeColor !== myColor) return false;

    const chess = chessRef.current;
    const isPromotion = chess.get(sourceSquare).type === 'p' &&
      ((chess.get(sourceSquare).color === 'w' && targetSquare[1] === '8') ||
       (chess.get(sourceSquare).color === 'b' && targetSquare[1] === '1'));

    try {
      const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      setFen(chess.fen());
      setSanMoves((prev) => [...prev, move.san]);

      const uci = `${sourceSquare}${targetSquare}${isPromotion ? 'q' : ''}`;
      send({ t: 'move', d: { u: uci, a: ++actionCounter.current } });

      clearMoveSelection();
      return true;
    } catch {
      return false;
    }
  }

  const isMyTurn = activeColor === myColor;
  const opponentColor = myColor === 'white' ? 'black' : 'white';
  const myMs = myColor === 'white' ? whiteMs : blackMs;
  const opponentMs = myColor === 'white' ? blackMs : whiteMs;
  const hasPendingDrawOffer = drawOffered || opponentDrawOffer;

  const chessboardOptions = {
    position: fen,
    onSquareClick,
    onPieceDrop,
    boardOrientation: myColor ?? 'white',
    squareStyles: optionSquares,
    animationDurationInMs: 100,
    arePiecesDraggable: isMyTurn && !gameOver,
  };

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
    send({ t: 'draw', d: { action: 'decline' } });
  }

  function handleChatSend(text) {
    send({ t: 'chat', d: { text } });
    setChatMessages((prev) => [...prev, { user: username, text }]);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        justifyContent: 'center',
        alignItems: { xs: 'center', lg: 'flex-start' },
        gap: { xs: 1.5, sm: 2 },
        p: { xs: 1, sm: 2 },
        minHeight: '90vh',
        width: '100%',
        overflowX: 'hidden',
      }}
    >
      {/* Board column */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          width: '100%',
          maxWidth: 560,
          flexShrink: 0,
        }}
      >
        {/* Opponent info + clock */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography variant="body1" fontWeight={600} color="text.secondary" noWrap sx={{ minWidth: 0 }}>
            {opponentUsername} ({opponentColor})
          </Typography>
          <ClockDisplay ms={opponentMs} active={!isMyTurn && !gameOver} color={opponentColor} />
        </Box>

        {/* Chessboard */}
        <Box sx={{ width: '100%', maxWidth: 560, aspectRatio: '1 / 1' }}>
          <Chessboard options={chessboardOptions} />
        </Box>

        {/* My info + clock */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography variant="body1" fontWeight={600} noWrap sx={{ minWidth: 0 }}>
            {username} ({myColor ?? '…'})
          </Typography>
          <ClockDisplay ms={myMs} active={isMyTurn && !gameOver} color={myColor ?? '…'} />
        </Box>
      </Box>

      {/* Sidebar */}
      <Paper
        sx={{
          width: '100%',
          maxWidth: { xs: 560, lg: 300 },
          display: 'flex',
          flexDirection: 'column',
          height: { xs: 'min(52vh, 420px)', sm: 460, lg: 600 },
          minHeight: { xs: 320, sm: 380 },
          p: 0,
          overflow: 'hidden',
        }}
      >
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
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1 }}>
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
            <Tooltip title={opponentDrawOffer ? 'Respond to draw offer' : drawOffered ? 'Draw offered' : 'Offer draw'}>
              <span>
                <IconButton size="small" onClick={handleDrawOffer} disabled={hasPendingDrawOffer}>
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
