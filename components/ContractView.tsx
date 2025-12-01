import React, { useState } from 'react';
import type { Contract } from '../types';
import ChatInterface from './ChatInterface';

interface ContractViewProps {
    contract: Contract;
    onSendMessage: (message: string, contractId: number) => void;
    isAnswering: boolean;
}

const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-4 shadow-lg">
        <h3 className="text-md font-semibold text-indigo-400 mb-3">{title}</h3>
        {children}
    </div>
);

const ContractView: React.FC<ContractViewProps> = ({ contract, onSendMessage, isAnswering }) => {
    const [view, setView] = useState<'analysis' | 'chat'>('analysis');

    return (
        <div className="flex flex-col h-full bg-slate-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
            <div className="flex-shrink-0 p-4 border-b border-slate-700">
                <h2 className="text-xl font-bold truncate text-white">{contract.title}</h2>
                <div className="mt-3">
                    <div className="inline-flex rounded-md shadow-sm" role="group">
                        <button onClick={() => setView('analysis')} className={`px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-l-lg ${view === 'analysis' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-slate-600'}`}>分析結果</button>
                        <button onClick={() => setView('chat')} className={`px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-r-lg ${view === 'chat' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-slate-600'}`}>問答助理</button>
                    </div>
                </div>
            </div>

            {view === 'analysis' ? (
                <div className="p-6 overflow-y-auto space-y-4">
                    <InfoCard title="合約摘要">
                        <p className="text-slate-300 leading-relaxed">{contract.extracted_data?.summary}</p>
                    </InfoCard>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoCard title="重要時程">
                            <ul className="list-disc list-inside text-slate-300 space-y-1.5">
                                {contract.extracted_data?.schedule.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </InfoCard>
                        <InfoCard title="相關人員/部門">
                            <ul className="list-disc list-inside text-slate-300 space-y-1.5">
                                {contract.extracted_data?.personnel.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </InfoCard>
                    </div>
                    <InfoCard title="付款條件">
                        <ul className="list-disc list-inside text-slate-300 space-y-1.5">
                            {contract.extracted_data?.paymentTerms.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </InfoCard>
                </div>
            ) : (
                <ChatInterface
                    messages={contract.chat_history}
                    onSendMessage={(msg) => onSendMessage(msg, contract.id)}
                    isAnswering={isAnswering}
                />
            )}
        </div>
    );
};

export default ContractView;