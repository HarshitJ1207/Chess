const { Server } = require('socket.io');
const Sequelize = require('sequelize');
const client = require('./redis');
const jwt = require('jsonwebtoken');
const sequelize = require('../config/db');
const UserInfo = require('../models/UserInfo')(sequelize);
const User = require('../models/User')(sequelize);
const corsOptions = { 
    origin: process.env.ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
};
const {Chess} = require('chess.js');

let io;
const connectedUsers = new Set();

const roomMap = {}; 

const timeControls = [
    { init: 1, increment: 0 },
    { init: 1, increment: 1 },
    { init: 3, increment: 0 },
    { init: 3, increment: 1 },
    { init: 5, increment: 0 },
    { init: 5, increment: 1 },
    { init: 10, increment: 0 },
    { init: 10, increment: 5 },
    { init: 30, increment: 0 },
    { init: 30, increment: 15 },
    { init: 60, increment: 0 },
    { init: 60, increment: 20 }
];


async function generateUniqueId() {
    let uniqueId;

    while (true) {
        // Generate a random 10-digit number
        uniqueId = Math.floor(1000000000 + Math.random() * 9000000000).toString();

        // Check if the ID exists in the challenges hashset or rooms set
        const existsInChallenges = await client.hExists('challenges', uniqueId);
        const existsInRooms = await client.sIsMember('rooms', uniqueId);

        if (!existsInChallenges && !existsInRooms) {
            break;
        }
    }
    return uniqueId;
}


async function matchPlayers(index) {
    const queueKey = `matchmaking-queue-${index}`;

    try {
        const players = await client.zRange(queueKey, 0, -1);
        for (let i = 0; i < players.length - 1; i++) {
            const player1 = JSON.parse(players[i]);
            const player2 = JSON.parse(players[i + 1]);

            const roomId = await generateUniqueId();
            const color = Math.floor(Math.random() * 2);

            client.sAdd("rooms", roomId);

            // CREATE ROOM
            roomMap[roomId] = {
                timeControl: timeControls[index - 1],
                player1: player1,
                player2: player2,
                color: color,
                game: new Chess(),
                moveHistory: [],
                gameState: null, 
                drawOfferExists: false,
                drawOfferedBy: null,
                time1: timeControls[index - 1].init * 60 * 1000,
                time2: timeControls[index - 1].init * 60 * 1000,
                interval: null,
                turn: color === 1 ? 1 : 2
            };
            console.log(
                `Room created: ${roomId} with players ${player1.socketId} and ${player2.socketId}`
            );
            await client.hSet('userToRoom', player1.username, roomId);
            await client.hSet('userToRoom', player2.username, roomId);
            io.to(player1.socketId).emit("match-found", {
                roomId,
            });
            io.to(player2.socketId).emit("match-found", {
                roomId,
            });
            await client.zRem(queueKey, JSON.stringify(player1));
            await client.zRem(queueKey, JSON.stringify(player2));
            console.log(
                `Players ${player1.socketId} and ${player2.socketId} removed from matchmaking queue ${queueKey}`
            );
            i++;
        }
    } catch (error) {
        console.error(`Error matching players in queue ${queueKey}:`, error);
    }
}


function getRatingChanges(score, rating1,rating2){
    const K_FACTOR = 32; 

    const expectedScore1 = 1 / (1 + 10 ** ((rating2 - rating1) / 400));
    const expectedScore2 = 1 / (1 + 10 ** ((rating1 - rating2) / 400));

    const ratingChange1 = Math.round(K_FACTOR * (score - expectedScore1));
    const ratingChange2 = Math.round(K_FACTOR * ((1 - score) - expectedScore2));

    return {ratingChange1, ratingChange2};
}

async function performRatingChanges(score, player1, player2) {
    const {ratingChange1, ratingChange2} = getRatingChanges(score, player1.rating, player2.rating);
    const user1 = await User.findOne({ where: { username: player1.username } });
    const userId1 = user1.id;
    const user2 = await User.findOne({ where: { username: player2.username } });
    const userId2 = user2.id;

    try {
        await UserInfo.update(
            { rating: Sequelize.literal(`rating + ${ratingChange1}`) },
            { where: { userId: userId1 } }
        );

        await UserInfo.update(
            { rating: Sequelize.literal(`rating + ${ratingChange2}`) },
            { where: { userId: userId2 } }
        );
        if (score === 1) {
            await UserInfo.increment('wins', { where: { userId: userId1 } });
            await UserInfo.increment('losses', { where: { userId: userId2 } });
        } else if (score === 0) {
            await UserInfo.increment('losses', { where: { userId: userId1 } });
            await UserInfo.increment('wins', { where: { userId: userId2 } });
        } else {
            await UserInfo.increment('draws', { where: { userId: userId1 } });
            await UserInfo.increment('draws', { where: { userId: userId2 } });
        }

        console.log("Ratings updated successfully!");
    } catch (error) {
        console.error("Error updating ratings:", error);
        // Handle the error appropriately (e.g., send an error response)
    }
}

async function processResult(score, roomId){
    try{
        const room = roomMap[roomId];
        if(!room){
            throw new Error("Room not found");
        }
        const player1 = room.player1;
        const player2 = room.player2;
        await performRatingChanges(score, player1, player2);
    }
    catch(error){
        console.error("Error processing result:", error);
    }

}

function jwtVerify(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
        return decoded;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}

function handleGlobalChat({message, token}) {
    try{
        console.log(`Message received: ${message}`);
        message.username = jwtVerify(token).username;
        this.broadcast.emit("global-chat", message);
    }
    catch(error){
        console.error("Error sending global chat message:", error);
        this.emit("error", "Failed to send global chat message");
    }
}

function handleQueryLiveUserCount() {
    console.log("Querying live user count");
    client
        .get("total-users")
        .then((totalUsers) => {
            this.emit("live-user-count", totalUsers);
        })
        .catch((redisError) => {
            console.error("Error getting total-users from Redis:", redisError);
        });
}

async function handleJoinMatchmaking({ index, token }) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const user = await User.findOne({ where: { id: userId } });
        const userInfo = await UserInfo.findOne({ where: { userId: userId } });
        if (!userInfo) {
            throw new Error("User not found");
        }
        const username = user.username;

        // Check if the user is already in a room
        const existingRoomId = await client.hGet('userToRoom', username);
        if (existingRoomId) {
            this.emit("error-user-already-playing", { roomId: existingRoomId });
            return;
        }

        const player = {
            rating: userInfo.rating,
            username: username,
            socketId: this.id,
        };
        const queueKey = `matchmaking-queue-${index}`;

        await client.zAdd(queueKey, {
            score: player.rating,
            value: JSON.stringify(player),
        });
        console.log(
            `Player added to matchmaking queue ${queueKey}: ${JSON.stringify(player)}`
        );
        matchPlayers(index);
    } catch (error) {
        console.error("Error joining matchmaking:", error);
        this.emit("error", "Failed to join matchmaking");
    }
}

async function handleLeaveMatchmaking({ index, token }) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const user = await User.findOne({ where: { id: userId } });
        const userInfo = await UserInfo.findOne({ where: { userId: userId } });
        if (!userInfo) {
            throw new Error("User not found");
        }
        const player = {
            rating: userInfo.rating,
            username: user.username,
            socketId: this.id,
        };
        const queueKey = `matchmaking-queue-${index}`;

        await client.zRem(queueKey, JSON.stringify(player));
        console.log(
            `Player removed from matchmaking queue ${queueKey}: ${JSON.stringify(player)}`
        );
        this.emit("success", "Left matchmaking successfully");
    } catch (error) {
        console.error("Error leaving matchmaking:", error);
        this.emit("error", "Failed to leave matchmaking");
    }
}

function handleDisconnect() {
    try {
        const uuid = this.handshake.query.uuid;
        const sockets = Array.from(io.sockets.sockets.values());
        const userSockets = sockets.filter((s) => s.handshake.query.uuid === uuid);

        if (userSockets.length === 0) {
            client.sRem("connected-users", uuid)
                .then(() => client.decr("total-users"))
                .then((totalUsers) => {
                    io.emit("live-user-count", totalUsers);
                    console.log(`Total users after disconnection: ${totalUsers}`);
                })
                .catch((redisError) => {
                    console.error("Error updating total-users in Redis:", redisError);
                });
        }
    } catch (error) {
        console.error("Error during disconnection:", error);
    }
}


async function handleGetGameData({ token, roomId }) {
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;
        const user = await User.findOne({ where: { id: userId } });
        const username = user.username;
        const room = roomMap[roomId];
        if (!room) {
            this.emit("error", "Room not found");
            return;
        }
        if (username !== room.player1.username && username !== room.player2.username) {
            this.emit("error", "Unauthorized");
            return;
        }
        console.log("game data request received");


        if (username === room.player1.username) {
            const gameData = {
                color: room.color,
                opponentInfo: room.player2,
                userInfo: room.player1,
                timeControl: room.timeControl,
                moveHistory: room.moveHistory,
                drawOfferExists: room.drawOfferExists,
                gameState: room.gameState === null ? room.gameState : room.gameState,
            };
            room.player1.socketId = this.id;
            this.emit("get-game-data", gameData);
            console.log("game data sent", gameData);
        } else if (username === room.player2.username) {
            const gameData = {
                color: 1 - room.color,
                opponentInfo: room.player1,
                userInfo: room.player2,
                timeControl: room.timeControl,
                moveHistory: room.moveHistory,
                drawOfferExists: room.drawOfferExists,
                gameState: room.gameState === null ? room.gameState : 1 - room.gameState,
            };
            this.emit("get-game-data", gameData);
            room.player2.socketId = this.id;
            console.log("game data sent", gameData);
        }
    } catch (error) {
        console.error("Error getting game data:", error);
        this.emit("error", "Failed to get game data");
    }
}

function checkGameState(room){
    const {game , color} = room;
    let message;
    let result;
    if (game.in_checkmate()) {
        message = "Win by Checkmate";
        if(game.turn() === 'w'){
            if(color === 1) result = 0;
            else result = 1;
        } else {
            if(color === 0) result = 0;
            else result = 1;
        }
    } else if (game.in_stalemate()) {
        message = "Draw by Stalemate";
        result = 0.5;
    } else if (game.in_threefold_repetition()) {
        message = "Draw by Threefold Repetition";
        result = 0.5;
    } else if (game.insufficient_material()) {
        message = "Draw by Insufficient Material";
        result = 0.5;
    } else if (game.in_draw()) {
        message = "Draw";
        result = 0.5;
    }
    return {message, result};
}

async function handleMove({ moveData, roomId, token }) {
    try {
        const { sourceSquare, targetSquare, piece } = moveData;
        const room = roomMap[roomId];
        if (!room) {
            this.emit("error", "Room not found");
            return;
        }
        const decodedToken = jwtVerify(token);
        if(decodedToken.username !== room.player1.username && decodedToken.username !== room.player2.username){
            console.log(decodedToken.username, room.player1.username, room.player2.username);
            throw new Error("Unauthorized");
        }
        const move = room.game.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: piece[1].toLowerCase() ?? "q",
        });
        if (!move) {
            this.emit("invalid-move");
            return;
        }
        room.moveHistory.push({
            from: sourceSquare,
            to: targetSquare,
            promotion: piece[1].toLowerCase() ?? "q",
        });
        console.log('room', room);
        console.log('timeControl increment', room.timeControl.increment);
        room.turn === 1 ? room.time1 += +room.timeControl.increment*1000 : room.time2 += room.timeControl.increment*1000;
        room.turn === 1 ? room.turn = 2 : room.turn = 1;
        roomMap[roomId] = room;
        const opponent = room.player1.socketId === this.id ? room.player2 : room.player1;
        io.to(opponent.socketId).emit("move", moveData);
        if(room.interval === null){
            room.interval = setInterval(() => {
                if(room.turn === 1){
                    room.time1 -= 100;
                    if(room.time1 <= 0){
                        clearInterval(room.interval);
                        room.gameState = room.player1.username === decodedToken.username ? 0 : 1;
                        roomMap[roomId] = room;
                        const {ratingChange1, ratingChange2} = getRatingChanges(room.gameState, room.player1.rating, room.player2.rating);
                        io.to(room.player1.socketId).emit("result", {
                            result: room.player1.username === decodedToken.username ? 0 : 1,
                            message: "Time's up",
                            ratingChange: ratingChange1,
                            opponentRating: room.player2.rating + ratingChange2
                        });
                        io.to(room.player2.socketId).emit("result", {
                            result: room.player2.username === decodedToken.username ? 0 : 1,
                            message: "Time's up",
                            ratingChange: ratingChange2,
                            opponentRating: room.player1.rating + ratingChange1
                        });
                        processResult(room.player1.username === decodedToken.username ? 0 : 1, roomId);
                        client.hDel('userToRoom', room.player1.username).then(() => {
                            client.hDel('userToRoom', room.player2.username);
                        });
                        setTimeout(() => {
                            delete roomMap[roomId];
                            client.sRem('rooms', roomId);
                            io.off(`room-chat-${roomId}`);
                        }, 1000*300);
                    }
                }
                else{
                    room.time2 -= 100;
                    if(room.time2 <= 0){
                        clearInterval(room.interval);
                        room.gameState = room.player1.username === decodedToken.username ? 1 : 0;
                        roomMap[roomId] = room;
                        const {ratingChange1, ratingChange2} = getRatingChanges(room.gameState, room.player1.rating, room.player2.rating);
                        io.to(room.player1.socketId).emit("result", {
                            result: room.player1.username === decodedToken.username ? 1 : 0,
                            message: "Time's up",
                            ratingChange: ratingChange1,
                            opponentRating: room.player2.rating + ratingChange2
                        });
                        io.to(room.player2.socketId).emit("result", {
                            result: room.player2.username === decodedToken.username ? 1 : 0,
                            message: "Time's up",
                            ratingChange: ratingChange2,
                            opponentRating: room.player1.rating + ratingChange1
                        });
                        processResult(room.player1.username === decodedToken.username ? 1 : 0, roomId);
                        client.hDel('userToRoom', room.player1.username).then(() => {
                            client.hDel('userToRoom', room.player2.username);
                        });
                        setTimeout(() => {
                            delete roomMap[roomId];
                            client.sRem('rooms', roomId);
                            io.off(`room-chat-${roomId}`);
                        }, 1000*300);
                    }
                }
                io.to(room.player1.socketId).emit("timer-update", {
                    userTime: room.time1,
                    opponentTime: room.time2
                });
                io.to(room.player2.socketId).emit("timer-update", {
                    userTime: room.time2,
                    opponentTime: room.time1
                });
            }, 100);
        }
        if(room.game.game_over()){
            const {message, result} = checkGameState(room);
            const {ratingChange1, ratingChange2} = getRatingChanges(result, room.player1.rating, room.player2.rating);
            room.player1.rating += ratingChange1;
            room.player2.rating += ratingChange2;
            room.gameState = result;
            roomMap[roomId] = room;
            if(result === 0.5){
                io.to(room.player1.socketId).emit("result", {
                    result,
                    message,
                    ratingChange: ratingChange1,
                    opponentRating: room.player2.rating + ratingChange2
                });
                io.to(room.player2.socketId).emit("result", {
                    result,
                    message,
                    ratingChange: ratingChange2,
                    opponentRating: room.player1.rating + ratingChange1
                });
            }
            else{
                io.to(room.player1.socketId).emit("result", {
                    result,
                    message,
                    ratingChange: ratingChange1,
                    opponentRating: room.player2.rating + ratingChange2
                });
                io.to(room.player2.socketId).emit("result", {
                    result: 1 - result,
                    message,
                    ratingChange: ratingChange2,
                    opponentRating: room.player1.rating + ratingChange1
                });
            }
            clearInterval(room.interval);
            room.drawOfferExists = false; 
            processResult(result , roomId);
            client.hDel('userToRoom', room.player1.username).then(() => {
                client.hDel('userToRoom', room.player2.username);
            });
            setTimeout(() => {
                delete roomMap[roomId];
                client.sRem('rooms', roomId);
                io.off(`room-chat-${roomId}`);
            }, 1000*300);
        }
    } catch (error) {
        console.error("Error processing move:", error);
        this.emit("error", "Failed to process move");
    }
}

async function handleOfferDraw({ roomId, token }) {
    try {
        const room = roomMap[roomId];
        if (!room) {
            throw new Error("Room not found");
        }

        const decodedToken = jwtVerify(token);
        if (decodedToken.username !== room.player1.username && decodedToken.username !== room.player2.username) {
            throw new Error("Unauthorized");
        }

        if (!room.drawOfferExists) {
            room.drawOfferExists = true;
            room.drawOfferedBy = decodedToken.username;
            const opponent = room.player1.username === decodedToken.username ? room.player2.socketId : room.player1.socketId;
            io.to(opponent).emit("offer-draw");
        } else if (room.drawOfferedBy === decodedToken.username) {

        } else {
            const {ratingChange1, ratingChange2} = getRatingChanges(0.5, room.player1.rating, room.player2.rating);
            room.player1.rating += ratingChange1;
            room.player2.rating += ratingChange2;
            room.gameState = 0.5;
            roomMap[roomId] = room;
            io.to(room.player1.socketId).emit("result", {
                result: 0.5,
                message: 'Draw by agreement',
                ratingChange: ratingChange1,
                opponentRating: room.player2.rating + ratingChange2
            });
            io.to(room.player2.socketId).emit("result", {
                result: 0.5,
                message: 'Draw by agreement',
                ratingChange: ratingChange2,
                opponentRating: room.player1.rating + ratingChange1
            });
            room.drawOfferExists = false; // Reset the draw offer state
            clearInterval(room.interval);
            processResult(0.5 , roomId);
            client.hDel('userToRoom', room.player1.username).then(() => {
                client.hDel('userToRoom', room.player2.username);
            });
            setTimeout(() => {
                delete roomMap[roomId];
                client.sRem('rooms', roomId);
                io.off(`room-chat-${roomId}`);
            }, 1000*300);
        }

    } catch (error) {
        console.error("Error processing draw offer:", error);
        this.emit("error", "Failed to process draw offer");
    }
}



async function handleResign({ roomId, token }) {
    try {
        const room = roomMap[roomId];
        if (!room) {
            throw new Error("Room not found");
        }

        const decodedToken = jwtVerify(token);
        if (decodedToken.username !== room.player1.username && decodedToken.username !== room.player2.username) {
            throw new Error("Unauthorized");
        }

        const winner = room.player1.username === decodedToken.username ? room.player2.username : room.player1.username;

        room.gameState = room.player1.username === winner ? 1: 0;
        const {ratingChange1, ratingChange2} = getRatingChanges(room.gameState, room.player1.rating, room.player2.rating);
        room.player1.rating += ratingChange1;
        room.player2.rating += ratingChange2;
        roomMap[roomId] = room;
        console.log(room.player1.username, room.player2.username, winner);
        
        io.to(room.player1.socketId).emit("result" , {
            result: room.gameState,
            message: `${winner} wins by resignation`,
            ratingChange: ratingChange1,
            opponentRating: room.player2.rating + ratingChange2 
        });
        io.to(room.player2.socketId).emit("result" , {
            result: 1 - room.gameState,
            message: `${winner} wins by resignation`,
            ratingChange: ratingChange2,
            opponentRating: room.player1.rating + ratingChange1
        });

        processResult(room.player1.username === winner ? 1 : 0, roomId);
        clearInterval(room.interval);
        client.hDel('userToRoom', room.player1.username).then(() => {
            client.hDel('userToRoom', room.player2.username);
        });
        setTimeout(() => {
            delete roomMap[roomId];
            client.sRem('rooms', roomId);
            io.off(`room-chat-${roomId}`);
        }, 1000*300);
    } catch (error) {
        console.error("Error processing resignation:", error);
        this.emit("error", "Failed to process resignation");
    }
}

async function handleCreateChallengeFriend({ index, token }) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const username = decoded.username;
        const socketId = this.id;

        // Check if the user is already in a room
        const existingRoomId = await client.hGet('userToRoom', username);

        if (existingRoomId) {
            console.error(`User ${username} is already in room ${existingRoomId}`);
            this.emit("error-user-already-playing", {roomId: existingRoomId });
            return;
        }

        // Generate a unique challenge ID
        const challengeId = await generateUniqueId();

        // Create the challenge object
        const challenge = {
            index,
            username,
            socketId
        };

        // Store the challenge in a Redis hash using HSET
        await client.hSet('challenges', challengeId, JSON.stringify(challenge));

        console.log('Challenge created:', challengeId);

        // Emit an event to notify the client that the challenge was created
        this.emit("challenge-created", { challengeId, username });

    } catch (error) {
        console.error("Error creating challenge:", error);
        this.emit("error", "Failed to create challenge");
    }
}



async function handleDeleteChallenge({ challengeId, token }) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const username = decoded.username;

        // Function to delete the challenge from the Redis hashset
        async function deleteChallengeId(challengeId) {
            try {
                // Use HDEL to remove the challenge from the hashset
                await client.hDel('challenges', challengeId);
            } catch (err) {
                throw new Error('Error deleting challenge ID');
            }
        }

        await deleteChallengeId(challengeId);
        console.log('Challenge deleted:', challengeId);

        // Emit an event to notify the client that the challenge was deleted
        this.emit("challenge-deleted", { challengeId, username });

    } catch (error) {
        console.error("Error deleting challenge:", error);
        this.emit("error", "Failed to delete challenge");
    }
}


async function handleJoinChallenge({ challengeId, token }) {
    try {
        console.log('Joining challenge:', challengeId);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const username = decoded.username;

        // Check if the user is already in a room
        const existingRoomId = await client.hGet('userToRoom', username);

        if (existingRoomId) {
            console.error(`User ${username} is already in room ${existingRoomId}`);
            this.emit("error-user-already-playing", { roomId: existingRoomId });
            return;
        }

        // Check if the challengeId exists in the challenges hashset
        async function checkChallengeIdExists(challengeId) {
            try {
                const reply = await client.hExists('challenges', challengeId);
                console.log('reply', reply);
                return reply === true;
            } catch (err) {
                throw new Error('Error checking challenge ID existence');
            }
        }
 
        const challengeExists = await checkChallengeIdExists(challengeId);

        if (challengeExists) {
            // Retrieve the challenge from the challenges hashset
            const challenge = await client.hGet('challenges', challengeId);
            const parsedChallenge = JSON.parse(challenge);
            console.log(parsedChallenge);

            const username1 = parsedChallenge.username;
            const username2 = username;

            if (username1 === username2) {
                this.emit("error-join-challenge", "Cannot challenge yourself");
                return;
            }

            // Fetch user information from the database
            const user2 = await User.findOne({ where: { username: username2 } });
            const userinfo2 = await UserInfo.findOne({ where: { userId: user2.id } });
            user2.rating = userinfo2.rating;

            const user1 = await User.findOne({ where: { username: username1 } });
            const userinfo1 = await UserInfo.findOne({ where: { userId: user1.id } });
            user1.rating = userinfo1.rating;

            const player1 = {
                rating: user1.rating,
                username: username1,
                socketId: parsedChallenge.socketId,
            };

            const player2 = {
                rating: user2.rating,
                username: username2,
                socketId: this.id,
            };

            const roomId = challengeId; // Use challengeId as the roomId
            const color = Math.floor(Math.random() * 2);

            // CREATE ROOM
            const room = {
                timeControl: timeControls[parsedChallenge.index - 1],
                player1: player1,
                player2: player2,
                color: color,
                game: new Chess(),
                moveHistory: [],
                gameState: null,
                drawOfferExists: false,
                drawOfferedBy: null,
                time1: timeControls[parsedChallenge.index - 1].init * 60 * 1000,
                time2: timeControls[parsedChallenge.index - 1].init * 60 * 1000,
                interval: null,
                turn: color === 1 ? 1 : 2,
            };

            // Remove the challenge from the challenges hashset
            await client.hDel('challenges', challengeId);

            // Add the challengeId to the rooms set
            await client.sAdd('rooms', roomId);

            // Map usernames to roomId in a Redis hash
            await client.hSet('userToRoom', username1, roomId);
            await client.hSet('userToRoom', username2, roomId);

            roomMap[roomId] = room;
            io.to(player1.socketId).emit("match-found", { roomId });
            io.to(player2.socketId).emit("match-found", { roomId });
        } else {
            this.emit("error-join-challenge", "Challenge ID does not exist");
        }
    } catch (error) {
        console.error("Error joining challenge:", error);
        this.emit("error-join-challenge", "Failed to join challenge");
    }
}


function initializeSocket(server) {
    io = new Server(server, {
        cors: corsOptions,
    });

    io.on("connection", (socket) => {
        console.log('socket connected');
        const uuid = socket.handshake.query.uuid;
    
        client.sIsMember("connected-users", uuid)
            .then((isMember) => {
                if (!isMember) {
                    return client.sAdd("connected-users", uuid)
                        .then(() => client.incr("total-users"))
                        .then((totalUsers) => {
                            io.emit("live-user-count", totalUsers);
                            console.log(`Total users after connection: ${totalUsers}`);
                        });
                }
            })
            .catch((redisError) => {
                console.error("Error updating total-users in Redis:", redisError);
            });
    
        socket.on("global-chat", handleGlobalChat);
        socket.on("query-live-user-count", handleQueryLiveUserCount);


        socket.on("join-matchmaking", handleJoinMatchmaking);
        socket.on("leave-matchmaking", handleLeaveMatchmaking);


        socket.on("create-challenge-friend", handleCreateChallengeFriend);
        socket.on("delete-challenge", handleDeleteChallenge);
        socket.on("join-challenge", handleJoinChallenge);

        socket.on("get-game-data", handleGetGameData);
        socket.on("move", handleMove);
        socket.on('offer-draw', handleOfferDraw);   
        socket.on('resign', handleResign);

        socket.on("disconnect", handleDisconnect);
    });

    return io;
}

function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
}

module.exports = { initializeSocket, getIO };