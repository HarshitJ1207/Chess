import React from "react";
import { Box, Typography, Avatar } from "@mui/material";

function PlayerInfoCard({ playerInfo }) {
    return (
        <Box
            display="flex"
            alignItems="center"
            bgcolor="background.paper"
            borderRadius={16}
            boxShadow={1}
            p={1}
            width="fit-content"
        >
            <Avatar 
                sx={{ 
                    bgcolor: 'primary.main',
                    width: 32,
                    height: 32,
                    fontSize: '0.875rem',
                    mr: 1
                }}
            >
                {playerInfo.username.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
                <Typography variant="subtitle2" fontWeight="bold">
                    {playerInfo.username}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Rating: {playerInfo.rating}
                </Typography>
            </Box>
        </Box>
    );
}

export default PlayerInfoCard;