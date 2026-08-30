
import { GoogleGenAI, Type } from "@google/genai";
import { TaskPriority } from "../types";

// KHÔNG khởi tạo AI ngay lập tức ở top-level.
// Nếu khởi tạo ngay lập tức mà gặp lỗi (ví dụ process.env lỗi trên iOS), toàn bộ App sẽ trắng trang.
let aiInstance: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!aiInstance) {
    // Chỉ khởi tạo khi cần dùng
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }
  return aiInstance;
};

export const analyzeTaskAudio = async (audioBase64: string, mimeType: string): Promise<string | null> => {
  try {
    const ai = getAIClient();
    const model = 'gemini-2.5-flash';
    // Prompt yêu cầu chép lại lời nói chính xác
    const prompt = `
      Hãy nghe đoạn âm thanh này và chép lại chính xác những gì người nói đang nói thành văn bản tiếng Việt. 
      Không thêm bớt, không phân tích, chỉ trả về nội dung văn bản thuần túy (Dictation).
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          { text: prompt }
        ]
      }
    });

    const text = response.text;
    if (!text) return null;
    return text.trim();
  } catch (error) {
    console.error("Gemini Voice API Error:", error);
    // Log lỗi chi tiết ra console để Eruda bắt được
    return null;
  }
};
