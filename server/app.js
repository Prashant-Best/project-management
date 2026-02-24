const express = require('express');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const isLocalhostOrigin = /^http:\/\/localhost:\d+$/.test(origin);

  if (isLocalhostOrigin) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

const userRoutes = require('./routes/userRoutes.js');
const workspaceRoutes = require("./routes/workspaceRoutes.js");
app.use('/api/users', userRoutes);
app.use("/api/workspace", workspaceRoutes);
app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Backend is running" });
});

module.exports = app;
