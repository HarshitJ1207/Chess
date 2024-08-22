import React from "react";
import ChessBoard from "../components/chessboards/ChessBoard";
import Chat from "../components/Chat";
import { Container, Box, Paper } from "@mui/material";

function Room() {
    return (
        <Container maxWidth="lg" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 4 }}>
            <Box sx={{ width: '100%', marginBottom: 4 }}>
                <Paper elevation={3} sx={{ padding: 2 }}>
                    <ChessBoard />
                </Paper>
                <Chat channel={'global-chat'} />
            </Box>
        </Container>
    );
}

export default Room;