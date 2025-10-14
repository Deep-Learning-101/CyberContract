// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url'; // 引入 fileURLToPath

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PO0T || 3000;
const host = '0.0.0.0';

// 設置靜態檔案目錄為 'dist'
// 確保伺服器服務建構後的檔案
app.use(express.static(path.join(__dirname, 'dist'))); 


// 處理所有其他請求，將其導向到 dist/index.html
// 這是單頁應用程式 (SPA) 路由所必需的
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, host, () => {
    console.log(`Static file server listening at http://${host}:${port}`);
});
