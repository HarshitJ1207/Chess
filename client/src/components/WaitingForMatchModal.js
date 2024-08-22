import React from 'react';
import { Modal, Box, Typography, Button } from '@mui/material';

const WaitingForMatchModal = ({ onClose }) => {
    return (
        <Modal
            open={true}
            onClose={onClose}
            aria-labelledby="waiting-for-match-modal-title"
            aria-describedby="waiting-for-match-modal-description"
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
                    <Typography id="waiting-for-match-modal-title" variant="h6" component="h2" gutterBottom>
                        Waiting for Match
                    </Typography>
                    <Typography id="waiting-for-match-modal-description" variant="body1" color="textSecondary" gutterBottom>
                        You are currently in the matchmaking queue. Please wait...
                    </Typography>
                    <Button
                        onClick={onClose}
                        variant="contained"
                        color="error"
                        sx={{ mt: 2 }}
                    >
                        Leave Matchmaking
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default WaitingForMatchModal;