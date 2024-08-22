const express = require("express");
const router = express.Router();
const controller = require("../controllers/controller");
const sequelize = require('../config/db');
const User = require("../models/User")(sequelize);
const UserInfo = require("../models/UserInfo")(sequelize);
const { check } = require("express-validator");

router.post("/signup", [
    check("username")
        .customSanitizer(value => value.trim())
        .isLength({ min: 6 })
        .withMessage("Username must be at least 6 characters long")
        .custom(async (value) => { 
            try {
                console.log(User);
                const existingUser = await User.findOne({
                    where: { username: value.trim().toLowerCase()} 
                });
                if (existingUser) {
                    throw new Error("Username already exists");
                }
                return true; 
            } catch (error) {
                throw error; 
            }
        }),
    check("password").custom((value) => {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{4,12}$/;
        if (!passwordRegex.test(value)) {
            throw new Error(
                "Password must contain at least one letter, one number, and be between 4 and 12 characters long" 
            );
        }
        return true;
    }),
    check("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Passwords do not match");
        }
        return true;
    }),
    check("email")
        .customSanitizer(value => value.trim().toLowerCase())
        .isEmail()
        .withMessage("Invalid email format")
        .custom(async (value) => {
            try {
                const existingUser = await User.findOne({ 
                    where: { email: value.trim().toLowerCase() } 
                });
        
                if (existingUser) {
                    throw new Error("Email already exists");
                }
                return true;
            } catch (error) {
                throw error; 
            }
        })

], controller.signup);
router.post("/login", controller.login);
router.get("/jwt-verify", controller.jwtVerify);
module.exports = router;
