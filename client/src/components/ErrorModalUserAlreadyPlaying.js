import React from 'react';
import { Modal, Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const ErrorModalUserAlreadyPlaying = ({ roomId, onClose }) => {
    const navigate = useNavigate();

    const handleRedirect = () => {
        navigate(`/game/${roomId}`);
    };

    return (
        <Modal
            open={true}
            onClose={onClose}
            aria-labelledby="error-modal-title"
            aria-describedby="error-modal-description"
        >
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                position="fixed"
                top={0}
                left={0}
                width="100%"
                height="100%"
                bgcolor="rgba(0, 0, 0, 0.5)"
                zIndex={1300}
            >
                <Box
                    bgcolor="background.paper"
                    borderRadius={2}
                    boxShadow={3}
                    p={4}
                    maxWidth="sm"
                    position="relative"
                >
                    <Typography id="error-modal-title" variant="h6" component="h2" gutterBottom>
                        Already in a Game
                    </Typography>
                    <Typography id="error-modal-description" variant="body1" color="textSecondary" gutterBottom>
                        You are already in a game. Please finish the existing game.
                    </Typography>
                    <Button
                        onClick={handleRedirect}
                        variant="contained"
                        color="primary"
                        sx={{ mt: 2 }}
                    >
                        Go to Game
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default ErrorModalUserAlreadyPlaying;
