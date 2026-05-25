require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const districtRoutes =
  require("./routes/districtRoutes");
const userRoutes =
  require("./routes/userRoutes");
const app = express();
const cloudinary = require("cloudinary").v2;
const AdmZip = require("adm-zip");
const axios = require("axios");
const ExifParser = require("exif-parser");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});
// ======================================================
// MONGODB CONNECTION
// ======================================================

mongoose.connect(process.env.MONGO_URI)

  .then(() => {

    console.log(
      "MongoDB Connected"
    );
  })

  .catch((error) => {

    console.error(error);
  });

// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// ROUTES
// ======================================================
app.use("/api/users", userRoutes);
app.use("/api", districtRoutes);
app.use("/api/auth", authRoutes);
// ======================================================

const PORT = 4000;

// ======================================================
// MULTER STORAGE
// ======================================================
// ===============================
// HELPER: DOWNLOAD FILE FROM URL
// ===============================
async function downloadFile(url, outputPath) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}
// ===============================
// EXTRACT GPS FROM IMAGE URL
// ===============================
async function getGPSFromImage(url) {
  try {
    // 🔥 FIX: get original image (with EXIF)
    const originalUrl = url.replace("/upload/", "/upload/fl_attachment/");

    const response = await axios.get(originalUrl, {
      responseType: "arraybuffer",
    });

    const parser = ExifParser.create(response.data);
    const result = parser.parse();

// 🔥 ADD THIS LINE HERE
console.log("ALL EXIF TAGS:", result.tags);

    const lat = result.tags.GPSLatitude;
    const lon = result.tags.GPSLongitude;

    console.log("EXIF GPS:", lat, lon); // debug

    if (!lat || !lon) {
      console.log("No EXIF GPS in:", url);
      return null;
    }

    return { lat, lon };

  } catch (err) {
    console.error("EXIF read failed:", err.message);
    return null;
  }
}
const { CloudinaryStorage } =
  require("multer-storage-cloudinary");

const storage =
  new CloudinaryStorage({

    cloudinary,

    params: {

      folder: "gp-survey/photos",
 resource_type: "image",   // ✅ ADD THIS
      allowed_formats: [
        "jpg",
        "jpeg",
        "png"
      ],

      public_id: (req, file) => {
        return (
          Date.now() +
          "-" +
          file.originalname
        );
      },
    },
  });

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024 // ✅ 10MB per image
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"), false);
    }
  }
});

// ======================================================
// SUBMIT FORM
// ======================================================

app.post("/api/submit-form", (req, res) => {

  upload.array("photos", 20)(req, res, async function (err) {

    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }

    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {

      // ===============================
      // FILES + DATA
      // ===============================
      const photoUrls = req.files.map(file => file.path);
      const data = req.body;

      // ===============================
      // BUILD KMZ POINTS USING EXIF
      // ===============================
      const kmzPoints = [];

      for (const url of photoUrls) {
        const gps = await getGPSFromImage(url);

        if (gps) {
          kmzPoints.push({
            url,
            lat: gps.lat,
            lon: gps.lon
          });
        }
      }

      const kmlContent = generateKML(kmzPoints);
      const kmzPath = path.join(__dirname, "output.kmz");

      createKMZ(kmlContent, kmzPath);

      // ===============================
      // SAFE NAMES
      // ===============================
      const safeDistrict = (data.district || "Unknown")
        .replace(/[^a-zA-Z0-9]/g, "_");

      const safeBlock = (data.blockName || "Unknown")
        .replace(/[^a-zA-Z0-9]/g, "_");

      const safeGpName = (data.gpName || "Unknown")
        .replace(/[^a-zA-Z0-9]/g, "_");

      // ===============================
      // UPLOAD KMZ
      // ===============================
      const kmzUpload = await cloudinary.uploader.upload(
        kmzPath,
        {
          resource_type: "raw",
          folder: "gp-survey/kmz",
          public_id: `${safeDistrict}_${safeBlock}_${Date.now()}`
        }
      );

      const kmzUrl = kmzUpload.secure_url;
      await fs.remove(kmzPath);

      // ===============================
      // TEMP EXCEL PATH
      // ===============================
      const excelFilePath = path.join(
        __dirname,
        `${safeDistrict}_${safeBlock}.xlsx`
      );

      const workbook = new ExcelJS.Workbook();
      let worksheet;

      // ===============================
      // CHECK EXISTING EXCEL ON CLOUDINARY
      // ===============================
      const publicId = `gp-survey/excel/${safeDistrict}_${safeBlock}.xlsx`;
      let existingFileUrl = null;

     try {
  console.log("Checking existing file:", publicId);

  const resource = await cloudinary.api.resource(publicId, {
    resource_type: "raw",
  });

  console.log("FOUND existing Excel!");

  existingFileUrl = resource.secure_url;

} catch (err) {
  console.log("NO existing Excel found → creating new");

}

      // ===============================
      // LOAD EXISTING OR CREATE NEW
      // ===============================
      if (existingFileUrl) {

        await downloadFile(existingFileUrl, excelFilePath);

        await workbook.xlsx.readFile(excelFilePath);

        worksheet = workbook.getWorksheet("Survey Data");

// 🔥 CRITICAL FIX
if (!worksheet) {
  console.log("Sheet missing → recreating");

  worksheet = workbook.addWorksheet("Survey Data");

  worksheet.columns = [
    { header: "Timestamp", key: "Timestamp", width: 22 },
    { header: "District", key: "District", width: 18 },
    { header: "Block Name", key: "BlockName", width: 20 },
    { header: "GP Name", key: "GPName", width: 28 },
    { header: "GP As Per KMZ", key: "GPAsPerKMZ", width: 18 },
    { header: "Original Location", key: "OriginalLocation", width: 24 },
    { header: "Original Infra Status", key: "OriginalInfraStatus", width: 22 },
    { header: "PS Bhawan Availability", key: "PSBhawanAvailability", width: 22 },
    { header: "PS Bhawan Infra", key: "PSBhawanInfra", width: 18 },
    { header: "Electricity Meter At PS", key: "ElectricityMeterAtPS", width: 24 },
    { header: "Other Gov Building", key: "OtherGovBuilding", width: 24 },
    { header: "Proposed Location", key: "ProposedLocation", width: 24 },
    { header: "Rack Space Availability", key: "RackSpaceAvailability", width: 22 },
    { header: "Electricity Meter At Proposed", key: "ElectricityMeterAtProposed", width: 28 },
    { header: "Electricity Supply Hours", key: "ElectricitySupplyHours", width: 22 },
    { header: "Coordinates", key: "Coordinates", width: 28 },
    { header: "Mukhiya Mobile", key: "MukhiyaMobile", width: 20 },
    { header: "Mukhiya Name", key: "MukhiyaName", width: 22 },
    { header: "Remarks", key: "Remarks", width: 28 },
    { header: "Photos", key: "Photos", width: 40 },
    { header: "KMZ File", key: "KMZ", width: 30 },
  ];
}

// 🔍 DEBUG (VERY IMPORTANT)
console.log("Row count before add:", worksheet.rowCount);

      } else {

        worksheet = workbook.addWorksheet("Survey Data");

        worksheet.columns = [
          { header: "Timestamp", key: "Timestamp", width: 22 },
          { header: "District", key: "District", width: 18 },
          { header: "Block Name", key: "BlockName", width: 20 },
          { header: "GP Name", key: "GPName", width: 28 },
          { header: "GP As Per KMZ", key: "GPAsPerKMZ", width: 18 },
          { header: "Original Location", key: "OriginalLocation", width: 24 },
          { header: "Original Infra Status", key: "OriginalInfraStatus", width: 22 },
          { header: "PS Bhawan Availability", key: "PSBhawanAvailability", width: 22 },
          { header: "PS Bhawan Infra", key: "PSBhawanInfra", width: 18 },
          { header: "Electricity Meter At PS", key: "ElectricityMeterAtPS", width: 24 },
          { header: "Other Gov Building", key: "OtherGovBuilding", width: 24 },
          { header: "Proposed Location", key: "ProposedLocation", width: 24 },
          { header: "Rack Space Availability", key: "RackSpaceAvailability", width: 22 },
          { header: "Electricity Meter At Proposed", key: "ElectricityMeterAtProposed", width: 28 },
          { header: "Electricity Supply Hours", key: "ElectricitySupplyHours", width: 22 },
          { header: "Coordinates", key: "Coordinates", width: 28 },
          { header: "Mukhiya Mobile", key: "MukhiyaMobile", width: 20 },
          { header: "Mukhiya Name", key: "MukhiyaName", width: 22 },
          { header: "Remarks", key: "Remarks", width: 28 },
          { header: "Photos", key: "Photos", width: 40 },
          { header: "KMZ File", key: "KMZ", width: 30 },
        ];
      }

      // ===============================
      // ADD NEW ROW
      // ===============================
     const now = new Date();

const formattedTimestamp =
  new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

worksheet.addRow([
  formattedTimestamp,
  data.district || "",
  data.blockName || "",
  data.gpName || "",
  data.gpAsPerKmz || "",
  data.originalLocation || "",
  data.originalInfraStatus || "",
  data.psBhawanAvailability || "",
  data.psBhawanInfra || "",
  data.electricityMeterAtPs || "",
  data.otherGovBuilding || "",
  data.proposedLocation || "",
  data.rackSpaceAvailability || "",
  data.electricityMeterAtProposed || "",
  data.electricitySupplyHours || "",
  data.coordinates || "",
  data.mukhiyaMobile || "",
  data.mukhiyaName || "",
  data.remarks || "",

  // ✅ Photo (simple link)
  photoUrls[0] || "",

  // ✅ KMZ clickable link
  { text: "Open KMZ", hyperlink: kmzUrl }
]);
console.log("Row count AFTER add:", worksheet.rowCount);

      // ===============================
      // SAVE TEMP FILE
      // ===============================
      await workbook.xlsx.writeFile(excelFilePath);

      // ===============================
      // UPLOAD (OVERWRITE)
      // ===============================
      const result = await cloudinary.uploader.upload(
        excelFilePath,
        {
          resource_type: "raw",
          folder: "gp-survey/excel",
          public_id: `${safeDistrict}_${safeBlock}.xlsx`,
           overwrite: true,
    invalidate: true
        }
      );

      const excelUrl = result.secure_url;

      // ===============================
      // DELETE TEMP FILE
      // ===============================
      await fs.remove(excelFilePath);

      // ===============================
      // RESPONSE
      // ===============================
      res.json({
        success: true,
        message: "Form submitted successfully",
        excelUrl,
        kmzUrl
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }

  });

});

// ======================================================
// STATIC FILES
// ======================================================

app.use(
  "/uploads",

  express.static(
    path.join(
      __dirname,
      "uploads"
    )
  )
);

// ======================================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `Server running on port ${PORT}`
  );
});
function generateKML(points) {

  let kml = `
  <kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
  `;

  points.forEach((p, i) => {

    kml += `
      <Placemark>
        <name>Photo ${i + 1}</name>
        <description><![CDATA[
          <img src="${p.url}" width="300"/>
        ]]></description>
        <Point>
          <coordinates>${p.lon},${p.lat},0</coordinates>
        </Point>
      </Placemark>
    `;
  });

  kml += `
  </Document>
  </kml>
  `;

  return kml;
}

// ===============================
// CREATE KMZ
// ===============================
function createKMZ(kmlContent, filePath) {

  const zip = new AdmZip();

  zip.addFile("doc.kml", Buffer.from(kmlContent, "utf-8"));

  zip.writeZip(filePath);
}
app.get("/test-kmz", async (req, res) => {

  const testPhotos = [
    {
      url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      lat: 28.2994,
      lon: 77.2337
    },
    {
      url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      lat: 28.3000,
      lon: 77.2350
    }
  ];

  const kml = generateKML(testPhotos);

  const filePath = path.join(__dirname, "test.kmz");

  createKMZ(kml, filePath);

  res.download(filePath);
});
app.get("/api/structure", async (req, res) => {
  try {

    const basePath = path.join(__dirname, "uploads");

    const districts = await fs.readdir(basePath);

    const result = [];

    for (const district of districts) {

      const districtPath = path.join(basePath, district);

      const stat = await fs.stat(districtPath);
      if (!stat.isDirectory()) continue;

      const blocks = await fs.readdir(districtPath);

      const blockList = [];

      for (const file of blocks) {

        if (!file.endsWith(".xlsx")) continue;

        const blockName = file.replace(".xlsx", "");

        blockList.push({
          block: blockName,
          excel: `gp-survey/excel/${district}_${blockName}`
        });
      }

      result.push({
        district,
        blocks: blockList
      });
    }

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load structure" });
  }
});