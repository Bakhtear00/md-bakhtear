import { GoogleGenAI } from "@google/genai";
import { DataService } from "./dataService";

export const AIService = {
  async askGemini(question: string) {
    const purchases = await DataService.getPurchases();
    const sales = await DataService.getSales();
    const expenses = await DataService.getExpenses();
    const stockData = DataService.calculateStock(purchases, sales);

    const totalStockPieces = Object.values(stockData).reduce((sum, s) => sum + s.pieces, 0);
    const totalDead = Object.values(stockData).reduce((sum, s) => sum + s.dead, 0);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `
      আপনি একজন পোল্ট্রি ব্যবসা বিশেষজ্ঞ। 
      দোকানের মালিকের নাম ${DataService.getUser()}।
      বর্তমান দোকানের অবস্থা:
      - স্টক: ${totalStockPieces} পিস বাকি আছে।
      - মোট মৃত্যু: ${totalDead} টি।
      - মোট বিক্রয় রেকর্ড: ${sales.length} টি।
      - মোট খরচের রেকর্ড: ${expenses.length} টি।
      
      সব সময় বাংলায় উত্তর দিন। উত্তরটি পেশাদার, সংক্ষিপ্ত এবং ব্যবসার লাভ বাড়ানোর দিকে নজর রেখে দিন।
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: question,
        config: {
          systemInstruction,
        },
      });

      return response.text || "দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না।";
    } catch (error) {
      console.error("AI Error:", error);
      return "Gemini API-র সাথে সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে আপনার API কী এবং ইন্টারনেট কানেকশন চেক করুন।";
    }
  }
};
