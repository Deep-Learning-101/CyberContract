import React, { useState, useEffect } from 'react';
import Spinner from './Spinner';

interface AnalyzingViewProps {
    contractTitle: string;
}

const analyzingMessages = [
    '正在安全地上傳您的文件...',
    '文件驗證完成，正在提交給 Gemini AI...',
    'Gemini AI 正在逐頁讀取您的合約...',
    '開始提取關鍵條款與數據...',
    '正在識別時程、人力與付款條件...',
    '正在結構化分析結果...',
    '即將完成，請稍候片刻...',
];

const AnalyzingView: React.FC<AnalyzingViewProps> = ({ contractTitle }) => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex(prevIndex => {
                if (prevIndex < analyzingMessages.length - 1) {
                    return prevIndex + 1;
                }
                // When it reaches the last message, clear the interval to stop it.
                clearInterval(interval);
                return prevIndex;
            });
        }, 3000); // Change message every 3 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-400">
            <Spinner />
            <h2 className="mt-4 text-2xl font-semibold text-slate-300">正在分析合約...</h2>
            <p className="mt-2 max-w-full px-4 truncate">{contractTitle}</p>
            <div className="mt-4 text-lg text-indigo-300 h-8">
                <p>{analyzingMessages[messageIndex]}</p>
            </div>
            <p className="mt-4 text-sm text-slate-500">此過程可能需要一些時間，您可以先查看其他已完成的合約。</p>
        </div>
    );
};

export default AnalyzingView;