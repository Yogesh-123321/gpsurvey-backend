const User = require("../models/User");
const bcrypt = require("bcryptjs");


// ======================================================
// GET ALL USERS
// ======================================================

exports.getAllUsers = async (
  req,
  res
) => {

  try {

    const users =
      await User.find()
        .select("-password")
        .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });

  } catch (error) {

    console.log(
      "Get Users Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// ======================================================
// UPDATE USER
// ======================================================

exports.updateUser = async (
  req,
  res
) => {

  try {

    const userId =
      req.params.id;

    const {
      name,
      email,
      password,
      role,
      district,
      assignedBlocks,
    } = req.body;

    // Find user
    const user =
      await User.findById(userId);

    if (!user) {

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update fields
    if (name !== undefined) {
      user.name = name;
    }

    if (email !== undefined) {
      user.email = email;
    }

    if (role !== undefined) {
      user.role = role;
    }

    if (district !== undefined) {
      user.district = district;
    }

    // Update assigned blocks
    if (assignedBlocks !== undefined) {

      user.assignedBlocks =
        assignedBlocks;
    }

    // Update password
    if (
      password &&
      password.trim() !== ""
    ) {

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      user.password =
        hashedPassword;
    }

    await user.save();

   const updatedUser =
  await User.findById(userId)
    .select("-password");

res.json({
  success: true,
  message:
    "User updated successfully",
  user: updatedUser,
});

  } catch (error) {

    console.log(
      "Update User Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};