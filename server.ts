import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const PORT = 3000;

// =========================================================================
// GEMINI API KEY CONFIGURATION
// Active keys are loaded from gemini_key.json (in .gitignore) or environment
// variables to prevent GitHub Secret Scanning Push Protection errors.
// =========================================================================
export const HARDCODED_GEMINI_API_KEY = "";

function getApiKey(): string {
  try {
    const keyFilePath = path.join(process.cwd(), "gemini_key.json");
    if (fs.existsSync(keyFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(keyFilePath, "utf-8"));
      if (parsed.key && typeof parsed.key === "string" && parsed.key.trim()) {
        return parsed.key.trim();
      }
    }
  } catch (err) {
    // ignore
  }

  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey && envKey !== "PLACEHOLDER_API_KEY" && !envKey.startsWith("AIzaSyBEqysd")) {
    return envKey;
  }
  if (HARDCODED_GEMINI_API_KEY?.trim() && !HARDCODED_GEMINI_API_KEY.startsWith("AIzaSyBEqysd")) {
    return HARDCODED_GEMINI_API_KEY.trim();
  }
  return "";
}

function cleanErrorMessage(rawError: any): string {
  const msg = typeof rawError === "string" ? rawError : rawError?.message || JSON.stringify(rawError);
  if (msg.includes("reported as leaked") || msg.includes("AIzaSyBEqysd")) {
    return "The previous Gemini API key was reported as leaked and has been blocked by Google. Please generate a new key at https://aistudio.google.com/app/apikey and paste it into server.ts (HARDCODED_GEMINI_API_KEY) or Settings.";
  }
  if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
    return "The provided Gemini API key is invalid. Please get a valid API key from https://aistudio.google.com/app/apikey.";
  }
  if (!getApiKey()) {
    return "Gemini API key is required. Please paste your fresh API key into server.ts (HARDCODED_GEMINI_API_KEY) or configure the GEMINI_API_KEY environment variable.";
  }
  return msg;
}

function getAiClient(): GoogleGenAI {
  const key = getApiKey();
  if (!key) {
    throw new Error(cleanErrorMessage(""));
  }
  return new GoogleGenAI({ apiKey: key });
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    diseaseName: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    severity: { type: Type.STRING, enum: ["Mild", "Moderate", "Severe", "Healthy"] },
    summary: { type: Type.STRING },
    treatments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["name", "description"]
      }
    },
    preventionTips: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["name", "description"]
      }
    }
  },
  required: ["diseaseName", "confidence", "severity", "summary", "treatments", "preventionTips"]
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Server-side plant analysis endpoint
  app.post("/api/analyze-plant", async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "No image data provided" });
      }

      const prompt = `Analyze this image of a plant leaf/stem/fruit. You are a world-class plant pathologist AI.
For data consistency and subsequent translation, it is critical that your entire response be in English.
1. Identify the plant disease, if any. If the plant is healthy, state that.
2. Provide a confidence score (0-100) for your diagnosis.
3. Assess the severity as "Mild", "Moderate", "Severe", or "Healthy".
4. Provide a brief, one-paragraph summary of the findings.
5. Suggest 2-3 specific treatment methods with short descriptions.
6. List 2-3 actionable prevention tips with short descriptions.`;

      const ai = getAiClient();
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      };

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: { parts: [imagePart, { text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.2,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        const parsed = JSON.parse(response.text?.trim() || "{}");
        return res.json(parsed);
      } catch (err) {
        // Fallback model
        console.warn("Primary model error, attempting gemini-3-flash-preview fallback:", err);
        const fallbackRes = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: { parts: [imagePart, { text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.2,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        const parsed = JSON.parse(fallbackRes.text?.trim() || "{}");
        return res.json(parsed);
      }
    } catch (error: any) {
      console.error("Server plant analysis error:", error);
      res.status(500).json({ error: cleanErrorMessage(error) });
    }
  });

  // Server-side translation endpoint
  app.post("/api/translate-result", async (req: Request, res: Response) => {
    try {
      const { englishResult, targetLanguageName } = req.body;
      if (!englishResult || !targetLanguageName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (targetLanguageName.toLowerCase() === "english") {
        return res.json(englishResult);
      }

      const textToTranslate = {
        diseaseName: englishResult.diseaseName,
        summary: englishResult.summary,
        treatments: englishResult.treatments,
        preventionTips: englishResult.preventionTips,
      };

      const prompt = `You are an expert agricultural translator. Translate the following JSON object, which contains plant disease diagnosis information, from English into ${targetLanguageName}.
Ensure the tone is professional, clear, and easy for a farmer to understand.
Do not translate the JSON keys. Only translate the string values.
JSON to translate:
${JSON.stringify(textToTranslate, null, 2)}`;

      const translationSchema = {
        type: Type.OBJECT,
        properties: {
          diseaseName: { type: Type.STRING },
          summary: { type: Type.STRING },
          treatments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["name", "description"]
            }
          },
          preventionTips: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["name", "description"]
            }
          }
        },
        required: ["diseaseName", "summary", "treatments", "preventionTips"]
      };

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: translationSchema,
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 }
        },
      });

      const translatedData = JSON.parse(response.text?.trim() || "{}");
      return res.json({
        ...englishResult,
        ...translatedData
      });
    } catch (error: any) {
      console.error("Translation API error:", error);
      res.status(500).json({ error: cleanErrorMessage(error) });
    }
  });

  // Server-side chat endpoint (used by Chatbot and Scan follow-up)
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { message, systemInstruction, history = [] } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const ai = getAiClient();
      const chat = ai.chats.create({
        model: "gemini-3.1-flash-lite",
        config: {
          systemInstruction: systemInstruction || "You are an expert AI agriculture assistant.",
          thinkingConfig: { thinkingBudget: 0 }
        },
        history: history.map((h: any) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text || h.content || "" }]
        }))
      });

      const result = await chat.sendMessage({ message });
      res.json({ text: result.text || "" });
    } catch (error: any) {
      console.error("Chat API error:", error);
      res.status(500).json({ error: cleanErrorMessage(error) });
    }
  });

  // Server-side related articles endpoint
  app.post("/api/related-articles", async (req: Request, res: Response) => {
    try {
      const { diseaseName, articles = [] } = req.body;
      if (!diseaseName || diseaseName.toLowerCase() === "healthy" || articles.length === 0) {
        return res.json({ articleIds: [] });
      }

      // Keyword based scoring first
      const lowerDisease = diseaseName.toLowerCase();
      const diseaseWords = lowerDisease.split(/[\s,.-]+/).filter((w: string) => w.length > 2);
      const scored = articles.map((article: any) => {
        let score = 0;
        const targetText = `${article.title} ${article.category || ""} ${article.summary || ""}`.toLowerCase();
        for (const word of diseaseWords) {
          if (targetText.includes(word)) score += 3;
        }
        if (lowerDisease.includes("mildew") || lowerDisease.includes("fung") || lowerDisease.includes("rot") || lowerDisease.includes("scab") || lowerDisease.includes("blight") || lowerDisease.includes("rust") || lowerDisease.includes("spot")) {
          if (targetText.includes("fung") || targetText.includes("disease") || targetText.includes("leaf")) score += 4;
        }
        return { id: article.id, score };
      });

      const matched = scored.filter((s: any) => s.score > 0).sort((a: any, b: any) => b.score - a.score).slice(0, 3).map((s: any) => s.id);
      if (matched.length > 0) {
        return res.json({ articleIds: matched });
      }

      const ai = getAiClient();
      const articleInfo = articles.map((a: any) => ({ id: a.id, title: a.title, summary: a.summary }));
      const prompt = `Given the plant disease diagnosis "${diseaseName}", which of the following articles are the most relevant? Please return the IDs of the top 2-3 most relevant articles.
Articles:
${JSON.stringify(articleInfo, null, 2)}`;

      const articleSchema = {
        type: Type.OBJECT,
        properties: {
          articleIds: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "An array of numbers, where each number is the ID of a relevant article.",
          },
        },
        required: ["articleIds"],
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: articleSchema,
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 }
        },
      });

      const parsed = JSON.parse(response.text?.trim() || "{}");
      res.json({ articleIds: parsed.articleIds || [] });
    } catch (error: any) {
      console.error("Related articles error:", error);
      res.json({ articleIds: [] });
    }
  });

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
