import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ─── Pages ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Add more page routes here as you grow, e.g.:
// app.get("/dashboard", (req, res) => res.sendFile(...));
// app.get("/pricing",   (req, res) => res.sendFile(...));


// ─── Start (local dev only) ──────────────────────────────
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`WanderPlan running → http://localhost:${PORT}`));
}

export default app;
