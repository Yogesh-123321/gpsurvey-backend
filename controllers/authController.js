const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// GENERATE JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    }
  );
};


// LOGIN
exports.login = async (req, res) => {
  try {

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  district: user.district,
  assignedBlocks:
      user.assignedBlocks || [],
},
    });

  } catch (error) {

    console.log("Login Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// CREATE USER
exports.createUser = async (req, res) => {
  try {

    const {
      name,
      email,
      password,
      role,
      district,
    } = req.body;

    // Existing user check
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      district,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            district: user.district,
            assignedBlocks:
                user.assignedBlocks || [],
        },
    });

  } catch (error) {

    console.log("Create User Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};