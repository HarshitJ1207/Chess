import React, { useEffect, useState, useRef, useCallback } from "react";
import Chess from "chess.js";
import { Chessboard } from "react-chessboard";
import MoveHistory from "../MoveHistory";
import { useSocket } from "../../context/SocketContext";
import Timer from "../Timer"; 
import PlayerInfoCard from "../PlayerInfoCard";
import { useParams } from "react-router-dom";
import GameOverModal from "../GameOverModal";
import { Container, Grid, Paper, Box, Divider } from '@mui/material';

export default function ChessBoard() {
    const { roomId } = useParams();
    const socket = useSocket();
    const [firstLoad, setFirstLoad] = useState(true);
    const [game, setGame] = useState(new Chess());
    const [userColor, setUserColor] = useState(null);
    const [opponentInfo, setOpponentInfo] = useState({username: "Opponent", rating: 1000});
    const [userInfo, setUserInfo] = useState({username: "You", rating: 1000});
    const [timeIncrement, setTimeIncrement] = useState(0);
    const [userTime, setUserTime] = useState(100.0);
    const [opponentTime, setOpponentTime] = useState(100.0);
    const [showModal, setShowModal] = useState(false);
    const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
    const [isGameOver, setIsGameOver] = useState(false); // New state to track game over
    const intervalRef = useRef(null);

    const isUserTurn = useCallback(() => {
        return (game.turn()[0] === "w" && userColor === 1) || (game.turn()[0] === "b" && userColor === 0);
    }, [game, userColor]);

    function safeGameMutate(modify) {
        setGame(g => {
            const update = { ...g };
            modify(update);
            return update;
        });
    }

    function onDrop(sourceSquare, targetSquare, piece) {
        if (isGameOver) return false; // Prevent moves if game is over
        const gameCopy = { ...game };
        const moveValid = gameCopy.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: piece[1].toLowerCase() ?? "q"
        });
        if (!moveValid) return false;
        const move = {
            from: sourceSquare,
            to: targetSquare,
            promotion: piece[1].toLowerCase() ?? "q"
        }
        safeGameMutate(game => {game.move(move)});
        const moveData = { sourceSquare, targetSquare, piece };
        socket.emit("move", { moveData, roomId });
        setUserTime(time => time + timeIncrement);
        setLastUpdateTime(Date.now());
        return true;
    }

    useEffect(() => {
        socket.on("get-game-data", (data) => {
            setUserColor(data.color);
            setOpponentInfo(data.opponentInfo);
            setUserInfo(data.userInfo);
            setTimeIncrement(+data.timeControl.increment);
            setUserTime(+data.timeControl.init * 60);
            setOpponentTime(+data.timeControl.init * 60);
            if (data.moveHistory.length > 0) {
                data.moveHistory.forEach(move => {
                    safeGameMutate(game => {
                        game.move(move);
                    });
                });
            }
        });

        socket.on('move', (moveData) => {
            const move = {
                from: moveData.sourceSquare,
                to: moveData.targetSquare,
                promotion: moveData.piece[1].toLowerCase() ?? "q",
            };
            safeGameMutate(game => {game.move(move)});
            setOpponentTime(time => time + timeIncrement);
            setLastUpdateTime(Date.now());
        });

        const token = localStorage.getItem('token');
        if(firstLoad) {
            socket.emit("get-game-data", {token, roomId});
            setFirstLoad(false);
        }

        return () => {
            socket.off("get-game-data");
            socket.off('move');
            clearInterval(intervalRef.current);
            const currentTime = Date.now();
            const elapsedTime = (currentTime - lastUpdateTime) / 1000;
            const updatedUserTime = userTime - (isUserTurn() ? elapsedTime : 0);
            const updatedOpponentTime = opponentTime - (!isUserTurn() ? elapsedTime : 0);
            socket.emit("update-timer", {
                roomId,
                userTime: updatedUserTime,
                opponentTime: updatedOpponentTime,
                lastUpdateTime: currentTime
            });
        };
    }, [roomId, socket, timeIncrement, firstLoad, game, userTime, opponentTime, lastUpdateTime, isUserTurn]);

    useEffect(() => {
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
            setIsGameOver(true); // Set game over state
            clearInterval(intervalRef.current); // Stop the timer
        }
    }, [game]);

    useEffect(() => {
        if (!firstLoad && !isGameOver) {
            intervalRef.current = setInterval(() => {
                const currentTime = Date.now();
                const elapsedTime = (currentTime - lastUpdateTime) / 1000;
                if (isUserTurn()) {
                    setUserTime(time => {
                        const newTime = time - elapsedTime;
                        if (newTime <= 0 && !isGameOver) {
                            setShowModal("Time's Up! You Lose");
                            setIsGameOver(true); // Set game over state
                            clearInterval(intervalRef.current); // Stop the timer
                            return 0;
                        }
                        return newTime;
                    });
                } else {
                    setOpponentTime(time => {
                        const newTime = time - elapsedTime;
                        if (newTime <= 0 && !isGameOver) {
                            setShowModal("You win! Your opponent ran out of time");
                            setIsGameOver(true); // Set game over state
                            clearInterval(intervalRef.current); // Stop the timer
                            return 0;
                        }
                        return newTime;
                    });
                }
                setLastUpdateTime(currentTime);
            }, 100); // Update every 0.1 seconds
        }

        return () => clearInterval(intervalRef.current);
    }, [firstLoad, lastUpdateTime, isUserTurn, isGameOver]);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <GameOverModal show={showModal} onClose={() => setShowModal(false)} />
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Paper elevation={3} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <PlayerInfoCard playerInfo={opponentInfo} />
                            <Timer time={opponentTime} />
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <Box alignSelf="center" width="100%" maxWidth={500}>
                            <Chessboard
                                id="PremovesEnabled"
                                position={game.fen()}
                                onPieceDrop={onDrop}
                                customBoardStyle={{
                                    borderRadius: "4px",
                                    boxShadow: "0 5px 15px rgba(0, 0, 0, 0.2)",
                                }}
                                boardOrientation={userColor === 1 ? "white" : "black"}
                                isDraggablePiece={data => {
                                    if (isGameOver) return false;
                                    const piece = data.piece;
                                    return (piece[0] === "w" && userColor === 1) || (piece[0] === "b" && userColor === 0)
                                }}
                                clearPremovesOnRightClick={true}
                            />
                        </Box>
                        <Divider sx={{ mt: 2, mb: 2 }} />
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Timer time={userTime} />
                            <PlayerInfoCard playerInfo={userInfo} />
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <MoveHistory pgn={game.pgn()} />
                </Grid>
            </Grid>
        </Container>
    );
}