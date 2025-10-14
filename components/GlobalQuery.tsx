
import React, { useState, useEffect, useRef } from 'react';
import type { Contract, ChatMessage, ContractGroup } from '../types';
import { answerGeneralQuestion as answerGeneralQuestionService } from '../services/geminiService';
import ChatInterface from './ChatInterface';

interface GlobalQueryViewProps {
    contracts: Contract[];
    groups: ContractGroup[];
}

const GlobalQueryView: React.FC<GlobalQueryViewProps> = ({ contracts, groups }) => {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isAnswering, setIsAnswering] = useState(false);
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
    const hasRunIntro = useRef(false);

    const handleQuery = async (currentQuery: string) => {
        if (!currentQuery.trim() || isAnswering) return;

        const contractsToQuery = contracts.filter(c => 
            c.status === 'completed' && c.groupId && selectedGroupIds.has(c.groupId)
        );
        
        if (contractsToQuery.length === 0) {
            setChatHistory(prev => [...prev, { sender: 'ai', text: "您選擇的群組內沒有可供查詢的合約，請確認群組中有已分析完成的合約。" }]);
            return;
        }
        
        const newHistory: ChatMessage[] = [...chatHistory, { sender: 'user', text: currentQuery }];
        setChatHistory(newHistory);
        setIsAnswering(true);
        
        try {
            const { aiResponse, tokenUsage } = await answerGeneralQuestionService(contractsToQuery, currentQuery);
            setChatHistory([...newHistory, { sender: 'ai', text: aiResponse, tokenCount: tokenUsage }]);
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
                { sender: 'ai', text: '你好！我是跨文件智慧助理。請在左側選擇您想查詢的合約群組，然後在這裡向我提問。' }
            ]);
            hasRunIntro.current = true;
        }
    }, [contracts]);


    const handleToggleSelection = (id: string) => {
        setSelectedGroupIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
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
            {/* Left Column: Controls */}
            <div className="w-1/3 flex flex-col border-r border-slate-700 p-6 overflow-y-auto">
                <h2 className="text-xl font-bold mb-2 text-white">查詢設定</h2>
                <p className="text-sm text-slate-400 mb-6">請選擇要納入查詢範圍的合約群組。</p>
                
                <div className="space-y-3">
                    {groups.length > 0 ? groups.map(group => (
                        <label key={group.id} className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-slate-700/50 transition-colors">
                            <input 
                                type="checkbox"
                                checked={selectedGroupIds.has(group.id)}
                                onChange={() => handleToggleSelection(group.id)}
                                className="h-5 w-5 text-purple-500 bg-slate-600 border-slate-500 rounded focus:ring-purple-500 focus:ring-2 transition"
                            />
                            <span className="font-medium text-slate-300 truncate">{group.name} ({group.contractIds.length})</span>
                        </label>
                    )) : (
                        <p className="text-slate-500 text-center p-4">尚未建立任何群組。請回到主列表建立群組並將合約加入。</p>
                    )}
                </div>

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
                    placeholder={selectedGroupIds.size > 0 ? '對選定的群組提問...' : '請先在左側選擇查詢範圍'}
                />
            </div>
        </div>
    );
};

export default GlobalQueryView;
