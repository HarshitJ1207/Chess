import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Paper, Typography, Box } from '@mui/material';

function LiveUserStats() {
    const socket = useSocket();
    const [liveUserCount, setLiveUserCount] = useState(0);
    const [liveGameCount, setLiveGameCount] = useState(0);

    useEffect(() => {
        console.log('useEffect in LiveUserStats');
        socket.on('live-user-count', (count) => {
            setLiveUserCount(count);
            console.log('live user count update received', count);
        });

        socket.on('live-game-count', (count) => {
            setLiveGameCount(count);
        });

        socket.emit('query-live-user-count');
        socket.emit('query-live-game-count');

        return () => {
            socket.off('live-user-count');
            socket.off('live-game-count');
        };
    }, [socket]);

    return (
        <Paper elevation={3} sx={{ p: 4, m: 4 }}>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    {liveUserCount} live users
                </Typography>
            </Box>
            <Box>
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    {liveGameCount} live games
                </Typography>
            </Box>
        </Paper>
    );
}

export default LiveUserStats;
