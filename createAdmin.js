require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI);

const createAdmin = async () => {
  try {

    const hashedPassword = await bcrypt.hash("admin123", 10);

    const admin = new User({
      name: "Admin",
      email: "admin@gpsurvey.com",
      password: hashedPassword,
      role: "ADMIN",
    });

    await admin.save();

    console.log("Admin created");

    process.exit();

  } catch (error) {
    console.log(error);
    process.exit();
  }
};

createAdmin();