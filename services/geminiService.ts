import { GoogleGenAI } from "@google/genai";
import { settingsApi } from './api';

let cachedApiKey: string | null = null;

// Get API key from settings
const getApiKey = async (): Promise<string> => {
  // Try cached key first
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // Try to get from backend settings
  try {
    const result = await settingsApi.get('geminiApiKey');
    if (result.success && result.value) {
      cachedApiKey = result.value;
      return result.value;
    }
  } catch (err) {
    console.error('Failed to get API key from settings:', err);
  }

  // Fallback to environment variable
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY;
  if (envKey) {
    cachedApiKey = envKey;
    return envKey;
  }

  throw new Error("Gemini API Key not found. Please add it in Settings > API Keys.");
};

// Clear cached key (call when user updates the key)
export const clearApiKeyCache = () => {
  cachedApiKey = null;
};

// Helper to ensure we have a client
const getClient = async () => {
  const apiKey = await getApiKey();
  return new GoogleGenAI({ apiKey });
};

// Mapping tone ke instruksi bahasa Indonesia
const toneInstructions: Record<string, string> = {
  'Ramah': 'Gunakan bahasa yang hangat, bersahabat, dan menyenangkan seperti berbicara dengan teman dekat.',
  'Profesional': 'Gunakan bahasa yang sopan, formal namun tetap ramah dan tidak kaku.',
  'Santai': 'Gunakan bahasa gaul yang casual, seperti ngobrol santai sehari-hari.',
  'Mendesak': 'Buat pesan yang menciptakan urgensi namun tetap sopan, tidak memaksa.',
  'Persuasif': 'Buat pesan yang meyakinkan dan mengajak dengan cara yang halus dan tidak agresif.',
  'Informatif': 'Fokus pada penyampaian informasi yang jelas dan mudah dipahami.',
};

export const generateBlastMessage = async (topic: string, tone: string): Promise<string> => {
  try {
    const ai = await getClient();
    
    const toneInstruction = toneInstructions[tone] || toneInstructions['Ramah'];
    
    const prompt = `Kamu adalah asisten penulis pesan WhatsApp yang ahli dalam komunikasi personal dan humanis.

TUGAS:
Buatkan pesan WhatsApp broadcast tentang: "${topic}"

GAYA PENULISAN:
${toneInstruction}

ATURAN PENTING:
1. Tulis dalam Bahasa Indonesia yang natural dan mengalir
2. Gunakan sapaan yang hangat di awal (contoh: "Halo Kak", "Hai", "Selamat pagi")
3. Buat pesan terasa personal, seolah ditulis khusus untuk penerima
4. Gunakan emoji secukupnya untuk menambah kesan ramah (2-4 emoji)
5. Maksimal 80 kata, singkat tapi berkesan
6. Hindari bahasa yang terlalu formal atau kaku seperti robot
7. Hindari hashtag dan bahasa marketing yang berlebihan
8. Akhiri dengan ajakan yang sopan atau pertanyaan terbuka
9. Gunakan variabel {name} untuk menyapa nama penerima jika sesuai

CONTOH GAYA YANG DIINGINKAN:
"Halo Kak {name}! 👋 Apa kabar? Mau kasih info nih, [isi pesan]. Kalau ada yang mau ditanyakan, langsung chat aja ya! 😊"

Tulis pesan sekarang:`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Tidak dapat membuat pesan.";
  } catch (error: any) {
    console.error("Error generating message:", error);
    if (error.message?.includes('API Key not found')) {
      return "Silakan tambahkan API Key Gemini di Settings > API Keys.";
    }
    return "Gagal membuat pesan. Silakan cek API key di Settings.";
  }
};