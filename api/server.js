import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./commute-report.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Serve API
app.get("/api/commute-report", (req, res) => {
  handler(req, res);
});

// Serve frontend build
app.use(express.static(join(__dirname, "../dist")));

// All other routes serve the frontend (Express 5 compatible)
app.get("/{*splat}", (req, res) => {
  res.sendFile(join(__dirname, "../dist/index.html"));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});