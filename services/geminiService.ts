// ========================================================================
//                 修正版 geminiService.ts
//          (正確解析新版 @google/genai SDK 結構，避免 .text() 錯誤)
// ========================================================================

import type { ExtractedData, ChatMessage, Contract, TokenUsage } from '../types';

// 1. 設定後端代理伺服器的 URL，使用您伺服器的 IP 位址
const PROXY_URL = 'http://10.218.118.162:4000/api/gemini/generateContent';

// Helper: 計算 token 用量 (從 result.usageMetadata 取出)
const getTokenUsage = (usageMetadata: any): TokenUsage => {
    return {
        promptTokens: usageMetadata?.promptTokenCount ?? 0,
        outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata?.totalTokenCount ?? 0,
    };
};

// Helper: 將檔案轉換為 Base64 (保持不變)
const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error("Failed to read file as a data URL."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });

    const data = await base64EncodedDataPromise;
    return {
        inlineData: { data, mimeType: file.type },
    };
};

// 2. 統一的 API 呼叫函式，所有請求都透過它發送到後端代理
async function callGeminiProxy(payload: object): Promise<any> {
    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || `HTTP 錯誤! 狀態碼: ${response.status}`);
        }
        
        return await response.json();

    } catch (error) {
        console.error('呼叫後端代理時發生錯誤:', error);
        throw new Error(`呼叫後端代理失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// 用於合約分析的 schema，將 Type 列舉替換為字串 (保持不變)
const contractSchema = {
    type: "object",
    properties: {
        summary: { type: "string", description: '合約目的的簡潔摘要，使用繁體中文。' },
        schedule: { type: "array", description: '包含所有關鍵里程碑和對應日期的項目時程列表，使用繁體中文。', items: { type: "string" } },
        personnel: { type: "array", description: '合約中提到的所有負責人員、職位或部門的列表，使用繁體中文。', items: { type: "string" } },
        paymentTerms: { type: "array", description: '所有付款時程、金額和相關條件的列表，使用繁體中文。', items: { type: "string" } },
    },
    required: ['summary', 'schedule', 'personnel', 'paymentTerms'],
};

// 3. 分析合約函式 (修正解析邏輯)
export const analyzeContract = async (file: File): Promise<{ extractedData: ExtractedData; tokenUsage: TokenUsage }> => {
    try {
        const pdfPart = await fileToGenerativePart(file);
        const prompt = '你是一位專業的法律合約分析助理。請分析以下合約文件，並根據提供的 JSON 結構，以繁體中文提取關鍵資訊。請確保資訊準確且完整。';
        
        // 呼叫後端代理，並附上檔名
        const result = await callGeminiProxy({
            model: 'gemini-2.5-flash',
            contents: { 
                parts: [
                    { text: prompt },
                    pdfPart
                ] 
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: contractSchema,
            },
            filename: file.name // 傳送檔名給後端日誌
        });
        
        // 修正：直接從 result.candidates[0].content.parts[0].text 取出文字
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!text) {
            throw new Error("模型回傳的內容為空，請檢查後端代理是否正確呼叫 Gemini API。");
        }

        let extractedData: ExtractedData;
        try {
            extractedData = JSON.parse(text);
        } catch (parseError) {
            console.error('JSON 解析失敗，原始輸出：', text);
            throw new Error('模型輸出非合法 JSON，請檢查代理的 responseMimeType/responseSchema 設定。');
        }

        const tokenUsage = getTokenUsage(result?.usageMetadata);
        
        return { extractedData, tokenUsage };

    } catch (error) {
        console.error('分析合約時發生錯誤:', error);
        throw new Error(`分析合約失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// 4. 回答合約問題函式 (修正解析邏輯)
export const answerContractQuestion = async (context: ExtractedData, history: ChatMessage[]): Promise<{aiResponse: string, tokenUsage: TokenUsage}> => {
    const userQuestion = history[history.length - 1].text;
    const prompt = `
你是一位合約問答助理。這是一份已解析的合約內容：
摘要: ${context.summary}
時程: ${context.schedule.join(', ')}
相關人員: ${context.personnel.join(', ')}
付款條件: ${context.paymentTerms.join(', ')}

這是目前的對話紀錄:
${history.slice(0, -1).map(m => `${m.sender === 'user' ? '使用者' : '助理'}: ${m.text}`).join('\n')}

請根據以上資訊，用繁體中文回答使用者的最新問題: "${userQuestion}"
你的回答應該要簡潔、直接，並且完全基於提供的合約內容。如果資訊不存在，請明確告知。`;

    try {
        const result = await callGeminiProxy({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
        });

        // 修正：直接從 result.candidates[0].content.parts[0].text 取出文字
        const aiResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!aiResponse) {
            throw new Error("模型回傳的回應為空。");
        }

        const tokenUsage = getTokenUsage(result?.usageMetadata);
        
        return { aiResponse, tokenUsage };

    } catch (error) {
        console.error('回答合約問題時發生錯誤:', error);
        throw new Error(`回答問題失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// 5. 跨文件查詢函式 (修正解析邏輯)
export const answerGeneralQuestion = async (allContracts: Contract[], question: string): Promise<{aiResponse: string, tokenUsage: TokenUsage}> => {
    if (allContracts.length === 0) {
        return { aiResponse: "目前沒有已上傳的合約可供查詢。", tokenUsage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 } };
    }

    const context = allContracts.map(c => `
--- 合約檔案: ${c.name} ---
摘要: ${c.extractedData.summary}
時程: ${c.extractedData.schedule.join('; ')}
相關人員: ${c.extractedData.personnel.join('; ')}
付款條件: ${c.extractedData.paymentTerms.join('; ')}
--------------------
`).join('\n');

    const prompt = `
你是一位能跨多份合約進行分析的助理。這裡有多份合約的摘要資訊：
${context}

請根據以上所有合約的內容，用繁體中文回答以下問題：
"${question}"

你的回答應整合所有相關合約的資訊，並清楚指出資訊來源於哪一份合約。如果資訊不存在，請明確告知。`;

    try {
        const result = await callGeminiProxy({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
        });

        // 修正：直接從 result.candidates[0].content.parts[0].text 取出文字
        const aiResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!aiResponse) {
            throw new Error("模型回傳的回應為空。");
        }

        const tokenUsage = getTokenUsage(result?.usageMetadata);
        
        return { aiResponse, tokenUsage };

    } catch (error) {
        console.error('跨文件查詢時發生錯誤:', error);
        throw new Error(`跨文件查詢失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};
