# CyberContract (AI 合約分析神器)

這是一個基於 Streamlit 的合約分析應用程式。整合 Google Gemini API 進行合約內容分析與問答，提供一站式的合約管理解決方案。

## 功能特色

- **PDF 上傳與解析**：自動將 PDF 轉換為圖片並提取文字。
- **AI 智能分析**：自動提取合約摘要、重要時程、相關人員與付款條件。
- **合約問答**：針對特定合約進行自然語言問答。
- **跨文件查詢**：支援同時對多份合約進行綜合查詢。
- **群組管理**：可自訂群組分類管理合約。
- **現代化介面**：使用 Streamlit 打造的響應式介面。

## 系統需求

- **Docker** & **Docker Compose** (推薦用於部署)
- **Python** (v3.9+) (僅用於本地開發)

## 快速開始 (使用 Docker)

這是最簡單的執行與部署方式。

1. **設定環境變數**
   在專案根目錄建立 `.env` 檔案，並填入您的 Google Gemini API Key：
   ```env
   API_KEY=your_google_gemini_api_key_here
   ```

2. **啟動服務**
   ```bash
   docker-compose up --build -d
   ```

3. **訪問應用程式**
   - 應用程式頁面：`http://localhost:8501`

## 本地開發指南

如果您想在本地修改程式碼，請依照以下步驟執行。

### 1. 環境設定

```bash
# 進入後端目錄
cd backend

# 建立虛擬環境 (建議)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安裝依賴
pip install -r requirements.txt

# 設定環境變數 (或直接在環境中設定 API_KEY)
echo "API_KEY=your_key" > .env
```

### 2. 啟動應用程式

```bash
# 啟動 Streamlit 應用程式
streamlit run streamlit_app.py
```
或
```
python -m streamlit run streamlit_app.py
```

應用程式預設運行於 `http://localhost:8501`。

## 部署指南 (Deployment)

本專案已包含 Docker 設定，可直接部署至任何支援 Docker 的伺服器。

1. **將專案上傳至伺服器**。
2. **確保伺服器已安裝 Docker 和 Docker Compose**。
3. **建立 `.env` 檔案** 並設定 `API_KEY`。
4. **執行部署命令**：
   ```bash
   docker-compose up --build -d
   ```

## 常見問題與除錯 (Troubleshooting)

### 1. 無法連接應用程式
- **檢查埠口**：確認 8501 埠口未被佔用。
- **Docker 環境**：確認 `docker-compose` 內的 `backend` 服務是否正常啟動 (`docker-compose ps`)。

### 2. 上傳失敗
- **檔案大小**：目前 Streamlit 預設限制為 200MB。
- **權限**：確保 `backend/uploads` 和 `backend/db` 目錄具有寫入權限 (Docker 內會自動處理)。

### 3. 分析失敗
- **API Key**：檢查 Gemini API Key 是否有效且有額度。
- **日誌**：查看後端日誌以獲取詳細錯誤訊息 (`docker-compose logs backend`)。

## 專案結構

```
.
├── backend/                # Python Streamlit 應用程式
│   ├── streamlit_app.py   # 應用程式入口
│   ├── main.py            # (舊版 FastAPI 入口，保留供參考或未來擴充)
│   ├── models.py          # 資料庫模型
│   ├── services/          # 業務邏輯 (PDF, Gemini)
│   └── Dockerfile         # Docker 設定
├── docker-compose.yml     # Docker 編排設定
└── README.md              # 說明文件
```
