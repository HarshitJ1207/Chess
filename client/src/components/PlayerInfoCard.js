import React from "react";
import { Box, Typography, Avatar } from "@mui/material";

function PlayerInfoCard({ playerInfo }) {
    return (
        <Box
            display="flex"
            alignItems="center"
            bgcolor="#3a6b7a"
            borderRadius={1}
            p={1}
            width="fit-content"
            maxWidth="160px"
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
                    background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                }
            }}
        >
            <Avatar 
                sx={{ 
                    bgcolor: 'white',
                    color: '#3a6b7a',
                    width: 32,
                    height: 32,
                    fontSize: '0.875rem',
                    mr: 1,
                    border: '1px solid #FFD700',
                }}
            >
                {playerInfo.username.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
                <Typography 
                    variant="body2" 
                    fontWeight="bold" 
                    color="white"
                    sx={{ 
                        textShadow: '0.5px 0.5px 1px rgba(0,0,0,0.1)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {playerInfo.username}
                </Typography>
                <Typography 
                    variant="caption" 
                    color="rgba(255,255,255,0.9)"
                    sx={{ 
                        display: 'inline-block',
                        bgcolor: 'rgba(255,255,255,0.1)',
                        px: 0.5,
                        borderRadius: 0.5,
                    }}
                >
                    {playerInfo.rating}
                </Typography>
            </Box>
        </Box>
    );
}

export default PlayerInfoCard;