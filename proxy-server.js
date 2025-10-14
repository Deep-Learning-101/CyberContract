// ========================================================================
//                 最終完整版 proxy-server.js
//       (包含 +8 時區時間戳、秒單位處理時間、以及上傳的檔案名稱)
// ========================================================================

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai'; // 請確認已安裝 @google/genai

// 讀取 .env 檔案
dotenv.config();

// --- 1. 自訂 morgan 的日期 token，顯示 +8 時區時間 ---
morgan.token('local-date', (req, res) => {
    return new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
});

// --- 2. 自訂 morgan 的回應時間 token，單位為秒 ---
morgan.token('response-time-sec', (req, res) => {
    if (!res._startAt || !req._startAt) return '';
    const ms = (res._startAt[0] - req._startAt[0]) * 1e3 + (res._startAt[1] - req._startAt[1]) * 1e-6;
    return (ms / 1000).toFixed(3) + ' s';
});

// --- 3. (新增) 自訂 morgan 的檔名 token ---
// 這個 token 會從請求的 body 中讀取 filename 屬性
morgan.token('filename', (req, res) => {
    // 檢查 req.body 是否存在以及是否有 filename 屬性
    return req.body && req.body.filename ? `(檔案: ${req.body.filename})` : '';
});

const app = express();

// --- 4. 組合使用所有自訂 token 的 morgan 格式 ---
// 在格式最後加上我們自訂的 :filename token
app.use(morgan('[:local-date] :method :url :status - :response-time-sec :filename'));

// --- 中介軟體設定 ---
app.use(cors({ origin: 'http://10.218.118.162:3000' }));
app.use(express.json({ limit: '25mb' }));

// --- API 金鑰與 Gemini 初始化 (保持不變) ---
const apiKey = process.env.API_KEY;
if (!apiKey) {
    throw new Error('API_KEY 未設定，請在專案根目錄建立 .env 檔案並設定 API_KEY');
}
const genAI = new GoogleGenAI({ apiKey });

// --- 代理 API 端點 (保持不變) ---
app.post('/api/gemini/generateContent', async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        if (!model || !contents) {
            return res.status(400).json({ error: '請求中缺少必要的參數：model 或 contents' });
        }

        const result = await genAI.models.generateContent({ model, contents, config });
        res.status(200).json(result);

    } catch (err) {
        console.error('代理請求時發生錯誤:', err);
        res.status(500).json({ error: '代理請求 Gemini API 時失敗', detail: String(err?.message || err) });
    }
});

// --- 啟動伺服器 (保持不變) ---
const PORT = 4000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Gemini 代理伺服器已成功啟動`);
    console.log(`   正在監聽: http://0.0.0.0:${PORT}`);
});
