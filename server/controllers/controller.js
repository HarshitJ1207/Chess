const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, UserInfo, sequelize } = require('./../models/models');
const {Sequelize, Op} = require('sequelize');


module.exports.signup = async (req, res) => {
    console.log('signup req', req.body);
    const { username, email, password } = req.body;
    // Validate input
    const errors = validationResult(req).array();
    console.log(errors);
    const errorObj = {};
    errors.forEach(error => { errorObj[error.path] = error.msg });
    if (errors.length) {
        return res.status(400).json({
            errors: errorObj,
        });
    } 
    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user

        const user = await User.create({ username, email, password: hashedPassword });
        const userInfo = await UserInfo.create({ userId: user.id });
        const rating = userInfo.rating;

        // Generate token
        const token = jwt.sign({userId: user.id, rating, username: username}, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({ message: "User created successfully", token, userInfo: {username: user.username, rating:rating }});        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            errors: { message: error.message },
        });
    } 
};


module.exports.login = async (req, res) => {
    const { identifier, password } = req.body; // identifier can be either email or username

    // Validate input
    const errors = validationResult(req).array(); 
    console.log(errors);
    if(errors.length) {
        return res.status(400).json({error: errors[0].msg});
    }

    try {
        // Find user by email or username
        const user = await User.findOne({
            where: Sequelize.or(
                { email: { [Op.like]: Sequelize.fn('LOWER', identifier.toLowerCase()) } }, // Case-insensitive email comparison
                { username: { [Op.like]: Sequelize.fn('LOWER', identifier.toLowerCase()) } }  // Case-insensitive username comparison
            )
        });
        if (!user) {
            return res.status(400).json({
                error: "User not found"
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                error: "Username/Email and Password dont match"
            });
        }
        const userInfo = await UserInfo.findOne({ where: { userId: user.id } });

        // Generate token
        const token = jwt.sign({ userId: user.id, rating: userInfo.rating, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ message: "Login successful", token, userInfo: { username: user.username, rating: userInfo.rating } });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: error.message 
        });
    }
};

module.exports.jwtVerify = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ where: { id: decodedToken.userId } });
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        res.status(200).json({ message: "Token verified" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};


module.exports.leaderboard = async (req, res) => { 
    try {
        const leaderboard = await UserInfo.findAll({
            attributes: ['rating', 'userId', 'wins', 'losses', 'draws'],
            order: [
                ['rating', 'DESC']
            ],
            include: {
                model: User,
                attributes: ['username']
            }
        });

        // Map the results to extract only the necessary fields
        const cleanLeaderboard = leaderboard.map(userInfo => ({
            rating: userInfo.rating,
            userId: userInfo.userId,
            username: userInfo.User.username,
            wins: userInfo.wins,
            losses: userInfo.losses,
            draws: userInfo.draws
        }));

        res.status(200).json(cleanLeaderboard);
        console.log(cleanLeaderboard);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}