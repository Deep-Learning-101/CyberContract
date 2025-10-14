import React, { useCallback, useState } from 'react';

interface FileUploadProps {
    onFileUpload: (files: File[]) => void;
    disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, disabled }) => {
    const [isDragging, setIsDragging] = useState(false);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const allFiles = Array.from(e.target.files);
            const pdfFiles = allFiles.filter((file: File) => file.type === 'application/pdf');
            
            if (pdfFiles.length < allFiles.length) {
                alert("部分檔案格式不受支援，僅會處理 PDF 檔案。");
            }
            if (pdfFiles.length > 0) {
                onFileUpload(pdfFiles);
            }
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if(!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if(disabled) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const allFiles = Array.from(e.dataTransfer.files);
            const pdfFiles = allFiles.filter((file: File) => file.type === 'application/pdf');

            if (pdfFiles.length < allFiles.length) {
                alert("部分檔案格式不受支援，僅會處理 PDF 檔案。");
            }
            if (pdfFiles.length > 0) {
                onFileUpload(pdfFiles);
            }
        }
    }, [onFileUpload, disabled]);

    return (
        <div className="mb-4">
            <label 
                htmlFor="file-upload" 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full h-32 px-4 transition-all duration-300 ease-in-out border-2 border-dashed rounded-lg
                ${isDragging ? 'border-blue-500 bg-slate-700 ring-2 ring-blue-500/50' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <div className="flex flex-col items-center text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-slate-400">點擊或拖曳多個 PDF 檔案至此處</span>
                </div>
                <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf" disabled={disabled} multiple />
            </label>
        </div>
    );
};

export default FileUpload;