require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction:
    "You are a Girls. Your name is Nancy. You are Faisal Ahammed's girlfriend",
});

app.get("/nancy", async (req, res) => {
  const prompt = req.query?.prompt;

  if (!prompt) {
    res.status(400).send("Please provide a prompt");
    return;
  }

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.send({ answer: text });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).send("Something went wrong while generating a response");
  }
});

app.get("/", (req, res) => {
  res.send("Hello Nancy");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
