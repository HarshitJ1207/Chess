import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    IconButton,
    Box,
    Drawer,
    List,
    ListItem,
    ListItemText,
    useMediaQuery,
    useTheme,
    Menu,
    MenuItem,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

function Navbar() {
    const navigate = useNavigate();
    const isAuthenticated = localStorage.getItem("token") !== null;
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        navigate("/login");
    };

    const toggleDrawer = (open) => (event) => {
        if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        setDrawerOpen(open);
    };

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const drawer = (
        <Box
            sx={{ width: 250 }}
            role="presentation"
            onClick={toggleDrawer(false)}
            onKeyDown={toggleDrawer(false)}
        >
            <List>
                <ListItem component={Link} to="/">
                    <ListItemText primary="Home" />
                </ListItem>
                <ListItem component={Link} to="/play-online">
                    <ListItemText primary="Play Online" />
                </ListItem>
                <ListItem component={Link} to="/leaderboard">
                    <ListItemText primary="Leaderboard" />
                </ListItem>
                <ListItem component={Link} to="/play-computer">
                    <ListItemText primary="Play Computer" />
                </ListItem>
                <ListItem component={Link} to="/tools/analysis-board">
                    <ListItemText primary="Analysis Board" />
                </ListItem>
                <ListItem component={Link} to="/tools/board-editor">
                    <ListItemText primary="Board Editor" />
                </ListItem>
                {!isAuthenticated && (
                    <>
                        <ListItem component={Link} to="/login">
                            <ListItemText primary="Login" />
                        </ListItem>
                        <ListItem component={Link} to="/signup">
                            <ListItemText primary="Signup" />
                        </ListItem>
                    </>
                )}
                {isAuthenticated && (
                    <ListItem onClick={handleLogout}>
                        <ListItemText primary="Logout" />
                    </ListItem>
                )}
            </List>
        </Box>
    );

    return (
        <AppBar position="static" color="primary">
            <Toolbar>
                <IconButton edge="start" color="inherit" aria-label="logo" component={Link} to="/">
                    <img src="/chessblitz-icon.svg" alt="Chess Blitz Icon" style={{ height: 32, width: 32 }} />
                </IconButton>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    Chess Blitz
                </Typography>
                {isMobile ? (
                    <>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="end"
                            onClick={toggleDrawer(true)}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Drawer
                            anchor="right"
                            open={drawerOpen}
                            onClose={toggleDrawer(false)}
                        >
                            {drawer}
                        </Drawer>
                    </>
                ) : (
                    <Box>
                        <Button component={Link} to="/" color="inherit">Home</Button>
                        <Button component={Link} to="/play-online" color="inherit">Play Online</Button>
                        <Button component={Link} to="/leaderboard" color="inherit">Leaderboard</Button>
                        <Button component={Link} to="/play-computer" color="inherit">Play Computer</Button>
                        <Button
                            color="inherit"
                            aria-controls="tools-menu"
                            aria-haspopup="true"
                            onClick={handleMenuOpen}
                        >
                            Tools
                        </Button>
                        <Menu
                            id="tools-menu"
                            anchorEl={anchorEl}
                            keepMounted
                            open={Boolean(anchorEl)}
                            onClose={handleMenuClose}
                        >
                            <MenuItem component={Link} to="/tools/analysis-board" onClick={handleMenuClose}>
                                Analysis Board
                            </MenuItem>
                            <MenuItem component={Link} to="/tools/board-editor" onClick={handleMenuClose}>
                                Board Editor
                            </MenuItem>
                        </Menu>
                        {!isAuthenticated && (
                            <>
                                <Button component={Link} to="/login" color="inherit">Login</Button>
                                <Button component={Link} to="/signup" color="inherit">Signup</Button>
                            </>
                        )}
                        {isAuthenticated && (
                            <Button color="inherit" onClick={handleLogout}>Logout</Button>
                        )}
                    </Box>
                )}
            </Toolbar>
        </AppBar>
    );
}

export default Navbar;