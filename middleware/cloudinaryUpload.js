const multer = require("multer");
const { CloudinaryStorage } =
  require("multer-storage-cloudinary");

const cloudinary =
  require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "gp-survey",

    resource_type: "raw", // ✅ CRITICAL FIX

    allowed_formats: ["jpg", "png", "jpeg"],

    public_id: (req, file) => {
      return Date.now() + "-" + file.originalname;
    },
  },
});
const upload =
  multer({ storage });

module.exports = upload;