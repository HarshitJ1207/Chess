const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('UserInfo', {
        userId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            onDelete: 'CASCADE',
            references: {
                model: 'Users',
                key: 'id'
            }
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
};