import React from "react";
import { Box, Typography } from "@mui/material";
import AccessTimeIcon from '@mui/icons-material/AccessTime';

function formatTime(milliseconds) {
    const seconds = milliseconds / 1000;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(1);
    const formattedHrs = hrs > 0 ? `${hrs}:` : '';
    const formattedMins = mins > 0 ? `${mins.toString().padStart(2, '0')}:` : '0:';
    const formattedSecs = secs.toString().padStart(4, '0');
    return `${formattedHrs}${formattedMins}${formattedSecs}`;
}

function Timer({ time }) {
    const isLowTime = time < 30000; // Consider time low if less than 30 seconds (30000 ms)

    return (
        <Box
            display="flex"
            alignItems="center"
            bgcolor="#3a6b7a"
            color="white"
            borderRadius={1}
            p={1}
            width="fit-content"
            maxWidth="110px"
            position="relative"
            overflow="hidden"
            sx={{
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                    boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
                },
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: isLowTime 
                        ? 'linear-gradient(90deg, #FF6B6B, #FF8E8E)'
                        : 'linear-gradient(90deg, #FFD700, #FFA500)',
                }
            }}
        >
            <AccessTimeIcon 
                sx={{ 
                    fontSize: 18, 
                    mr: 0.5,
                    color: isLowTime ? '#FF8E8E' : 'inherit'
                }} 
            />
            <Typography 
                variant="body2" 
                fontWeight="medium"
                fontFamily="monospace"
                sx={{ 
                    textShadow: '0.5px 0.5px 1px rgba(0,0,0,0.1)',
                    color: isLowTime ? '#FF8E8E' : 'inherit'
                }}
            >
                {formatTime(time)}
            </Typography>
        </Box>
    );
}

export default Timer;