
import React, { useState, useCallback, useEffect } from 'react';
import type { Contract, ChatMessage } from './types';
import { uploadContract, getContracts, chatWithContract, deleteContract, getThumbnailUrl } from './services/api';
import Header from './components/Header';
import ContractList from './components/ContractList';
import FileUpload from './components/FileUpload';
import ContractView from './components/ContractView';
import GlobalQueryView from './components/GlobalQuery';
import Spinner from './components/Spinner';
import AnalyzingView from './components/AnalyzingView';

const App: React.FC = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [selection, setSelection] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isAnswering, setIsAnswering] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [mainView, setMainView] = useState<'contract' | 'global_query'>('contract');

    const loadContracts = useCallback(async () => {
        setLoadingMessage('正在載入合約...');
        try {
            const data = await getContracts();
            // Map backend data to frontend structure if needed, 
            // but we updated types to match backend mostly.
            // We need to ensure thumbnailUrl is populated.
            const mappedContracts = data.map(c => ({
                ...c,
                thumbnailUrl: getThumbnailUrl(c.filename)
            }));
            setContracts(mappedContracts);
        } catch (err) {
            console.error("Failed to load contracts", err);
            setError("無法載入合約列表。");
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, []);

    useEffect(() => {
        loadContracts();
    }, [loadContracts]);

    useEffect(() => {
        if (isLoading) return;
        if (selectedContract && !contracts.some(c => c.id === selectedContract.id)) {
            const nextContract = contracts.find(c => c.status === 'completed') || (contracts.length > 0 ? contracts[0] : null);
            if (nextContract) {
                setSelectedContract(nextContract);
            } else {
                setSelectedContract(null);
                setMainView('global_query');
            }
        }
    }, [contracts, selectedContract, isLoading]);

    const handleSelectContract = useCallback((contract: Contract) => {
        setSelectedContract(contract);
        setMainView('contract');
        setSelection(new Set());
    }, []);

    const handleShowGlobalQuery = useCallback(() => {
        setSelectedContract(null);
        setMainView('global_query');
    }, []);

    const handleFileUpload = useCallback(async (files: File[]) => {
        setError(null);
        setLoadingMessage('正在上傳並分析...');

        for (const file of files) {
            try {
                // Optimistic update? No, let's wait for server response for simplicity first.
                // Or we can show a placeholder.
                // The backend handles upload and starts analysis in background.
                // But our backend implementation currently does analysis synchronously in background task?
                // Actually I made it sync in the background task.
                // So the upload endpoint returns quickly with "uploading" status.

                const newContract = await uploadContract(file);
                const contractWithThumb = {
                    ...newContract,
                    thumbnailUrl: getThumbnailUrl(newContract.filename)
                };

                setContracts(prev => [contractWithThumb, ...prev]);

                // Poll for status update if it's analyzing
                // For now, let's just reload list after a delay or rely on user refresh
                // Better: Implement polling or websocket.
                // Let's do simple polling for this contract
                pollContractStatus(newContract.id);

            } catch (err) {
                console.error(`Upload failed for ${file.name}:`, err);
                setError(`上傳失敗: ${file.name}`);
            }
        }
    }, []);

    const pollContractStatus = async (id: number) => {
        const interval = setInterval(async () => {
            try {
                // We need a getContract endpoint or just refresh list
                // Let's refresh list for simplicity or fetch specific contract
                // I implemented getContract(id) in api.ts
                // But I didn't implement getContract(id) in main.py? 
                // Yes I did: @app.get("/api/contracts/{contract_id}")

                // Wait, I need to import getContract from api
                // I'll assume I can fetch the specific contract
                // Actually, let's just re-fetch all for now to keep state consistent
                const data = await getContracts();
                const mappedContracts = data.map(c => ({
                    ...c,
                    thumbnailUrl: getThumbnailUrl(c.filename)
                }));
                setContracts(mappedContracts);

                const updated = mappedContracts.find(c => c.id === id);
                if (updated && updated.status !== 'uploading' && updated.status !== 'analyzing') {
                    clearInterval(interval);
                    if (selectedContract?.id === id) {
                        setSelectedContract(updated);
                    }
                }
            } catch (e) {
                clearInterval(interval);
            }
        }, 2000);
    };

    const handleSendMessage = useCallback(async (message: string, contractId?: number) => {
        if (!message.trim() || !contractId) return;

        const targetContract = contracts.find(c => c.id === contractId);
        if (!targetContract) return;

        // Optimistic update
        const newMessage: ChatMessage = { role: 'user', content: message };
        const updatedHistory = [...targetContract.chat_history, newMessage];

        const updateContractState = (updatedContract: Contract) => {
            setContracts(prev => prev.map(c => c.id === contractId ? updatedContract : c));
            setSelectedContract(updatedContract);
        }

        updateContractState({ ...targetContract, chat_history: updatedHistory });
        setIsAnswering(true);

        try {
            const aiMsg = await chatWithContract(contractId, message);
            const finalHistory = [...updatedHistory, aiMsg];
            updateContractState({ ...targetContract, chat_history: finalHistory });
        } catch (err) {
            console.error(err);
            const errorResponse: ChatMessage = { role: 'ai', content: '抱歉，我無法回答這個問題。' };
            const finalHistory = [...updatedHistory, errorResponse];
            updateContractState({ ...targetContract, chat_history: finalHistory });
        } finally {
            setIsAnswering(false);
        }
    }, [contracts]);

    // Rename is not supported in backend yet
    const handleRenameContract = useCallback(async (contractId: number, newName: string) => {
        // Not implemented
        console.log("Rename not implemented");
    }, []);

    const handleToggleSelection = useCallback((id: number) => {
        setSelection(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    const handleDeleteSelection = useCallback(async () => {
        if (selection.size === 0) return;

        if (!window.confirm(`確定要刪除選取的 ${selection.size} 個合約嗎？`)) return;

        try {
            setIsLoading(true);
            setLoadingMessage('正在刪除項目...');

            for (const id of selection) {
                await deleteContract(id);
            }

            setContracts(prev => prev.filter(c => !selection.has(c.id)));
            setSelection(new Set());
            setSelectedContract(null);

        } catch (err) {
            console.error("Failed to delete selection", err);
            setError("刪除項目時發生錯誤");
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [selection]);

    // Group handlers removed

    const isUploadingDisabled = isLoading;

    const renderMainContent = () => {
        if (mainView === 'global_query') {
            return <GlobalQueryView contracts={contracts} />;
        }

        if (selectedContract) {
            switch (selectedContract.status) {
                case 'completed':
                    return <ContractView contract={selectedContract} onSendMessage={handleSendMessage} isAnswering={isAnswering} />;
                case 'analyzing':
                case 'uploading':
                    return <AnalyzingView contractTitle={selectedContract.title} />;
                case 'error':
                    return (
                        <div className="flex-grow flex flex-col items-center justify-center text-center">
                            <h2 className="mt-4 text-2xl font-semibold text-red-400">分析失敗</h2>
                            <p className="mt-2 text-slate-300 truncate max-w-full px-4">{selectedContract.title}</p>
                            <p className="mt-4 text-sm text-slate-500">請嘗試重新上傳檔案，或勾選此項目並點擊刪除按鈕。</p>
                        </div>
                    );
                default:
                    return null;
            }
        }

        if (!contracts.length && !isLoading) {
            return (
                <div className="flex-grow flex items-center justify-center">
                    <div className="text-center text-slate-500">
                        <h2 className="mt-4 text-3xl font-bold text-slate-300">歡迎使用 AI 合約 神器</h2>
                        <p className="mt-2 text-lg">請點擊左上方的按鈕上傳您的第一份合約掃描 PDF 檔案。</p>
                    </div>
                </div>
            );
        }

        if (contracts.length > 0 && !selectedContract && !isLoading) {
            return (
                <div className="flex-grow flex items-center justify-center">
                    <div className="text-center text-slate-500">
                        <h2 className="text-2xl font-semibold text-slate-300">請從左側列表選擇一份合約</h2>
                        <p className="mt-2">選擇合約以查看分析結果或進行提問。</p>
                    </div>
                </div>
            );
        }

        return null;
    }


    return (
        <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-sans">
            <Header />
            <div className="flex flex-grow overflow-hidden">
                <aside className="w-1/4 bg-slate-800 p-4 overflow-y-auto flex flex-col space-y-4 border-r border-slate-700">
                    <FileUpload onFileUpload={handleFileUpload} disabled={isUploadingDisabled} />
                    <button
                        onClick={handleShowGlobalQuery}
                        className={`w-full p-3 rounded-lg text-white font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${mainView === 'global_query' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10l-6 6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <span>跨文件智慧查詢</span>
                    </button>
                    {selection.size > 0 && (
                        <button
                            onClick={handleDeleteSelection}
                            className="w-full p-3 rounded-lg text-white font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-500 shadow-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            <span>刪除已選的 {selection.size} 個項目</span>
                        </button>
                    )}
                    <ContractList
                        contracts={contracts}
                        selectedContractId={selectedContract?.id}
                        selection={selection}
                        onSelectContract={handleSelectContract}
                        onRenameContract={handleRenameContract}
                        onSelectionChange={handleToggleSelection}
                    />
                </aside>
                <main className="w-3/4 flex flex-col p-6 overflow-hidden relative">
                    {isLoading && (
                        <div className="absolute inset-0 bg-slate-900 bg-opacity-75 flex flex-col items-center justify-center z-50">
                            <Spinner />
                            <p className="mt-4 text-xl text-white">{loadingMessage}</p>
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg relative mb-4" role="alert">
                            <strong className="font-bold">錯誤：</strong>
                            <span className="block sm:inline ml-2">{error}</span>
                        </div>
                    )}
                    {renderMainContent()}
                </main>
            </div>
        </div>
    );
};

export default App;
