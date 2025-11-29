import { GoogleGenAI } from "@google/genai";

// Helper to ensure we have a client
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateBlastMessage = async (topic: string, tone: string): Promise<string> => {
  try {
    const ai = getClient();
    const prompt = `Write a short, engaging WhatsApp marketing message about: "${topic}". The tone should be ${tone}. Keep it under 100 words. Include emojis. Do not include hashtags.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate message.";
  } catch (error) {
    console.error("Error generating message:", error);
    return "Error generating message. Please check your API key.";
  }
};