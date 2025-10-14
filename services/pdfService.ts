// services/pdfService.ts

import * as pdfjsLib from 'pdfjs-dist';

// 關鍵修改：使用一個確定存在的 CDN 版本
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;


export const generatePdfThumbnail = async (file: File): Promise<string> => {
    const fileReader = new FileReader();

    return new Promise((resolve, reject) => {
        fileReader.onload = async (event) => {
            // ... (下方程式碼保持不變)
            if (!event.target?.result) {
                return reject(new Error("Failed to read file."));
            }

            try {
                const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;

                if (pdf.numPages === 0) {
                    return reject(new Error("PDF has no pages."));
                }
                
                // Only process the first page for the thumbnail
                const page = await pdf.getPage(1);
                // Lower scale and quality for faster thumbnail generation
                const viewport = page.getViewport({ scale: 1.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                if (!context) {
                     return reject(new Error("Failed to get canvas context."));
                }
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(imageUrl);
            } catch (error) {
                console.error("Error processing PDF for thumbnail: ", error);
                reject(new Error("無法處理此 PDF 檔案。檔案可能已損壞或格式不受支援。"));
            }
        };

        fileReader.onerror = () => {
             reject(new Error("Error reading file."));
        };

        fileReader.readAsArrayBuffer(file);
    });
};