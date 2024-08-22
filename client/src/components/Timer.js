import React from "react";
import { Box, Typography } from "@mui/material";
import AccessTimeIcon from '@mui/icons-material/AccessTime';

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(1);
    const formattedHrs = hrs > 0 ? `${hrs}:` : '';
    const formattedMins = mins > 0 ? `${mins.toString().padStart(2, '0')}:` : '0:';
    const formattedSecs = secs.toString().padStart(4, '0');
    return `${formattedHrs}${formattedMins}${formattedSecs}`;
}

function Timer({ time }) {
    const isLowTime = time < 30; // Consider time low if less than 30 seconds

    return (
        <Box
            display="flex"
            alignItems="center"
            bgcolor={isLowTime ? 'error.light' : 'background.paper'}
            color={isLowTime ? 'error.contrastText' : 'text.primary'}
            borderRadius={16}
            boxShadow={1}
            p={1}
            width="fit-content"
        >
            <AccessTimeIcon 
                sx={{ 
                    fontSize: 20, 
                    mr: 0.5,
                    color: isLowTime ? 'inherit' : 'primary.main'
                }} 
            />
            <Typography 
                variant="body2" 
                fontWeight="medium"
                fontFamily="monospace"
            >
                {formatTime(time)}
            </Typography>
        </Box>
    );
}

export default Timer;