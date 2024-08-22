const { Server } = require('socket.io');
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

const jwtVerify = (token, id) =>{
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    return decodedToken.userId === id;

};

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

async function matchPlayers(index) {
    const queueKey = `matchmaking-queue-${index}`;

    try {
        const players = await client.zRange(queueKey, 0, -1);
        for (let i = 0; i < players.length - 1; i++) {
            const player1 = JSON.parse(players[i]);
            const player2 = JSON.parse(players[i + 1]);

            // Assuming player1 and player2 have similar ratings
            // Create a room for these players
            const roomId = `${player1.username}-${player2.username}`;
            roomMap[roomId] = {
                timeControl: timeControls[index - 1],
                player1: player1,
                player2: player2,
                color: Math.floor(Math.random() * 2),
                game: new Chess(),
                moveHistory: [],
            };
            console.log(
                `Room created: ${roomId} with players ${player1.socketId} and ${player2.socketId}`
            );
            io.to(player1.socketId).emit("match-found", {
                roomId,
            });
            io.to(player2.socketId).emit("match-found", {
                roomId,
            });

            // Remove matched players from the queue
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

function initializeSocket(server) {
    io = new Server(server, {
        cors: corsOptions,
    });

    io.on("connection", (socket) => {
        console.log('socket connected');
        const uuid = socket.handshake.query.uuid;

        if (!connectedUsers.has(uuid)) {
            connectedUsers.add(uuid);

            client
                .incr("total-users")
                .then((totalUsers) => {
                    io.emit("live-user-count", totalUsers);
                    console.log(`Total users after connection: ${totalUsers}`);
                })
                .catch((redisError) => {
                    console.error("Error updating total-users in Redis:", redisError);
                });
        }

        socket.on("global-chat", (message) => {
            console.log(`Message received: ${message}`);
            socket.broadcast.emit("global-chat", message);
        });

        socket.on("query-live-user-count", () => {
            console.log("Querying live user count");
            client
                .get("total-users")
                .then((totalUsers) => {
                    socket.emit("live-user-count", totalUsers);
                })
                .catch((redisError) => {
                    console.error("Error getting total-users from Redis:", redisError);
                });
        });

        socket.on("join-matchmaking", async ({ index, token }) => {
            try {
                // Verify the token
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
                    socketId: socket.id,
                };
                const queueKey = `matchmaking-queue-${index}`;

                // Add player to the appropriate matchmaking queue
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
                socket.emit("error", "Failed to join matchmaking");
            }
        });

        socket.on("leave-matchmaking", async ({ index, token }) => {
            try {
                // Verify the token
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
                    socketId: socket.id,
                };
                const queueKey = `matchmaking-queue-${index}`;

                // Remove player from the appropriate matchmaking queue
                await client.zRem(queueKey, JSON.stringify(player));
                console.log(
                    `Player removed from matchmaking queue ${queueKey}: ${JSON.stringify(player)}`
                );
                socket.emit("success", "Left matchmaking successfully");
            } catch (error) {
                console.error("Error leaving matchmaking:", error);
                socket.emit("error", "Failed to leave matchmaking");
            }
        });

        socket.on("disconnect", () => {
            try {
                // Check if there are any other sockets connected with the same uuid
                const sockets = Array.from(io.sockets.sockets.values());
                const userSockets = sockets.filter((s) => s.handshake.query.uuid === uuid);

                if (userSockets.length === 0) {
                    connectedUsers.delete(uuid);

                    client
                        .decr("total-users")
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
        });

        socket.on("get-game-data", async ({ token, roomId }) => {
            try {
                const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
                const userId = decodedToken.userId;
                const user = await User.findOne({ where: { id: userId } });
                const username = user.username;
                const room = roomMap[roomId];
                if (!room) {
                    socket.emit("error", "Room not found");
                    return;
                }
                if (username != room.player1.username && username != room.player2.username) {
                    socket.emit("error", "Unauthorized");
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
                    };
                    room.player1.socketId = socket.id;
                    socket.emit("get-game-data", gameData);
                    console.log("game data sent", gameData);
                } else if (username === room.player2.username) {
                    const gameData = {
                        color: 1 - room.color,
                        opponentInfo: room.player1,
                        userInfo: room.player2,
                        timeControl: room.timeControl,
                        moveHistory: room.moveHistory,
                    };
                    socket.emit("get-game-data", gameData);
                    room.player2.socketId = socket.id;
                    console.log("game data sent", gameData);
                }
            } catch (error) {
                console.error("Error getting game data:", error);
                socket.emit("error", "Failed to get game data");
            }
        });


        
        socket.on("move", async ({ moveData, roomId }) => {
            try {
                const { sourceSquare, targetSquare, piece } = moveData;
                const room = roomMap[roomId];
                if (!room) {
                    socket.emit("error", "Room not found");
                    return;
                }
                const move = room.game.move({
                    from: sourceSquare,
                    to: targetSquare,
                    promotion: piece[1].toLowerCase() ?? "q",
                });
                if (!move) {
                    socket.emit("invalid-move");
                    return;
                }
                room.moveHistory.push({
                    from: sourceSquare,
                    to: targetSquare,
                    promotion: piece[1].toLowerCase() ?? "q",
                });
                roomMap[roomId] = room;
                const opponent = room.player1.socketId === socket.id ? room.player2 : room.player1;
                io.to(opponent.socketId).emit("move", moveData);
            } catch (error) {
                console.error("Error processing move:", error);
                socket.emit("error", "Failed to process move");
            }
        });
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