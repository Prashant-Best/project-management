const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app");

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "devflow";

if (!MONGO_URI) {
  console.error("MONGO_URI (or MONGO_URL) is missing in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    dbName: MONGO_DB_NAME,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log(`Connected to MongoDB (${MONGO_DB_NAME})`);
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
    console.error(
      "Check MongoDB Atlas Network Access whitelist and DB user credentials in .env."
    );
    process.exit(1);
  });
