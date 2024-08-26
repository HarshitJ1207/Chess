require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const { initializeSocket } = require('./config/socket');
const jwt = require('jsonwebtoken');
const routes = require('./routes/routes');
const {User} = require('./models/models');
const path = require('path');

initializeSocket(server);

const corsOptions = { 
    origin: process.env.ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
};

app.options('*', cors(corsOptions)); 
app.use(cors(corsOptions));
app.use(express.json());

app.use('/', async (req, res, next) => {
    console.log('req initiated');
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
            try {
                const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
                req.user = await User.findOne({ 'id': decodedToken.userId });
            } catch (err) {
                console.error(err);
                req.user = null;
            }
        }
    }
    next();
});


app.use('/api', routes);

// Serve static files
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'), err => {
        if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send('An error occurred while loading the page');
        }
    });
});

app.use('*', (req, res) => {
    res.status(200).send('Hello World');    
});


server.listen(process.env.PORT || 8000, '0.0.0.0', () => {
    console.log(`Server listening on port ${process.env.PORT || 8000}`);
});