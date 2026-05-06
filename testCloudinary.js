require("dotenv").config();

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

async function testUpload() {
  try {

    const result =
      await cloudinary.uploader.upload(
        "https://res.cloudinary.com/demo/image/upload/sample.jpg"
      );

    console.log("UPLOAD SUCCESS:");
    console.log(result.secure_url);

  } catch (error) {

    console.error("UPLOAD FAILED:");
    console.error(error);
  }
}

testUpload();