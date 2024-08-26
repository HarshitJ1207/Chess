import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const GameOverModal = ({ gameOverData, onClose }) => {
    console.log(gameOverData);
    if (!gameOverData) return null;

    const { message, rating, ratingChange } = gameOverData;

    return (
        <Dialog
            open={true}
            onClose={onClose}
            aria-labelledby="game-over-dialog-title"
            PaperProps={{
                sx: {
                    p: 2,
                    borderRadius: 2,
                    maxWidth: "sm",
                    position: "relative",
                },
            }}
        >
            <DialogTitle
                id="game-over-dialog-title"
                sx={{ fontWeight: "bold", textAlign: "center" }}
            >
                {message}
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        right: 8,
                        top: 8,
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Typography
                    variant="body1"
                    sx={{
                        textAlign: "center",
                        color: ratingChange > 0 ? "success.main" : "error.main",
                        fontWeight: "bold"
                    }}
                >
                    New Rating: {rating + ratingChange} ({ratingChange > 0 ? "+" : ""}{ratingChange})
                </Typography>
            </DialogContent>
        </Dialog>
    );
};

export default GameOverModal;