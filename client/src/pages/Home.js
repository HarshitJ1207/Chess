import React from "react";
import {
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    CardActions,
    Container,
    BottomNavigation,
    BottomNavigationAction,
} from "@mui/material";
import { PlayArrow, Build, Computer, Info, ContactMail } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

function Home() {
    const navigate = useNavigate();

    return (
        <div style={{ display: "flex", flexDirection: "column"  }}>
            <div style={{ flex: "1" }}>
                <div style={{ padding: "40px 20px", textAlign: "center", backgroundColor: "#f5f5f5" }}>
                    <Typography variant="h2" component="div" gutterBottom>
                        Unleash Your Inner Chess Master
                    </Typography>
                    <Typography variant="h6" component="div" gutterBottom>
                        Challenge friends, compete online, and improve your skills on our platform.
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        startIcon={<PlayArrow />}
                        style={{ marginTop: "10px" }}
                        onClick={() => navigate("/play-online")}
                    >
                        Play Now
                    </Button>
                </div>
                <Container style={{ marginTop: "20px" }}>
                    <Grid container spacing={4}>
                        <Grid item xs={12} sm={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h5" component="div">
                                        Play Online
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Play online with our rating-based matchmaking or challenge a friend.
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        color="primary"
                                        startIcon={<PlayArrow />}
                                        onClick={() => navigate("/play-online")}
                                    >
                                        Play
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h5" component="div">
                                        Tools
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Use tools like Board Editor and Analysis Board to improve your game.
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        color="primary"
                                        startIcon={<Build />}
                                        onClick={() => navigate("/tools/analysis-board")}
                                    >
                                        Try Out
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h5" component="div">
                                        Challenge the Computer
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Challenge the computer at various difficulty levels and improve your skills.
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        color="primary"
                                        startIcon={<Computer />}
                                        onClick={() => navigate("/play-computer")}
                                    >
                                        Challenge
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </div>
            <div className="mt-20 mb-8 flex justify-center">
                <BottomNavigation 
                    showLabels 
                    className="w-auto rounded-full shadow-md"
                    style={{ backgroundColor: '#f0f0f0' }}
                >
                    <BottomNavigationAction 
                        label="About Us" 
                        icon={<Info />} 
                        onClick={() => navigate("/about")} 
                    />
                    <BottomNavigationAction 
                        label="Contact" 
                        icon={<ContactMail />} 
                        onClick={() => navigate("/contact")} 
                    />
                </BottomNavigation>
            </div>
        </div>
    );
}

export default Home;