
import React, { useState, useCallback, useEffect } from 'react';
import type { Contract, ChatMessage, ContractGroup } from './types';
import { analyzeContract, answerContractQuestion } from './services/geminiService';
import { generatePdfThumbnail } from './services/pdfService';
import { addContract, getAllContracts, performBulkDelete, getAllGroups, addGroup as dbAddGroup } from './services/dbService';
import Header from './components/Header';
import ContractList from './components/ContractList';
import FileUpload from './components/FileUpload';
import ContractView from './components/ContractView';
import GlobalQueryView from './components/GlobalQuery';
import Spinner from './components/Spinner';
import AnalyzingView from './components/AnalyzingView';

const App: React.FC = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [groups, setGroups] = useState<ContractGroup[]>([]);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [selection, setSelection] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState<boolean>(true); // For initial load and processing
    const [isAnswering, setIsAnswering] = useState<boolean>(false); // For chat responses
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [mainView, setMainView] = useState<'contract' | 'global_query'>('contract');

    useEffect(() => {
        const loadDataFromDB = async () => {
            setLoadingMessage('正在從本機載入已儲存的資料...');
            try {
                const [savedContracts, savedGroups] = await Promise.all([getAllContracts(), getAllGroups()]);
                setContracts(savedContracts);
                setGroups(savedGroups);
            } catch (err) {
                console.error("Failed to load data from DB", err);
                setError("無法從本機資料庫載入資料。");
            } finally {
                setIsLoading(false);
                setLoadingMessage('');
            }
        };
        loadDataFromDB();
    }, []);

    // Effect to handle cleanup if the selected contract is deleted
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

        for (const [index, file] of files.entries()) {
            const tempId = `${Date.now()}-${index}-${file.name}`;

            (async () => {
                let thumbnailUrl: string;
                try {
                    thumbnailUrl = await generatePdfThumbnail(file);

                    const pendingContract: Contract = {
                        id: tempId,
                        name: file.name,
                        thumbnailUrl,
                        status: 'analyzing',
                        chatHistory: [],
                        groupId: null,
                    };

                    setContracts(prev => [...prev, pendingContract]);
                    if (index === 0 && !selectedContract) {
                        handleSelectContract(pendingContract);
                    }

                } catch (err) {
                    console.error(`Thumbnail generation failed for ${file.name}:`, err);
                    const errorMessage = err instanceof Error ? err.message : '無法處理此 PDF 檔案。檔案可能已損毀或為空白。';
                    const errorContract: Contract = {
                        id: tempId,
                        name: file.name,
                        thumbnailUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
                        status: 'error',
                        errorMessage: errorMessage,
                        chatHistory: [],
                        groupId: null,
                    };
                    setContracts(prev => [...prev, errorContract]);
                    return;
                }

                try {
                    const { extractedData, tokenUsage } = await analyzeContract(file);

                    const finalContract: Contract = {
                        id: tempId,
                        name: file.name,
                        thumbnailUrl,
                        status: 'completed',
                        extractedData,
                        analysisTokenCount: tokenUsage,
                        chatHistory: [
                            {
                                sender: 'ai',
                                text: '你好！這是這份合約的摘要。你可以問我任何關於這份文件的問題。',
                            },
                        ],
                        groupId: null,
                    };
                    
                    await addContract(finalContract);
                    setContracts(prev => prev.map(c => c.id === tempId ? finalContract : c));
                    if (selectedContract?.id === tempId || (!selectedContract && index === 0)) {
                         handleSelectContract(finalContract);
                    }


                } catch (err) {
                    console.error(`Analysis failed for ${file.name}:`, err);
                    const errorMessage = err instanceof Error ? err.message : '發生未知錯誤，請稍後再試。';
                    const errorContract: Contract = {
                        id: tempId,
                        name: file.name,
                        thumbnailUrl,
                        status: 'error',
                        errorMessage: errorMessage,
                        chatHistory: [],
                        groupId: null,
                    };
                    setContracts(prev => prev.map(c => c.id === tempId ? errorContract : c));
                     if (selectedContract?.id === tempId) {
                        handleSelectContract(errorContract);
                    }
                }
            })();
        }
    }, [selectedContract, handleSelectContract]);

    const handleSendMessage = useCallback(async (message: string, contractId?: string) => {
        if (!message.trim() || !contractId) return;

        const targetContract = contracts.find(c => c.id === contractId);
        if (!targetContract || targetContract.status !== 'completed' || !targetContract.extractedData) return;

        const updatedHistory: ChatMessage[] = [...targetContract.chatHistory, { sender: 'user', text: message }];
        
        const updateContractState = (updatedContract: Contract) => {
             setContracts(prev => prev.map(c => c.id === contractId ? updatedContract : c));
             setSelectedContract(updatedContract);
        }
        
        updateContractState({...targetContract, chatHistory: updatedHistory});
        setIsAnswering(true);

        try {
            const { aiResponse, tokenUsage } = await answerContractQuestion(targetContract.extractedData, updatedHistory);
            const finalHistory: ChatMessage[] = [...updatedHistory, { sender: 'ai', text: aiResponse, tokenCount: tokenUsage }];
            const finalContract = {...targetContract, chatHistory: finalHistory};
            await addContract(finalContract);
            updateContractState(finalContract);
        } catch (err) {
            console.error(err);
            const errorResponse: ChatMessage = { sender: 'ai', text: '抱歉，我無法回答這個問題。' };
            const finalHistory = [...updatedHistory, errorResponse];
            const finalContract = {...targetContract, chatHistory: finalHistory};
            await addContract(finalContract);
            updateContractState(finalContract);
        } finally {
            setIsAnswering(false);
        }
    }, [contracts]);
    
    const handleRenameContract = useCallback(async (contractId: string, newName: string) => {
        const contract = contracts.find(c => c.id === contractId);
        if (contract && contract.name !== newName) {
            const updatedContract = { ...contract, name: newName };
            try {
                await addContract(updatedContract); // addContract also works for updates
                setContracts(prev => prev.map(c => c.id === contractId ? updatedContract : c));
                if (selectedContract?.id === contractId) {
                    setSelectedContract(updatedContract);
                }
            } catch (err) {
                console.error("Failed to rename contract", err);
                setError("重新命名合約時發生錯誤。");
            }
        }
    }, [contracts, selectedContract]);

    const handleToggleSelection = useCallback((id: string) => {
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
    
        await performBulkDelete(selection, new Set());
    
        setContracts(prev => prev.filter(c => !selection.has(c.id)));
        setSelection(new Set());
    
      } catch (err) {
        console.error("Failed to delete selection", err);
        setError("刪除項目時發生錯誤：" + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    }, [selection]);

    // --- Group Handlers ---
    const handleCreateGroup = useCallback(async (name: string) => {
        const newGroup: ContractGroup = {
            id: `group-${Date.now()}`,
            name,
            contractIds: [],
        };
        try {
            await dbAddGroup(newGroup);
            setGroups(prev => [...prev, newGroup]);
        } catch (err) {
            console.error("Failed to create group", err);
            setError("建立群組時發生錯誤。");
        }
    }, []);

    const handleRenameGroup = useCallback(async (groupId: string, newName: string) => {
        const group = groups.find(g => g.id === groupId);
        if (group && group.name !== newName) {
            const updatedGroup = { ...group, name: newName };
            try {
                await dbAddGroup(updatedGroup);
                setGroups(prev => prev.map(g => g.id === groupId ? updatedGroup : g));
            } catch (err) {
                console.error("Failed to rename group", err);
                setError("重新命名群組時發生錯誤。");
            }
        }
    }, [groups]);

    const handleDeleteGroup = useCallback(async (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        if (!window.confirm(`確定要刪除群組 "${group.name}" 及其中的 ${group.contractIds.length} 個合約嗎？此操作無法復原。`)) return;
        
        try {
            setIsLoading(true);
            setLoadingMessage(`正在刪除群組 ${group.name}...`);
            await performBulkDelete(new Set(group.contractIds), new Set([groupId]));
            
            setContracts(prev => prev.filter(c => c.groupId !== groupId));
            setGroups(prev => prev.filter(g => g.id !== groupId));
        } catch (err) {
            console.error("Failed to delete group", err);
            setError("刪除群組時發生錯誤。");
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [groups]);

    const handleMoveContract = useCallback(async (contractId: string, newGroupId: string | null) => {
        const contract = contracts.find(c => c.id === contractId);
        if (!contract || contract.groupId === newGroupId) return;

        const oldGroupId = contract.groupId;

        // Optimistic UI updates
        const updatedContract = { ...contract, groupId: newGroupId };
        setContracts(prev => prev.map(c => c.id === contractId ? updatedContract : c));

        let updatedGroups = [...groups];
        if (oldGroupId) {
            updatedGroups = updatedGroups.map(g => g.id === oldGroupId ? { ...g, contractIds: g.contractIds.filter(id => id !== contractId) } : g);
        }
        if (newGroupId) {
            updatedGroups = updatedGroups.map(g => g.id === newGroupId ? { ...g, contractIds: [...g.contractIds, contractId] } : g);
        }
        setGroups(updatedGroups);
        
        // Persist changes to DB
        try {
            await addContract(updatedContract);
            const groupsToUpdate = updatedGroups.filter(g => g.id === oldGroupId || g.id === newGroupId);
            await Promise.all(groupsToUpdate.map(g => dbAddGroup(g)));
        } catch (err) {
            console.error("Failed to move contract", err);
            setError("移動合約時發生錯誤，正在還原變更...");
            // Revert on failure
            setContracts(contracts);
            setGroups(groups);
        }
    }, [contracts, groups]);


    const isUploadingDisabled = isLoading;
    
    const renderMainContent = () => {
        if (mainView === 'global_query') {
            return <GlobalQueryView contracts={contracts} groups={groups} />;
        }
        
        if (selectedContract) {
            switch (selectedContract.status) {
                case 'completed':
                    return <ContractView contract={selectedContract} onSendMessage={handleSendMessage} isAnswering={isAnswering} />;
                case 'analyzing':
                    return <AnalyzingView contractName={selectedContract.name} />;
                case 'error':
                    return (
                         <div className="flex-grow flex flex-col items-center justify-center text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <h2 className="mt-4 text-2xl font-semibold text-red-400">分析失敗</h2>
                            <p className="mt-2 text-slate-300 truncate max-w-full px-4">{selectedContract.name}</p>
                            <div className="mt-4 max-w-lg w-full bg-slate-800 p-3 rounded-lg border border-red-500/30 text-sm text-red-300">
                                <p className="font-bold mb-1">錯誤訊息：</p>
                                <p className="font-mono text-xs">{selectedContract.errorMessage}</p>
                            </div>
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-20 w-20 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h2 className="mt-4 text-3xl font-bold text-slate-300">歡迎使用 AI 合約 神器</h2>
                        <p className="mt-2 text-lg">請點擊左上方的按鈕上傳您的第一份合約掃描 PDF 檔案。</p>
                        <p className="mt-1 text-slate-400">所有分析結果將會自動只儲存在您的瀏覽器中。</p>
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
                        groups={groups}
                        selectedContractId={selectedContract?.id}
                        selection={selection}
                        onSelectContract={handleSelectContract}
                        onRenameContract={handleRenameContract}
                        onSelectionChange={handleToggleSelection}
                        onCreateGroup={handleCreateGroup}
                        onRenameGroup={handleRenameGroup}
                        onDeleteGroup={handleDeleteGroup}
                        onMoveContract={handleMoveContract}
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
