```
import React, { useState, useEffect, useRef } from 'react';
import type { Contract, ChatMessage } from '../types';
import { globalChat } from '../services/api';
import ChatInterface from './ChatInterface';

interface GlobalQueryViewProps {
    contracts: Contract[];
}

const GlobalQueryView: React.FC<GlobalQueryViewProps> = ({ contracts }) => {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isAnswering, setIsAnswering] = useState(false);
    const hasRunIntro = useRef(false);

    const handleQuery = async (currentQuery: string) => {
        if (!currentQuery.trim() || isAnswering) return;

        const contractsToQuery = contracts.filter(c => c.status === 'completed');
        
        if (contractsToQuery.length === 0) {
            setChatHistory(prev => [...prev, { sender: 'ai', text: "沒有可供查詢的合約，請確認有已分析完成的合約。" }]);
            return;
        }
        
        const newHistory: ChatMessage[] = [...chatHistory, { sender: 'user', text: currentQuery }];
        setChatHistory(newHistory);
        setIsAnswering(true);
        
        try {
            const contractIds = contractsToQuery.map(c => c.id);
            const aiMsg = await globalChat(contractIds, currentQuery);
            // Adapt backend ChatMessage (role/content) to frontend ChatMessage (sender/text)
            // Frontend ChatMessage: { sender: 'user' | 'ai', text: string, tokenCount?: ... }
            // Backend returns: { role: 'ai', content: string, ... }
            
            setChatHistory([...newHistory, { sender: 'ai', text: aiMsg.content }]);
        } catch (err) {
            console.error(err);
            setChatHistory([...newHistory, { sender: 'ai', text: '抱歉，處理您的跨文件查詢時發生錯誤。' }]);
        } finally {
            setIsAnswering(false);
        }
    };

    useEffect(() => {
        if (!hasRunIntro.current && contracts.length > 0) {
            setChatHistory([
                { sender: 'ai', text: '你好！我是跨文件智慧助理。我可以同時分析所有已完成的合約。' }
            ]);
            hasRunIntro.current = true;
        }
    }, [contracts]);
    
    const handleSendMessage = (message: string) => {
        handleQuery(message);
    };

    if (contracts.filter(c => c.status === 'completed').length === 0) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h2 className="mt-4 text-2xl font-semibold text-slate-300">無可查詢的合約</h2>
                <p className="mt-2 text-slate-500">請先上傳並等待至少一份合約分析完成，才能使用跨文件查詢功能。</p>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-slate-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
            {/* Left Column: Controls - Simplified for now */}
            <div className="w-1/3 flex flex-col border-r border-slate-700 p-6 overflow-y-auto">
                <h2 className="text-xl font-bold mb-2 text-white">查詢設定</h2>
                <p className="text-sm text-slate-400 mb-6">目前將查詢所有已完成的合約 ({contracts.filter(c => c.status === 'completed').length} 份)。</p>
                
                <div className="mt-auto pt-6 text-xs text-slate-500">
                    <p className="font-semibold mb-2 text-slate-400">提示：</p>
                    <p>您可以提出比較性問題，例如：「比較 A 專案與 B 專案的付款時程有何不同？」</p>
                    <p className="mt-2">或整合性問題：「所有合約中，有哪些將在下個月到期？」</p>
                </div>
            </div>

            {/* Right Column: Chat */}
            <div className="w-2/3 flex flex-col bg-slate-800">
                <ChatInterface
                    messages={chatHistory}
                    onSendMessage={handleSendMessage}
                    isAnswering={isAnswering}
                    placeholder={'對所有合約提問...'}
                />
            </div>
        </div>
    );
};

export default GlobalQueryView;
