import React, { useState, useEffect } from 'react';
import {
    Container,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    CircularProgress,
    Box
} from '@mui/material';

const Leaderboard = () => {
    const [userList, setUserList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserList = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/leaderboard`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setUserList(data);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching user list:', error);
                setLoading(false);
            }
        };

        fetchUserList();
    }, []);

    return (
        <Container sx={{ mt: 4 }}>
            <Typography variant="h4" gutterBottom align="center">
                Leaderboard
            </Typography>
            {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Username</TableCell>
                                <TableCell align="right">Rating</TableCell>
                                <TableCell align="right">Wins</TableCell>
                                <TableCell align="right">Losses</TableCell>
                                <TableCell align="right">Draws</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {userList.map((user) => (
                                <TableRow key={user.username}>
                                    <TableCell component="th" scope="row">
                                        {user.username}
                                    </TableCell>
                                    <TableCell align="right">{user.rating}</TableCell>
                                    <TableCell align="right">{user.wins}</TableCell>
                                    <TableCell align="right">{user.losses}</TableCell>
                                    <TableCell align="right">{user.draws}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default Leaderboard;