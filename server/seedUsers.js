const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const User = require("./models/user");

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "devflow";

const users = [
  { name: "Prashant", email: "prashantpanwar@gmail.com", password: "12345678", role: "management" },
  { name: "Aman", email: "aman@gmail.com", password: "87654321", role: "team_member" },
];

async function seedUsers() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI (or MONGO_URL) is missing in .env");
    }

    await mongoose.connect(MONGO_URI, {
      dbName: MONGO_DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`Connected to MongoDB (${MONGO_DB_NAME})`);

    const hashedUsers = await Promise.all(
      users.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10),
      }))
    );

    await User.deleteMany({ email: { $in: hashedUsers.map((user) => user.email) } });
    await User.insertMany(hashedUsers);
    console.log("Sample users added");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    console.error(
      "Check MongoDB Atlas Network Access whitelist and DB user credentials in .env."
    );
  } finally {
    await mongoose.disconnect();
  }
}

seedUsers();
