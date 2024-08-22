import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const GameOverModal = ({ show, onClose }) => {
    if (!show) return null;

    return (
        <Dialog
            open={true}
            onClose={onClose}
            aria-labelledby="game-over-dialog-title"
            PaperProps={{
                sx: {
                    p: 2,
                    borderRadius: 2,
                    maxWidth: 'sm',
                    position: 'relative',
                }
            }}
        >
            <DialogTitle id="game-over-dialog-title" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                Game Over!
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Typography variant="body1" sx={{ textAlign: 'center' }}>
                    {show}
                </Typography>
            </DialogContent>
            {/* <DialogActions>
                <Button onClick={onPlayAgain} variant="contained" color="primary" fullWidth>
                    Play Again
                </Button>
            </DialogActions> */}
        </Dialog>
    );
};

export default GameOverModal;
