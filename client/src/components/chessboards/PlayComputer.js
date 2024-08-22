import React, { useMemo, useState, useEffect } from "react";
import { Button, Select, MenuItem, Paper, Box, Grid, Typography } from '@mui/material';
import Chess from "chess.js";
import { Chessboard } from "react-chessboard";
import Engine from "../../utils/Engine";
import MoveHistory from "../MoveHistory";
import GameOverModal from "../GameOverModal";

const PlayComputer = ({ fen }) => {

    const levels = {
        Easy: 2,
        Medium: 8,
        Hard: 18,
    };

    const engine = useMemo(() => new Engine(), []);
    const game = useMemo(() => (fen ? new Chess(fen) : new Chess()), [fen]);
    const [showModal, setShowModal] = useState(false);
    const [gamePosition, setGamePosition] = useState(game.fen());
    const [stockfishLevel, setStockfishLevel] = useState(2);
    const [isBoardFlipped, setIsBoardFlipped] = useState(false);
    const [userColor, setUserColor] = useState("w");

    useEffect(() => {
        function findBestMove() {
            engine.evaluatePosition(game.fen(), stockfishLevel);
            engine.onMessage(({ bestMove }) => {
                if (bestMove) {
                    game.move({
                        from: bestMove.substring(0, 2),
                        to: bestMove.substring(2, 4),
                        promotion: bestMove.substring(4, 5),
                    });
                    setGamePosition(game.fen());
                }
            });
        }
        if (game.turn() !== userColor)  findBestMove();
        if (game.game_over()) {
            if (game.in_checkmate()) {
                setShowModal("Win by Checkmate");
            } else if (game.in_draw()) {
                setShowModal("Draw");
            } else if (game.in_stalemate()) {
                setShowModal("Stalemate");
            } else if (game.in_threefold_repetition()) {
                setShowModal("Threefold Repetition");
            } else if (game.insufficient_material()) {
                setShowModal("Insufficient Material");
            }
        }
    }, [gamePosition, game, userColor, engine, stockfishLevel]);

    function onDrop(sourceSquare, targetSquare, piece) {
        if (game.turn() !== userColor) return false;

        const move = game.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: piece[1].toLowerCase() ?? "q",
        });
        setGamePosition(game.fen());

        if (move === null) return false;
        if (game.game_over() || game.in_draw()) return false;
        return true;
    }


    return (
        <Box sx={{ p: 4, backgroundColor: 'background.default', minHeight: '100vh' }}>
            <GameOverModal show={showModal} onClose={() => setShowModal(false)} />
            <Grid container spacing={4} justifyContent="center">
                <Grid item xs={12} md={8}>
                    <Paper elevation={6} sx={{ p: 4, borderRadius: 4, backgroundColor: 'white' }}>
                        <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            Play Against Computer
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                            {Object.entries(levels).map(([level, depth]) => (
                                <Button
                                    key={level}
                                    variant={depth === stockfishLevel ? "contained" : "outlined"}
                                    color={depth === stockfishLevel ? "primary" : "inherit"}
                                    onClick={() => setStockfishLevel(depth)}
                                    sx={{ mx: 1, px: 3, py: 1 }}
                                >
                                    {level}
                                </Button>
                            ))}
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                            <Box sx={{ width: '100%', maxWidth: '500px' }}>
                                <Chessboard
                                    id="PlayVsStockfish"
                                    position={gamePosition}
                                    onPieceDrop={onDrop}
                                    boardOrientation={isBoardFlipped ? "black" : "white"}
                                    customBoardStyle={{
                                        borderRadius: "8px",
                                        boxShadow: "0 8px 40px rgba(0, 0, 0, 0.12)",
                                    }}
                                />
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Grid container spacing={2} justifyContent="center">
                                <Grid item xs={12} sm={6} md={3}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={() => {
                                            game.reset();
                                            setGamePosition(game.fen());
                                        }}
                                        fullWidth
                                        sx={{ py: 1.5 }}
                                    >
                                        New game
                                    </Button>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        onClick={() => {
                                            game.undo();
                                            game.undo();
                                            setGamePosition(game.fen());
                                        }}
                                        fullWidth
                                        sx={{ py: 1.5 }}
                                    >
                                        Undo
                                    </Button>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={() => setIsBoardFlipped(!isBoardFlipped)}
                                        fullWidth
                                        sx={{ py: 1.5 }}
                                    >
                                        Flip Board
                                    </Button>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Select
                                        value={userColor}
                                        onChange={(e) => setUserColor(e.target.value)}
                                        variant="outlined"
                                        fullWidth
                                        sx={{ 
                                            height: '100%',
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderWidth: 2,
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderWidth: 2,
                                            },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderWidth: 2,
                                            }
                                        }}
                                    >
                                        <MenuItem value="w">Play as White</MenuItem>
                                        <MenuItem value="b">Play as Black</MenuItem>
                                    </Select>
                                </Grid>
                            </Grid>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                <MoveHistory pgn={game.pgn()} />
                </Grid>
            </Grid>
        </Box>
    );
};

export default PlayComputer;
