const jwt = require("jsonwebtoken");
const User = require("../models/User");


// PROTECT ROUTES
exports.protect = async (req, res, next) => {
  try {

    let token;

    // Get token from header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // No token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Attach user
    req.user = await User.findById(decoded.id)
      .select("-password");

    next();

  } catch (error) {

    console.log("Auth Error:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};


// ROLE AUTHORIZATION
exports.authorize = (...roles) => {
  return (req, res, next) => {

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  };
};