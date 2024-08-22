import React, { useState, useEffect } from "react";
import { Container, Grid, Card, CardContent, Typography, Button, Box } from "@mui/material";
import { styled } from "@mui/system";
import Chat from "../components/Chat"; // Assuming you have a ChatBox component
import LiveUserStats from "../components/LiveUserStats";
import { useSocket } from "../context/SocketContext";
import WaitingForMatchModal from "../components/WaitingForMatchModal"; // Correct import
import { useNavigate } from 'react-router-dom';

const timeControls = [
    "1 + 0", "1 + 1", "3 + 0", "3 + 1", "5 + 0", "5 + 1", "10 + 0", "10 + 5",
    "30 + 0", "30 + 15", "60 + 0", "60 + 20"
];

const StyledCard = styled(Card)(({ theme }) => ({
    transition: "transform 0.2s",
    "&:hover": {
        transform: "scale(1.05)"
    }
}));

const ChatContainer = styled(Box)(({ theme }) => ({
    position: "fixed",
    bottom: theme.spacing(2),
    right: theme.spacing(2),
    zIndex: 1000,
    padding: 0,
    margin: 0,
    backgroundColor: "transparent"
}));

function PlayOnline() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const socket = useSocket();
    const [expandedCard, setExpandedCard] = useState(null);
    const [inQueue, setInQueue] = useState(false);

    const handleCardClick = (index) => {
        setExpandedCard(expandedCard === index ? null : index);
    };

    const playOnlineHandler = (index) => {
        setInQueue(index + 1); 
        socket.emit('join-matchmaking', {index: index + 1, token});
    };

    const challengeFriendHandler = (index) => {
        // Challenge friend logic here
    }

    const leaveMatchMaking = () => {
        if(!inQueue) return;
        socket.emit('leave-matchmaking', {index: inQueue, token});
        setInQueue(false); 
    }

    useEffect(() => {
        const handleLeaveMatchMaking = () => {
            leaveMatchMaking();
        }
        window.addEventListener('beforeunload', handleLeaveMatchMaking);
        socket.on('match-found', (data) => {
            console.log('Match found:', data);
            const roomId = encodeURIComponent(data.roomId);
            navigate(`/game/${roomId}`);
        });
        return () => {
            window.removeEventListener('beforeunload', handleLeaveMatchMaking);
            socket.off('match-found');
        }
    });

    return (
        <Container>
            <Box display="flex" alignItems="center" justifyContent="center" mb={4}>
                <Typography variant="h4" gutterBottom>
                    Choose Time Control
                </Typography>
                <LiveUserStats />
            </Box>
            <Grid container spacing={3}>
                {timeControls.map((tc, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                        <StyledCard>
                            <CardContent>
                                <Button onClick={() => handleCardClick(index)} fullWidth>
                                    <Typography variant="h5">
                                        {tc}
                                    </Typography>
                                </Button>
                                {expandedCard === index && (
                                    <Box mt={2}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <Button variant="contained" color="primary" fullWidth onClick={() => playOnlineHandler(index)}>
                                                    Play Online
                                                </Button>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Button variant="contained" color="secondary" fullWidth onClick={() => challengeFriendHandler(index)}>
                                                    Challenge Friend
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                )}
                            </CardContent>
                        </StyledCard>
                    </Grid>
                ))}
            </Grid>
            <ChatContainer>
                <Chat channel={'global-chat'} />
            </ChatContainer>
            {inQueue && <WaitingForMatchModal onClose={leaveMatchMaking} />}
        </Container>
    );
}

export default PlayOnline;