import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
    TextField, 
    Paper, 
    Box, 
    Typography, 
    IconButton,
    List, 
    ListItem, 
    ListItemText,
    Collapse,
    useMediaQuery,
} from '@mui/material';
import { Send, ExpandLess, ExpandMore } from '@mui/icons-material';

const Chat = ({channel}) => {
    const socket = useSocket();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    const username = userInfo ? userInfo.username : '';
    const messagesEndRef = useRef(null);
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));

    useEffect(() => {
        if (!username) return;

        const handleMessage = (message) => {
            if (message.username === username) return;
            setMessages((prevMessages) => [...prevMessages, message]);
        };

        socket.on(channel, handleMessage);

        return () => {
            socket.off(channel, handleMessage);
        };
    }, [username, socket, channel]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim()) {
            const newMessage = {
                username,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: message
            };
            socket.emit(channel, newMessage);
            setMessages((prevMessages) => [...prevMessages, newMessage]);
            setMessage('');
        }
    };

    const toggleChat = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <Paper 
            elevation={3} 
            sx={{ 
                width: isMobile ? '100%' : 400, 
                position: 'fixed', 
                bottom: 0, 
                right: isMobile ? 0 : 20, 
                zIndex: 1000 
            }}
        >
            <Box sx={{ 
                p: 2, 
                backgroundColor: 'primary.main', 
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
            }} onClick={toggleChat}>
                <Typography variant="h6">Chat</Typography>
                <IconButton size="small" sx={{ color: 'white' }}>
                    {isExpanded ? <ExpandMore /> : <ExpandLess />}
                </IconButton>
            </Box>
            <Collapse in={isExpanded}>
                <Box sx={{ height: isMobile ? '60vh' : 400, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                        <List>
                            {messages.map((msg, index) => (
                                <ListItem 
                                    key={index} 
                                    sx={{ 
                                        justifyContent: msg.username === username ? 'flex-end' : 'flex-start',
                                        mb: 1,
                                    }}
                                >
                                    <Paper elevation={1} sx={{ 
                                        p: 1, 
                                        maxWidth: '80%',
                                        backgroundColor: msg.username === username ? 'primary.light' : 'grey.100',
                                    }}>
                                        <ListItemText 
                                            primary={msg.text}
                                            secondary={`${msg.username} - ${msg.time}`}
                                            primaryTypographyProps={{ 
                                                variant: 'body2',
                                                color: msg.username === username ? 'primary.contrastText' : 'text.primary'
                                            }}
                                            secondaryTypographyProps={{ 
                                                variant: 'caption',
                                                color: msg.username === username ? 'primary.contrastText' : 'text.secondary'
                                            }}
                                        />
                                    </Paper>
                                </ListItem>
                            ))}
                            <div ref={messagesEndRef} />
                        </List>
                    </Box>
                    <Box component="form" onSubmit={sendMessage} sx={{ p: 2, backgroundColor: 'grey.100' }}>
                        <TextField
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your message..."
                            variant="outlined"
                            size="small"
                            fullWidth
                            InputProps={{
                                endAdornment: (
                                    <IconButton type="submit" edge="end">
                                        <Send />
                                    </IconButton>
                                ),
                            }}
                        />
                    </Box>
                </Box>
            </Collapse>
        </Paper>
    );
};

export default Chat;