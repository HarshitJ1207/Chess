import React, { useMemo, useState, useContext } from "react";
import Chess from "chess.js";
import {
	Chessboard,
	ChessboardDnDProvider,
	SparePiece,
} from "react-chessboard";
import { useNavigate } from "react-router-dom";
import { BoardContext } from "../../context/Board";
import {
	Box,
	Button,
	TextField,
	Typography,
	Paper,
	Grid,
	Modal,
	Fade,
} from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledPaper = styled(Paper)(({ theme }) => ({
	padding: theme.spacing(3),
	borderRadius: theme.spacing(2),
	boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
}));

const StyledButton = styled(Button)(({ theme }) => ({
	borderRadius: theme.spacing(1),
	textTransform: "none",
	fontWeight: "bold",
	maxWidth: "200px",
	width: "100%",
}));

const SparePieceWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "center",
	gap: theme.spacing(1),
	marginBottom: theme.spacing(2),
}));

const ModalContent = styled(Box)(({ theme }) => ({
	position: "absolute",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	width: 400,
	backgroundColor: theme.palette.background.paper,
	boxShadow: theme.shadows[24],
	padding: theme.spacing(4),
	borderRadius: theme.spacing(2),
}));

function BoardEditor() {
	const { validateBoardState, reverseTurnInFen } = useContext(BoardContext);
	const navigate = useNavigate();
	const game = useMemo(() => new Chess("8/8/8/8/8/8/8/8 w - - 0 1"), []); // empty board
	const [boardOrientation, setBoardOrientation] = useState("white");
	const [fenPosition, setFenPosition] = useState(game.fen());
	const [turn, setTurn] = useState("white");
	const [modalOpen, setModalOpen] = useState(false);

	const handleInvalidPosition = () => {
		setModalOpen(true);
	};

	const handleSparePieceDrop = (piece, targetSquare) => {
		const color = piece[0];
		const type = piece[1].toLowerCase();
		const success = game.put({ type, color }, targetSquare);
		if (success) {
			setFenPosition(game.fen());
		} else {
			alert(
				`The board already contains ${
					color === "w" ? "WHITE" : "BLACK"
				} KING`
			);
		}
		return success;
	};

	const handlePieceDrop = (sourceSquare, targetSquare, piece) => {
		const color = piece[0];
		const type = piece[1].toLowerCase();

		// this is hack to avoid chess.js bug, which I've fixed in the latest version https://github.com/jhlywa/chess.js/pull/426
		game.remove(sourceSquare);
		game.remove(targetSquare);
		const success = game.put({ type, color }, targetSquare);
		if (success) setFenPosition(game.fen());
		return success;
	};

	const handlePieceDropOffBoard = (sourceSquare) => {
		game.remove(sourceSquare);
		setFenPosition(game.fen());
	};

	const handleFenInputChange = (e) => {
		const fen = e.target.value;
		const { valid } = game.validate_fen(fen);
		setFenPosition(fen);
		if (valid) {
			game.load(fen);
			setFenPosition(game.fen());
		}
	};

	const toggleTurn = () => {
		setTurn((prevTurn) => (prevTurn === "white" ? "black" : "white"));
		let newFen = reverseTurnInFen(game.fen());
		game.load(newFen);
		setFenPosition(newFen);
	};

	const pieces = [
		"wP",
		"wN",
		"wB",
		"wR",
		"wQ",
		"wK",
		"bP",
		"bN",
		"bB",
		"bR",
		"bQ",
		"bK",
	];

	return (
		<Box sx={{ p: 4, bgcolor: "background.default", minHeight: "100vh" }}>
			<ChessboardDnDProvider>
				<StyledPaper elevation={3}>
					<Typography
						variant="h4"
						align="center"
						gutterBottom
						sx={{
							fontWeight: "bold",
							color: "primary.main",
							mb: 3,
						}}
					>
						Board Editor
					</Typography>
					<SparePieceWrapper>
						{pieces.slice(6, 12).map((piece) => (
							<SparePiece
								key={piece}
								piece={piece}
								width={45}
								dndId="ManualBoardEditor"
							/>
						))}
					</SparePieceWrapper>
					<Box
						sx={{
							display: "flex",
							justifyContent: "center",
							mb: 3,
						}}
					>
						<Box sx={{ width: "100%", maxWidth: "500px" }}>
							<Chessboard
								id="ManualBoardEditor"
								boardOrientation={boardOrientation}
								position={game.fen()}
								onSparePieceDrop={handleSparePieceDrop}
								onPieceDrop={handlePieceDrop}
								onPieceDropOffBoard={handlePieceDropOffBoard}
								dropOffBoardAction="trash"
								customBoardStyle={{
									borderRadius: "8px",
									boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
								}}
								customDarkSquareStyle={{
                                    backgroundColor: "#3a6b7a"
                                }}
                                customLightSquareStyle={{
                                    backgroundColor: "#a5c3cc"
                                }}
							/>
						</Box>
					</Box>
					<SparePieceWrapper>
						{pieces.slice(0, 6).map((piece) => (
							<SparePiece
								key={piece}
								piece={piece}
								width={45}
								dndId="ManualBoardEditor"
							/>
						))}
					</SparePieceWrapper>
					<Grid
						container
						spacing={1} // Reduced spacing
						sx={{ mb: 3, maxWidth: 800, margin: "0 auto" }} // Constrain width and center
						justifyContent="center"
						alignItems="center"
					>
						<Grid
							item
							xs={12}
							sm={6}
							md={3}
							sx={{ textAlign: "center" }}
						>
							<StyledButton
								variant="contained"
								color="primary"
								onClick={() => {
									game.reset();
									setFenPosition(game.fen());
								}}
							>
								Start position
							</StyledButton>
						</Grid>
						<Grid
							item
							xs={12}
							sm={6}
							md={3}
							sx={{ textAlign: "center" }}
						>
							<StyledButton
								variant="contained"
								color="secondary"
								onClick={() => {
									game.clear();
									setFenPosition(game.fen());
								}}
							>
								Clear board
							</StyledButton>
						</Grid>
						<Grid
							item
							xs={12}
							sm={6}
							md={3}
							sx={{ textAlign: "center" }}
						>
							<StyledButton
								variant="contained"
								color="info"
								onClick={() =>
									setBoardOrientation((prev) =>
										prev === "white" ? "black" : "white"
									)
								}
							>
								Flip Board
							</StyledButton>
						</Grid>
						<Grid
							item
							xs={12}
							sm={6}
							md={3}
							sx={{ textAlign: "center" }}
						>
							<StyledButton
								variant="contained"
								color="warning"
								onClick={toggleTurn}
							>
								Turn: {turn}
							</StyledButton>
						</Grid>
					</Grid>
					<Grid
						container
						spacing={1} // Reduced spacing
						sx={{ mb: 3, maxWidth: 800, margin: "0 auto" }} // Constrain width and center
						justifyContent="center"
						alignItems="center"
					>
						<Grid
							item
							xs={12}
							sm={6}
							md={4}
							sx={{ textAlign: "center" }}
						>
							<StyledButton
								variant="contained"
								color="success"
								onClick={() => {
									const fen = fenPosition;
									let tempChess = new Chess(fen);
									const valid = validateBoardState(tempChess);
									if (valid) {
										const encodedFen =
											encodeURIComponent(fen);
										navigate(
											`/tools/analysis-board?start=${encodedFen}`
										);
									} else {
										handleInvalidPosition();
									}
								}}
							>
								Analysis
							</StyledButton>
						</Grid>
						<Grid
							item
							xs={12}
							sm={6}
							md={4}
							sx={{ textAlign: "center" }}
						>
							<StyledButton
								variant="contained"
								color="success"
								onClick={() => {
									const fen = fenPosition;
									let tempChess = new Chess(fen);
									const valid = validateBoardState(tempChess);
									if (valid) {
										const encodedFen =
											encodeURIComponent(fen);
										navigate(
											`/play-computer?start=${encodedFen}`
										);
									} else {
										handleInvalidPosition();
									}
								}}
							>
								Play against computer
							</StyledButton>
						</Grid>
					</Grid>
					<TextField
						fullWidth
						value={fenPosition}
						onChange={handleFenInputChange}
						placeholder="Paste FEN position to start editing"
						variant="outlined"
						sx={{ mt: 2 }}
					/>
				</StyledPaper>
			</ChessboardDnDProvider>
			<Modal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				closeAfterTransition
			>
				<Fade in={modalOpen}>
					<ModalContent>
						<Typography variant="h6" component="h2" gutterBottom>
							Invalid Position
						</Typography>
						<Typography sx={{ mb: 2 }}>
							The current board position is not valid. Please
							check the following:
						</Typography>
                        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                            <li style={{ position: 'relative', paddingLeft: '1.5em' }}>
                            • Each side should have exactly one king
                            </li>
                            <li style={{ position: 'relative', paddingLeft: '1.5em' }}>
                            • Pawns should not be on the first or last rank
                            </li>
                            <li style={{ position: 'relative', paddingLeft: '1.5em' }}>
                            • The side waiting for its turn should not be in check.
                            </li>
                        </ul>
						<Box
							sx={{
								display: "flex",
								justifyContent: "flex-end",
								mt: 2,
							}}
						>
							<Button
								onClick={() => setModalOpen(false)}
								variant="contained"
								color="primary"
							>
								Close
							</Button>
						</Box>
					</ModalContent>
				</Fade>
			</Modal>
		</Box>
	);
}

export default BoardEditor;
