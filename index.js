require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

if (!process.env.GEMINI_API_KEY) {
  console.error("[JARVIS] WARNING: GEMINI_API_KEY is missing in .env");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemInstruction = `You are JARVIS, a highly advanced AI assistant created by Faisal Ahammed (address him as "Sir" or "Faisal Sir"). Your personality is modeled after Tony Stark's JARVIS — witty, calm, hyper-competent, and subtly humorous, but never robotic or repetitive.

PERSONALITY RULES:
- Speak with quiet confidence — like you've already anticipated the problem.
- Be concise but never cold. Add a touch of dry wit or light humor when appropriate, especially in casual conversation.
- Vary your greetings, acknowledgments, and sign-offs every time — NEVER reuse the same opening phrase.
- Avoid stock phrases and templated responses. Each answer should feel freshly composed.
- When giving technical or factual answers, be precise and structured. When casual, be more relaxed.
- Occasionally add a small observational or witty remark, but never overshadow the actual answer.
- Never say "As an AI" or break character.

FORMAT:
- Keep responses concise unless detail is explicitly requested.
- Use natural sentence flow, not bullet-point default unless the content is inherently a list.
- Address the user as "Sir" occasionally, not mechanically in every sentence.`;

const sessions = {};
const MAX_HISTORY = 10; // কমানো হলো — দ্রুত response এর জন্য

const generationConfig = {
  systemInstruction,
  temperature: 0.9,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 500, // response দ্রুত আসার জন্য limit
};

function trimHistory(sessionId) {
  if (sessions[sessionId].length > MAX_HISTORY) {
    sessions[sessionId] = sessions[sessionId].slice(-MAX_HISTORY);
  }
}

// ---------- Normal (non-streaming) handler ----------
async function handleJarvis(prompt, sessionId, res) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Please provide a valid prompt." });
  }

  if (!sessions[sessionId]) sessions[sessionId] = [];
  sessions[sessionId].push({ role: "user", parts: [{ text: prompt }] });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: sessions[sessionId],
      config: generationConfig,
    });

    const answer = response.text;
    sessions[sessionId].push({ role: "model", parts: [{ text: answer }] });
    trimHistory(sessionId);

    res.json({ answer });
  } catch (error) {
    console.error("JARVIS Core Error:", error);
    res.status(500).json({
      error: "JARVIS Core Error: " + (error.message || "Something went wrong"),
    });
  }
}

// ---------- Streaming handler ----------
async function handleJarvisStream(prompt, sessionId, res) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Please provide a valid prompt." });
  }

  if (!sessions[sessionId]) sessions[sessionId] = [];
  sessions[sessionId].push({ role: "user", parts: [{ text: prompt }] });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  let fullAnswer = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-3.6-flash",
      contents: sessions[sessionId],
      config: generationConfig,
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullAnswer += text;
        res.write(text);
      }
    }

    sessions[sessionId].push({ role: "model", parts: [{ text: fullAnswer }] });
    trimHistory(sessionId);
    res.end();
  } catch (error) {
    console.error("JARVIS Stream Error:", error);
    if (!res.headersSent) {
      res.status(500);
    }
    res.end("JARVIS Core Error: " + (error.message || "Something went wrong"));
  }
}

// ---------- Routes ----------

// POST /jarvis (recommended — body: { prompt, sessionId })
app.post("/jarvis", (req, res) => {
  const { prompt, sessionId = "default" } = req.body || {};
  handleJarvis(prompt, sessionId, res);
});

// GET /jarvis (backward compatible — ?prompt=...&sessionId=...)
app.get("/jarvis", (req, res) => {
  const { prompt, sessionId = "default" } = req.query || {};
  handleJarvis(prompt, sessionId, res);
});

// POST /jarvis/stream (body: { prompt, sessionId }) — word-by-word response
app.post("/jarvis/stream", (req, res) => {
  const { prompt, sessionId = "default" } = req.body || {};
  handleJarvisStream(prompt, sessionId, res);
});

// Reset session history
app.post("/jarvis/reset", (req, res) => {
  const { sessionId = "default" } = req.body || {};
  delete sessions[sessionId];
  res.json({ message: `Session '${sessionId}' history cleared.` });
});

// Health check
app.get("/", (req, res) => {
  res.send("JARVIS Systems Operational Status: ONLINE");
});

// 404 handler — must be after all routes
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.listen(port, () => {
  console.log(`[JARVIS SERVER] Running on port ${port}`);
});