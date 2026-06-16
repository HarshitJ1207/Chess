import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import {
  Box, Paper, Typography, Button, Divider, TextField, IconButton, Alert
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import FlagIcon from '@mui/icons-material/Flag';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { useAuthStore } from '../store';
import { useGameSocket } from '../hooks/useGameSocket';
import { useClock } from '../hooks/useClock';
import ClockDisplay from '../components/ClockDisplay';
import GameBoard from '../components/GameBoard';
import PlayerCard from '../components/PlayerCard';
import MoveList from '../components/MoveList';
import { api } from '../api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function formatTerminationReason(termination) {
  if (!termination) return '';
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

function Chat({ messages, onSend, myUsername }) {
  const [text, setText] = useState('');
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: { xs: 260, sm: 280 }, minHeight: 0, bgcolor: 'rgba(0,0,0,0.12)' }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.75, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.65rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        Live Chat
      </Typography>
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {messages.length === 0 ? (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic', display: 'block', textAlign: 'center', mt: 2 }}>
            No messages yet. Send a friendly greeting!
          </Typography>
        ) : (
          messages.map((m, i) => {
            const isMe = m.user === myUsername;
            return (
              <Box key={i} sx={{ mb: 0.75, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.25 }}>
                  <Typography variant="caption" fontWeight={700} sx={{ color: isMe ? 'primary.main' : 'secondary.main', fontSize: '0.7rem' }}>
                    {m.user}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: isMe ? 'rgba(10, 113, 88, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid',
                    borderColor: isMe ? 'rgba(10, 113, 88, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                    borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    px: 1.5,
                    py: 0.75,
                    maxWidth: '85%',
                  }}
                >
                  <Typography variant="body2" sx={{ wordBreak: 'break-word', fontSize: '0.8rem', color: 'text.primary' }}>
                    {m.text}
                  </Typography>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
      <Box sx={{ display: 'flex', gap: 1, p: 1, bgcolor: 'background.paper' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Send a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          inputProps={{ maxLength: 200 }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(0,0,0,0.15)',
              borderRadius: '8px',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
              '&:hover fieldset': { borderColor: 'primary.main' },
            }
          }}
        />
        <IconButton size="small" onClick={handleSend} color="primary" sx={{ bgcolor: 'rgba(10, 113, 88, 0.15)', borderRadius: '8px', '&:hover': { bgcolor: 'primary.main', color: '#fff' } }}>
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

export default function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { token, username } = useAuthStore();

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

  const [myRating, setMyRating] = useState(null);
  const [opponentRating, setOpponentRating] = useState(null);

  const actionCounter = useRef(0);
  const chessRef = useRef(new Chess());
  const { whiteMs, blackMs, sync } = useClock();

  // Fetch Glicko ratings
  useEffect(() => {
    if (username && token) {
      api.getRating(username, token)
        .then(r => setMyRating(Math.round(r.rating)))
        .catch(() => setMyRating(1500));
    }
  }, [username, token]);

  useEffect(() => {
    if (opponentUsername && opponentUsername !== 'Opponent' && token) {
      api.getRating(opponentUsername, token)
        .then(r => setOpponentRating(Math.round(r.rating)))
        .catch(() => setOpponentRating(1500));
    }
  }, [opponentUsername, token]);

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
          setSanMoves((prev) => {
            if (prev.length >= d.ply) return prev;
            return [...prev, san];
          });
        }
        break;
      }
      case 'chat': {
        if (msg.d.from !== username) {
          setChatMessages((prev) => [...prev, { user: msg.d.from, text: msg.d.msg }]);
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
  }, [myColor, sync, username]);

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
        gap: { xs: 2.5, sm: 3, lg: 4 },
        p: { xs: 1.5, sm: 3 },
        minHeight: '90vh',
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Board Column */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
          maxWidth: 560,
          flexShrink: 0,
        }}
      >
        {/* Opponent Profile Card */}
        <PlayerCard
          username={opponentUsername}
          rating={opponentRating ?? 1500}
          active={activeColor === opponentColor && !gameOver}
          rightElement={
            <ClockDisplay ms={opponentMs} active={activeColor === opponentColor && !gameOver} color={opponentColor} />
          }
        />

        {/* Chessboard container */}
        <GameBoard
          position={fen}
          boardOrientation={myColor ?? 'white'}
          onSquareClick={onSquareClick}
          onPieceDrop={onPieceDrop}
          squareStyles={optionSquares}
          arePiecesDraggable={isMyTurn && !gameOver}
          animationDurationInMs={100}
        />

        {/* My Profile Card */}
        <PlayerCard
          username={username}
          rating={myRating ?? 1500}
          active={activeColor === myColor && !gameOver}
          rightElement={
            <ClockDisplay ms={myMs} active={activeColor === myColor && !gameOver} color={myColor ?? '...'} />
          }
        />
      </Box>

      {/* Sidebar Game Panel */}
      <Paper
        elevation={4}
        sx={{
          width: '100%',
          maxWidth: { xs: 560, lg: 320 },
          display: 'flex',
          flexDirection: 'column',
          height: { xs: 'auto', lg: 664 },
          bgcolor: 'rgba(30, 28, 25, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Connection/Turn/Outcome Status Bar */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(0,0,0,0.1)' }}>
          {wsStatus === 'disconnected' && (
            <Alert severity="error" variant="filled" sx={{ py: 0.5, borderRadius: '8px', fontSize: '0.85rem', mb: 1 }}>
              Connection lost
            </Alert>
          )}
          
          {gameOver ? (
            <Box sx={{ textAlign: 'center', py: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={800} color="primary.main" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {gameOver.result === '1-0' ? 'White Wins' :
                 gameOver.result === '0-1' ? 'Black Wins' : 'Draw'}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {formatTerminationReason(gameOver.termination)}
              </Typography>
            </Box>
          ) : opponentDrawOffer ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 0.5 }}>
              <Typography variant="body2" fontWeight={700} textAlign="center" color="warning.main">
                Draw Offered by Opponent
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button size="small" variant="contained" color="primary" onClick={handleDrawAccept} sx={{ flex: 1, borderRadius: '6px', textTransform: 'none' }}>
                  Accept
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={handleDrawDecline} sx={{ flex: 1, borderRadius: '6px', textTransform: 'none' }}>
                  Decline
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: isMyTurn ? 'primary.main' : 'text.disabled',
                    boxShadow: isMyTurn ? '0 0 8px rgba(10, 113, 88, 0.8)' : 'none',
                    animation: isMyTurn ? 'pulse-turn 1.5s infinite alternate' : 'none',
                    '@keyframes pulse-turn': {
                      '0%': { opacity: 0.6 },
                      '100%': { opacity: 1 }
                    }
                  }}
                />
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: isMyTurn ? 'primary.light' : 'text.secondary' }}>
                  {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                Live Match
              </Typography>
            </Box>
          )}
        </Box>

        {/* Moves notation section */}
        <Box sx={{ flex: 1, minHeight: { xs: 120, lg: 0 }, overflowY: 'auto', p: 1.5, bgcolor: 'rgba(0,0,0,0.15)' }}>
          <MoveList moves={sanMoves} />
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

        {/* Live Chat component */}
        <Chat messages={chatMessages} onSend={handleChatSend} myUsername={username} />

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

        {/* Controls footer */}
        {!gameOver && (
          <Box sx={{ display: 'flex', gap: 1, p: 1.5, bgcolor: 'background.paper' }}>
            <Button
              variant="outlined"
              color="error"
              size="medium"
              onClick={handleResign}
              startIcon={<FlagIcon />}
              sx={{ flex: 1, borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
            >
              Resign
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="medium"
              onClick={handleDrawOffer}
              disabled={hasPendingDrawOffer}
              startIcon={<HandshakeIcon />}
              sx={{
                flex: 1,
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 700,
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'text.secondary',
                '&:hover': { borderColor: 'text.primary', bgcolor: 'rgba(255,255,255,0.05)' }
              }}
            >
              {drawOffered ? 'Draw Offered' : 'Offer Draw'}
            </Button>
          </Box>
        )}
        
        {gameOver && (
          <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, bgcolor: 'background.paper' }}>
            <Button
              size="medium"
              variant="contained"
              color="primary"
              onClick={() => navigate('/queue')}
              sx={{ flex: 1, borderRadius: '8px', fontWeight: 700, textTransform: 'none' }}
            >
              Play again
            </Button>
            <Button
              size="medium"
              variant="outlined"
              color="inherit"
              onClick={() => navigate(`/replay/${gameId}`)}
              sx={{ flex: 1, borderRadius: '8px', fontWeight: 700, textTransform: 'none', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              Review Game
            </Button>
          </Box>
        )}
        
        {/* Back to Dashboard link */}
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', bgcolor: 'background.paper', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
          <Button 
            size="small" 
            variant="text" 
            onClick={() => navigate('/')} 
            sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.75rem', fontWeight: 500, '&:hover': { color: 'text.primary', bgcolor: 'transparent' } }}
          >
            Leave Match Table
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
