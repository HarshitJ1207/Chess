const { DataTypes } = require('sequelize');

// Define the UserInfo model but don't associate it with Sequelize or User yet
const UserInfo = (sequelize) => sequelize.define('UserInfo', {
    userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        onDelete: 'CASCADE'
    },
    rating: {
        type: DataTypes.INTEGER,
        defaultValue: 1000
    },
    wins: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    losses: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    draws: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

module.exports = UserInfo;