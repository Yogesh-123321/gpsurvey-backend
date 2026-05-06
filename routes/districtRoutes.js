const express = require("express");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

const {
  protect,
} = require("../middleware/authMiddleware");

// ======================================================
// GET DISTRICTS
// ======================================================


// ======================================================
// GET GP FILES OF DISTRICT
// ======================================================

router.get(
  "/district/:district",
  protect,

  async (req, res) => {

    try {

      const district =
        req.params.district;

      const districtPath =
        path.join(
          __dirname,
          "..",
          "uploads",
          district
        );

      await fs.ensureDir(
        districtPath
      );

      const files =
        await fs.readdir(
          districtPath
        );

      const excelFiles =
        files.filter((file) =>
          file.endsWith(".xlsx")
        );

      res.json(excelFiles);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
      });
    }
  }
);

// ======================================================
// DOWNLOAD EXCEL FILE
// ======================================================

router.get(
  "/download/:district/:file",
  async (req, res) => {

    try {

      const district =
        req.params.district;

      const file =
        req.params.file;

      const filePath =
        path.join(
          __dirname,
          "..",
          "uploads",
          district,
          file
        );

      res.download(filePath);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
      });
    }
  }
);
const cloudinary = require("../config/cloudinary");

router.get("/gps", async (req, res) => {
  try {

    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "raw",
      prefix: "gp-survey/excel",
      max_results: 100,
    });

    const structured = {};

    result.resources.forEach((file) => {

      const publicId = file.public_id;

      const nameWithExt = publicId.split("/").pop();

      const cleanName = nameWithExt.replace(".xlsx", "");

      const parts = cleanName.split("_");

      const district = parts[0];
      const block = parts.slice(1).join("_");

      if (!structured[district]) {
        structured[district] = [];
      }

      structured[district].push({
        block,
        url: file.secure_url
      });
    });

    res.json(structured);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});
module.exports = router;