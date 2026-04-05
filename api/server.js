import express from "express";
import handler from "./commute-report.js";

const app = express();

app.get("/api/commute-report", (req, res) => {
  handler(req, res);
});

app.listen(8000, () => {
  console.log("API server running on http://localhost:8000");
});