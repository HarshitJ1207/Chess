import React, { useEffect, useState } from 'react';
import { Modal, Box, TextField, Button, Snackbar, InputAdornment, IconButton } from '@mui/material';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { useSocket } from '../context/SocketContext';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const CreateChallengeModal = ({ index, onClose }) => {
    const socket = useSocket();
    const [matchCode, setMatchCode] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        socket.emit('create-challenge-friend', { index: index, token: localStorage.getItem('token') });
        socket.on('challenge-created', ({ challengeId }) => {
            setMatchCode(challengeId);
        });
        return () => {
            socket.off('challenge-created');
        }
    }, [socket, index]);
    
    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (matchCode) {
                socket.emit('delete-challenge', { challengeId: matchCode, token: localStorage.getItem('token') });
                event.preventDefault();
                event.returnValue = ''; // Required for Chrome to show the confirmation dialog
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (matchCode.length === 10) {
                socket.emit('delete-challenge', { challengeId: matchCode, token: localStorage.getItem('token') });
            }
        };
    }, [matchCode, socket]);

    return (
        <Modal
            open={true}
            onClose={onClose}
            aria-labelledby="create-challenge-modal-title"
            aria-describedby="create-challenge-modal-description"
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
                    <TextField
                        label="Match Code"
                        value={matchCode}
                        InputProps={{
                            readOnly: true,
                            endAdornment: (
                                <InputAdornment position="end">
                                    <CopyToClipboard text={matchCode} onCopy={() => setCopied(true)}>
                                        <IconButton>
                                            <ContentCopyIcon />
                                        </IconButton>
                                    </CopyToClipboard>
                                </InputAdornment>
                            ),
                        }}
                        variant="outlined"
                        fullWidth
                        margin="normal"
                    />
                    <Snackbar
                        open={copied}
                        autoHideDuration={2000}
                        onClose={() => setCopied(false)}
                        message="Match code copied!"
                    />
                    <Box display="flex" justifyContent="flex-end" mt={2}>
                        <Button
                            onClick={onClose}
                            variant="contained"
                            color="error"
                        >
                            Close
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Modal>
    );
};

export default CreateChallengeModal;