const sequelize = require('../config/db'); // Adjust the path to your sequelize instance
const UserModel = require('./User');
const UserInfoModel = require('./UserInfo');

const User = UserModel(sequelize);
const UserInfo = UserInfoModel(sequelize);

// Set up associations
User.hasOne(UserInfo, { foreignKey: "userId" });
UserInfo.belongsTo(User, { foreignKey: "userId" });

// Sync the models with the database
sequelize.sync()
    .then(() => {
        console.log("Database & tables created!");
    })
    .catch((err) => {
        console.error("Unable to sync database:", err);
    });
 
module.exports = {
    User,
    UserInfo,
    sequelize,
};