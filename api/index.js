import dotenv from "dotenv";
dotenv.config();

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

// ─── API: AI Recommendations (Gemini) ───────────────────
app.post("/api/recommend", async (req, res) => {
  const { city, people, travelType, budget, skip } = req.body;

  if (!city) return res.status(400).json({ error: "City is required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = skip
    ? `You are a world-class travel guide. Suggest 6 must-visit places in ${city}.
For each place provide: name, a one-line description, estimated visit duration (e.g. "1-2 hours"), estimated cost per person in USD (use 0 if free), and category (one of: Museum, Food, Nature, Shopping, Landmark, Entertainment).
Respond ONLY with a valid JSON array. No markdown, no backticks, no explanation.
Format: [{"name":"...","description":"...","duration":"...","cost":0,"category":"..."}]`
    : `You are a world-class travel guide. Suggest 6 places in ${city} tailored for:
- Group: ${people || "unspecified"}
- Style: ${travelType || "mixed"}
- Budget: ${budget || "moderate"}
For each place provide: name, a one-line description, estimated visit duration (e.g. "1-2 hours"), estimated cost per person in USD (use 0 if free), and category (one of: Museum, Food, Nature, Shopping, Landmark, Entertainment).
Respond ONLY with a valid JSON array. No markdown, no backticks, no explanation.
Format: [{"name":"...","description":"...","duration":"...","cost":0,"category":"..."}]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json|```/g, "").trim();
    const suggestions = JSON.parse(text);
    return res.json({ suggestions });
  } catch (err) {
    console.error("Gemini error:", err.message);
    return res.status(500).json({ error: "Failed to get recommendations" });
  }
});

// ─── Start (local dev only) ──────────────────────────────
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`WanderPlan running → http://localhost:${PORT}`));
}

export default app;
