import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ScanResult, Severity, Article } from '../types';

const initializeAi = (): GoogleGenAI | null => {
    // Optional client-side key fallback. Note: prefer keeping hardcoded keys in server.ts so they never leak in browser bundles.
    const hardcodedApiKey = "";
    const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'PLACEHOLDER_API_KEY')
        ? process.env.GEMINI_API_KEY
        : hardcodedApiKey;

    if (!apiKey) {
        return null;
    }
    try {
        return new GoogleGenAI({ apiKey });
    } catch(e) {
        console.error("Error initializing GoogleGenAI:", e);
        return null;
    }
};

// Export the initialized AI instance for use across the app.
export const ai = initializeAi();

/**
 * Optimizes and resizes user uploaded images client-side before sending to Gemini.
 * Large phone photos (5-20MB) are resized to max 1200px and compressed to ~100-200KB.
 * This slashes upload latency from minutes down to milliseconds.
 */
const fileToGenerativePart = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    // Check if we are running in a browser environment with Canvas support
    if (typeof window === 'undefined' || typeof document === 'undefined' || !file.type.startsWith('image/')) {
      fallbackFileReader(file).then(resolve).catch(reject);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const MAX_DIM = 1200; // Optimal resolution for plant pathology detail without multi-megabyte bloat
        let { width, height } = img;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          fallbackFileReader(file).then(resolve).catch(reject);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to high-quality compressed JPEG (quality 0.85)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64Data = dataUrl.split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg',
          },
        });
      } catch (err) {
        fallbackFileReader(file).then(resolve).catch(reject);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      fallbackFileReader(file).then(resolve).catch(reject);
    };

    img.src = objectUrl;
  });
};

const fallbackFileReader = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error("Failed to read file as base64 string."));
      }
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'image/jpeg',
        },
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const analyzePlantImage = async (imageFile: File): Promise<ScanResult> => {
    const imagePart = await fileToGenerativePart(imageFile);

    // 1. First, attempt secure server-side API endpoint (works seamlessly in deployed Cloud Run and production)
    try {
        const response = await fetch('/api/analyze-plant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
            }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.diseaseName) {
                return data as ScanResult;
            }
        } else {
            const errData = await response.json().catch(() => null);
            if (errData?.error) {
                throw new Error(errData.error);
            }
            throw new Error(`Server returned error ${response.status}`);
        }
    } catch (apiErr: any) {
        // If it's a known error returned by the server (e.g. key leaked or invalid), throw directly to show user
        if (apiErr?.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('NetworkError')) {
            throw apiErr;
        }
        console.warn('Server endpoint /api/analyze-plant not reachable, attempting direct client fallback:', apiErr);
    }

    // 2. Direct client-side SDK fallback
    if (!ai) {
        throw new Error("Gemini AI client is not configured. Please paste your Gemini API key in server.ts (HARDCODED_GEMINI_API_KEY) or configure GEMINI_API_KEY.");
    }
    
    const prompt = `Analyze this image of a plant leaf/stem/fruit. You are a world-class plant pathologist AI.
    For data consistency and subsequent translation, it is critical that your entire response be in English.
    1. Identify the plant disease, if any. If the plant is healthy, state that.
    2. Provide a confidence score (0-100) for your diagnosis.
    3. Assess the severity as 'Mild', 'Moderate', 'Severe', or 'Healthy'.
    4. Provide a brief, one-paragraph summary of the findings.
    5. Suggest 2-3 specific treatment methods with short descriptions.
    6. List 2-3 actionable prevention tips with short descriptions.
    
    Your response MUST be a single, valid JSON object matching the provided schema. Do not include any markdown formatting like \`\`\`json.
    IMPORTANT: All text values in the JSON response (like diseaseName, summary, treatment names and descriptions, etc.) MUST be in English.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            diseaseName: { type: Type.STRING, description: "Name of the disease or 'Healthy'" },
            confidence: { type: Type.NUMBER, description: "Confidence score from 0 to 100" },
            severity: { type: Type.STRING, enum: [Severity.MILD, Severity.MODERATE, Severity.SEVERE, Severity.HEALTHY] },
            summary: { type: Type.STRING, description: "A brief summary of the diagnosis." },
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

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        const jsonText = response.text.trim();
        const parsedResult = JSON.parse(jsonText) as ScanResult;
        return parsedResult;
    } catch (error: any) {
        console.warn("Primary fast model attempt failed, falling back to flash preview:", error);
        try {
            const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [imagePart, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    temperature: 0.2,
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });
            return JSON.parse(fallbackResponse.text.trim()) as ScanResult;
        } catch (fallbackError: any) {
            console.error("Error analyzing plant image with Gemini:", fallbackError);
            const errMsg = fallbackError?.message || error?.message || "AI model unavailable or rate limit reached.";
            throw new Error(`Failed to analyze plant image: ${errMsg}`);
        }
    }
};

export const translateScanResult = async (
    englishResult: ScanResult, 
    targetLanguageName: string
): Promise<ScanResult> => {
    if (targetLanguageName.toLowerCase() === 'english') {
        return englishResult;
    }

    // 1. Attempt server-side translation first
    try {
        const response = await fetch('/api/translate-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ englishResult, targetLanguageName }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.diseaseName) {
                return data as ScanResult;
            }
        }
    } catch (apiErr) {
        console.warn('Server translation route not reachable, falling back to direct SDK:', apiErr);
    }

    // 2. Direct client-side SDK fallback
    if (!ai) {
        return englishResult;
    }
    
    const textToTranslate = {
        diseaseName: englishResult.diseaseName,
        summary: englishResult.summary,
        treatments: englishResult.treatments.map(t => ({ name: t.name, description: t.description })),
        preventionTips: englishResult.preventionTips.map(p => ({ name: p.name, description: p.description })),
    };

    const prompt = `Translate all string values in the following JSON object from English into the ${targetLanguageName} language.
    Your response MUST be a single, valid JSON object with the exact same structure as the input. Do not change keys or structure. Only translate the text values.

    Input JSON (source language is English):
    ${JSON.stringify(textToTranslate, null, 2)}
    `;

    const responseSchema = {
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

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });

        const jsonText = response.text.trim();
        const translatedTexts = JSON.parse(jsonText);

        return {
            ...englishResult,
            ...translatedTexts,
        };

    } catch (error) {
        console.warn(`Flash lite translation failed, attempting fallback to flash preview:`, error);
        try {
            const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    temperature: 0.1,
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });
            const jsonText = fallbackResponse.text.trim();
            const translatedTexts = JSON.parse(jsonText);
            return {
                ...englishResult,
                ...translatedTexts,
            };
        } catch (fallbackErr) {
            console.error(`Error translating scan result to ${targetLanguageName}:`, fallbackErr);
            throw new Error(`Failed to translate analysis results. The AI model may be temporarily unavailable.`);
        }
    }
};


export const findRelatedArticles = async (diseaseName: string, articles: Article[]): Promise<number[]> => {
    if (!diseaseName || diseaseName.toLowerCase() === 'healthy') {
        return [];
    }

    // Instant local keyword matching (0ms latency, eliminates unnecessary roundtrips)
    const lowerDisease = diseaseName.toLowerCase();
    const diseaseWords = lowerDisease.split(/[\s,.-]+/).filter(w => w.length > 2);

    const scored = articles.map(article => {
        let score = 0;
        const targetText = `${article.title} ${article.category || ''} ${article.summary || ''}`.toLowerCase();
        for (const word of diseaseWords) {
            if (targetText.includes(word)) score += 3;
        }
        if (lowerDisease.includes('mildew') || lowerDisease.includes('fung') || lowerDisease.includes('rot') || lowerDisease.includes('scab') || lowerDisease.includes('blight') || lowerDisease.includes('rust') || lowerDisease.includes('spot')) {
            if (targetText.includes('fung') || targetText.includes('disease') || targetText.includes('leaf')) score += 4;
        }
        if (lowerDisease.includes('pest') || lowerDisease.includes('aphid') || lowerDisease.includes('mite') || lowerDisease.includes('insect') || lowerDisease.includes('caterpillar') || lowerDisease.includes('bug')) {
            if (targetText.includes('pest') || targetText.includes('insect')) score += 4;
        }
        if (lowerDisease.includes('deficien') || lowerDisease.includes('yellow') || lowerDisease.includes('chlorosis')) {
            if (targetText.includes('nutrient') || targetText.includes('soil')) score += 4;
        }
        return { id: article.id, score };
    });

    const matchingArticles = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.id);
    if (matchingArticles.length > 0) {
        return matchingArticles;
    }

    if (!ai) return [];

    const articleInfo = articles.map(a => ({ id: a.id, title: a.title, summary: a.summary }));

    const prompt = `Given the plant disease diagnosis "${diseaseName}", which of the following articles are the most relevant? Please return the IDs of the top 2-3 most relevant articles.

Available Articles:
${JSON.stringify(articleInfo, null, 2)}

Your response must be a JSON object containing a single key "articleIds" which is an array of numbers.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            articleIds: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER }
            }
        },
        required: ["articleIds"]
    };

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });

        const jsonText = response.text.trim();
        const parsedResult = JSON.parse(jsonText) as { articleIds: number[] };
        return parsedResult.articleIds || [];
    } catch (error) {
        console.error("Error finding related articles:", error);
        return []; // Return empty array on error to prevent UI crash
    }
};