import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import Chess from "chess.js";
import Engine from "../../utils/Engine";
import MoveHistory from "../MoveHistory";
import { Box, Typography, TextField, Button, Paper, Grid } from "@mui/material";

function AnalysisBoard({ fen }) {
    const engine = useMemo(() => new Engine(), []);
    const game = useMemo(() => (fen ? new Chess(fen) : new Chess()), [fen]);
    const inputRef = useRef(null);
    const [chessBoardPosition, setChessBoardPosition] = useState(game.fen());
    const [positionEvaluation, setPositionEvaluation] = useState(0);
    const [depth, setDepth] = useState(10);
    const [bestLine, setBestline] = useState("");
    const [possibleMate, setPossibleMate] = useState("");

    const findBestMove = useCallback(() => {
        engine.evaluatePosition(chessBoardPosition, 18);
        engine.onMessage(({ positionEvaluation, possibleMate, pv, depth }) => {
            if (depth && depth < 10) return;
            positionEvaluation &&
                setPositionEvaluation(
                    ((game.turn() === "w" ? 1 : -1) *
                        Number(positionEvaluation)) / 100
                );
            possibleMate && setPossibleMate(possibleMate);
            depth && setDepth(depth);
            pv && setBestline(pv);
        });
    }, [chessBoardPosition, engine, game]);

    function onDrop(sourceSquare, targetSquare, piece) {
        const move = game.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: piece[1].toLowerCase() ?? "q",
        });
        setPossibleMate("");
        setChessBoardPosition(game.fen());

        // illegal move
        if (move === null) return false;
        engine.stop();
        setBestline("");
        if (game.game_over() || game.in_draw()) return false;
        return true;
    }

    useEffect(() => {
        if (!game.game_over() || game.in_draw()) {
            findBestMove();
        }
    }, [chessBoardPosition, findBestMove, game]);

    const bestMove = bestLine?.split(" ")?.[0];

    const handleFenInputChange = (e) => {
        const { valid } = game.validate_fen(e.target.value);
        if (valid && inputRef.current) {
            inputRef.current.value = e.target.value;
            game.load(e.target.value);
            setChessBoardPosition(game.fen());
        }
    };

    return (
        <Box p={4}>
            <Grid container spacing={4}>
                <Grid item xs={12} md={8}>
                    <Paper elevation={3} sx={{ p: 4 }}>
                        {!game.game_over() ? (
                            <Box sx={{ height: { xs: '120px', sm: '100px', md: '80px' } }}>
                                <Typography variant="h6" gutterBottom>
                                    Position Evaluation: {possibleMate ? `#${possibleMate}` : positionEvaluation}; Depth: {depth}
                                </Typography>
                                <Typography variant="subtitle1" gutterBottom>
                                    Best line: <i>{bestLine.slice(0, 40)}</i> ...
                                </Typography>
                            </Box>
                        ) : (
                            <Typography variant="h6" gutterBottom>Game Over</Typography>
                        )}
                        <TextField
                            inputRef={inputRef}
                            fullWidth
                            variant="outlined"
                            margin="normal"
                            onChange={handleFenInputChange}
                            placeholder="Paste FEN to start analysing custom position"
                        />
                        <Box display="flex" justifyContent="center" alignItems="center" width="100%">
                            <Box width="100%" maxWidth={{ xs: "300px", md: "400px", lg: "500px" }}>
                                <Chessboard
                                    id="AnalysisBoard"
                                    position={chessBoardPosition}
                                    onPieceDrop={onDrop}
                                    customBoardStyle={{
                                        borderRadius: "4px",
                                        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
                                    }}
                                    customArrows={
                                        bestMove
                                            ? [
                                                    [
                                                        bestMove.substring(0, 2),
                                                        bestMove.substring(2, 4),
                                                        "rgb(0, 128, 0)",
                                                    ],
                                            ]
                                            : undefined
                                    }
                                    customDarkSquareStyle={{
                                        backgroundColor: "#3a6b7a"
                                    }}
                                    customLightSquareStyle={{
                                        backgroundColor: "#a5c3cc"
                                    }}
                                />
                            </Box>
                        </Box>
                        <Box mt={4} display="flex" gap={2} justifyContent="center">
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    setPossibleMate("");
                                    setBestline("");
                                    game.reset();
                                    setChessBoardPosition(game.fen());
                                }}
                            >
                                Reset
                            </Button>
                            <Button
                                variant="contained"
                                color="secondary"
                                onClick={() => {
                                    setPossibleMate("");
                                    setBestline("");
                                    game.undo();
                                    setChessBoardPosition(game.fen());
                                }}
                            >
                                Undo
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <MoveHistory pgn={game.pgn()} />
                </Grid>
            </Grid>
        </Box>
    );
}

export default AnalysisBoard;