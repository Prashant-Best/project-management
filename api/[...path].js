const { createRequire } = require("module");
const path = require("path");
const app = require("../server/app");

const serverRequire = createRequire(path.join(__dirname, "../server/package.json"));
const mongoose = serverRequire("mongoose");

let connectionPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
    const dbName = process.env.MONGO_DB_NAME || "devflow";

    if (!mongoUri) {
      throw new Error("MONGO_URI (or MONGO_URL) is missing");
    }

    connectionPromise = mongoose.connect(mongoUri, {
      dbName,
      serverSelectionTimeoutMS: 10000,
    });
  }

  return connectionPromise;
}

module.exports = async (req, res) => {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (error) {
    console.error("Serverless API error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to initialize API",
    });
  }
};
