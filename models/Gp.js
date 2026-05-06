import mongoose from "mongoose";

const gpSchema = new mongoose.Schema(
  {
    district: { type: String, required: true },
    block: { type: String, required: true },
    gpName: { type: String, required: true },

    lat: Number,
    lon: Number,

    photos: [String],   // Cloudinary URLs
    kmzUrl: String,     // GP-level KMZ
  },
  { timestamps: true }
);

export default mongoose.model("GP", gpSchema);