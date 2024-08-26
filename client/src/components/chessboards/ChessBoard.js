import React, { useEffect, useState, useCallback, useMemo } from "react";
import Chess from "chess.js";
import { Chessboard } from "react-chessboard";
import MoveHistory from "../MoveHistory";
import { useSocket } from "../../context/SocketContext";
import Timer from "../Timer"; 
import PlayerInfoCard from "../PlayerInfoCard";
import { useParams } from "react-router-dom";
import GameOverModal from "../GameOverModal";
import { Container, Grid, Paper, Box, Divider, Button } from '@mui/material';

export default function ChessBoard() {
	console.log("ChessBoard rendered");
	const { roomId } = useParams();
	const socket = useSocket();
	const [game, setGame] = useState(new Chess());
	const [userColor, setUserColor] = useState(null);
	const [opponentInfo, setOpponentInfo] = useState({
        username: "Opponent",
		rating: 1000,
	});
	const [userInfo, setUserInfo] = useState({ username: "You", rating: 1000 });
	const [userTime, setUserTime] = useState(0.0);
	const [opponentTime, setOpponentTime] = useState(0.0);
	const [showModal, setShowModal] = useState(false);
	const [gameState, setGameState] = useState(null);
	const [drawOfferExists, setDrawOfferExists] = useState(false);
	console.log("game state", gameState);   

 
  	// const isUserTurn = useCallback(() => {
	// 	return (
	// 		(game.turn() === "w" && userColor === 1) ||
	// 		(game.turn() === "b" && userColor === 0)
	// 	);
    // }, [game, userColor]);

	const safeGameMutate = useCallback((modify) => {
		setGame((g) => {
			const update = { ...g };
			modify(update);
			return update;
		});
	}, []);

	const onDrop = useCallback(
		(sourceSquare, targetSquare, piece) => {
			if (gameState !== null) return false;
			const move = {
				from: sourceSquare,
				to: targetSquare,
				promotion: piece[1].toLowerCase() ?? "q",
			};
			try {
				const newGame = { ...game };
				const result = newGame.move(move);
				if (result) {
					setGame(newGame);
					const currentTime = Date.now();
					socket.emit("move", {
						moveData: {
							sourceSquare,
							targetSquare,
							piece,
							time: currentTime,
						},
						roomId,
                        token: localStorage.getItem("token")
					});
                    setDrawOfferExists(false);
					return true;
				}
			} catch (error) {
				console.error("Invalid move:", error);
			}
			return false;
		},
		[game, socket, roomId, gameState]
	);

	// handle init
	useEffect(() => {
		const handleGetGameData = (data) => {
			setUserColor(data.color);
			setOpponentInfo(data.opponentInfo);
			setUserInfo(data.userInfo);
			setGameState(data.gameState);
			setDrawOfferExists(data.drawOfferExists);
			setUserTime(+data.timeControl.init * 60*1000);
			setOpponentTime(+data.timeControl.init * 60*1000);
			if (data.moveHistory.length > 0) {
				const newGame = new Chess();
				data.moveHistory.forEach((move) => newGame.move(move));
				setGame(newGame);
			}
			console.log("game data received");
		};
		const handleFocus = () => {
			// window.location.reload();
		};

        window.addEventListener('focus', handleFocus);
		const token = localStorage.getItem("token");
		console.log("game data requested");
		socket.emit("get-game-data", { token, roomId });
		socket.on("get-game-data", handleGetGameData);

        return () => {
            socket.off("get-game-data", handleGetGameData);
            window.removeEventListener('focus', handleFocus);
        };
	}, [socket, roomId, userInfo.rating]);


	// handle game state
	useEffect(() => {
        const handleOfferDraw = () => {
            setDrawOfferExists(true);
        };
        const handleResult = ({result, message, ratingChange, opponentRating}) => {
            setGameState(result);
            setShowModal({
				message,
				rating: userInfo.rating,
				ratingChange,
			});
			setUserInfo((info) => ({ ...info, rating: info.rating + ratingChange }));
			setOpponentInfo((info) => ({ ...info, rating: opponentRating }));
			console.log('modal set');
        };
        socket.on('offer-draw', handleOfferDraw);
        socket.on('result', handleResult);
		return () => {
            socket.off("offer-draw");
            socket.off("result");
		};
	}, [socket, userInfo.rating]);

	//handle moves
	useEffect(() => {
		socket.emit("player-connected", { roomId });
		const handleMove = (moveData) => {
			safeGameMutate((g) => {
				g.move({
					from: moveData.sourceSquare,
					to: moveData.targetSquare,
					promotion: moveData.piece[1].toLowerCase() ?? "q",
				});
			});
		};
		socket.on("move", handleMove);
		return () => {
			socket.emit("player-disconnected", { roomId });
			socket.off("move", handleMove);
		};
	}, [socket, roomId, safeGameMutate]);

	//handle timer
	useEffect(() => {
		socket.on('timer-update', ({userTime, opponentTime}) => {
			setUserTime(userTime);
			setOpponentTime(opponentTime);
		});
	}, [socket]);



	const chessboardProps = useMemo(
		() => ({
			id: "PremovesEnabled",
			position: game.fen(),
			onPieceDrop: onDrop,
			customBoardStyle: {
				borderRadius: "4px",
				boxShadow: "0 5px 15px rgba(0, 0, 0, 0.2)",
			},
			boardOrientation: userColor === 1 ? "white" : "black",
			isDraggablePiece: ({ piece }) =>
				!(gameState !== null) &&
				((piece[0] === "w" && userColor === 1) ||
				(piece[0] === "b" && userColor === 0)),
			customDarkSquareStyle: { backgroundColor: "#3a6b7a" },
			customLightSquareStyle: { backgroundColor: "#a5c3cc" },
		}),
		[game, onDrop, userColor, gameState]
	);

	const handleOfferDraw = () => {
        socket.emit("offer-draw", { roomId, token: localStorage.getItem("token") });
    };
	const handleResign = () => {
        socket.emit("resign", {roomId, token: localStorage.getItem("token")});
    };


	return (
		<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
			<GameOverModal
				gameOverData={showModal}
				onClose={() => setShowModal(false)}
			/>
			<Grid container spacing={3}>
				<Grid item xs={12} md={8}>
					<Paper
						elevation={3}
						sx={{
							p: 2,
							display: "flex",
							flexDirection: "column",
							height: "100%",
						}}
					>
						<Box
							display="flex"
							justifyContent="space-between"
							alignItems="center"
							mb={2}
						>
							<PlayerInfoCard playerInfo={opponentInfo} />
							<Timer time={opponentTime} />
						</Box>
						<Divider sx={{ mb: 2 }} />
						<Box alignSelf="center" width="100%" maxWidth={500}>
							<Chessboard {...chessboardProps} />
						</Box>
						<Box
							display="flex"
							justifyContent="center"
							mt={2}
							mb={2}
						>
							<Button
								variant="contained"
								color="primary"
								sx={{ mr: 2 }}
								onClick={handleOfferDraw}
								disabled={gameState !== null}
							>
								{drawOfferExists ? 'Accept Draw': 'Offer Draw'}
							</Button>
							<Button
								variant="contained"
								color="secondary"
								onClick={handleResign}
								disabled={gameState !== null}
							>
								Resign
							</Button>
						</Box>
						<Divider sx={{ mt: 2, mb: 2 }} />
						<Box
							display="flex"
							justifyContent="space-between"
							alignItems="center"
						>
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