
import React, { useState, useRef, useEffect } from 'react';
import type { Contract } from '../types';

interface ContractListProps {
    contracts: Contract[];
    // groups removed
    selectedContractId: number | undefined;
    selection: Set<number>;
    onSelectContract: (contract: Contract) => void;
    onRenameContract: (contractId: number, newName: string) => void;
    onSelectionChange: (id: number) => void;
    // Group handlers removed
    onCreateGroup: (name: string) => void;
    onRenameGroup: (groupId: string, newName: string) => void;
    onDeleteGroup: (groupId: string) => void;
    onMoveContract: (contractId: string, newGroupId: string | null) => void;
}

const ContractItem: React.FC<{
    contract: Contract;
    isSelected: boolean;
    isMultiSelected: boolean;
    onSelect: () => void;
    onToggleSelection: () => void;
    onRename: (newName: string) => void;
}> = ({ contract, isSelected, isMultiSelected, onSelect, onToggleSelection, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(contract.title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleRenameConfirm = () => {
        const trimmedName = name.trim();
        if (trimmedName && trimmedName !== contract.title) {
            onRename(trimmedName);
        } else {
            setName(contract.title);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleRenameConfirm();
        } else if (e.key === 'Escape') {
            setName(contract.title);
            setIsEditing(false);
        }
    };

    return (
        <li className="group list-none">
            <div
                onClick={() => !isEditing && onSelect()}
                className={`w-full flex items-center p-2 rounded-lg transition-all duration-200 
            ${isSelected ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : isMultiSelected ? 'bg-slate-600 ring-2 ring-blue-500' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} 
            ${contract.status !== 'completed' && !isEditing ? 'opacity-80' : ''} 
            ${isEditing ? '' : 'cursor-pointer'}`}
            >
                <input
                    type="checkbox"
                    checked={isMultiSelected}
                    onChange={onToggleSelection}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 h-5 w-5 mr-3 rounded bg-slate-800 border-slate-500 text-blue-500 focus:ring-blue-500 cursor-pointer"
                    aria-label={`選擇合約 ${contract.title}`}
                />
                <div className="flex items-center flex-grow min-w-0 mr-2">
                    <img
                        src={contract.thumbnailUrl}
                        alt={`${contract.title} 預覽`}
                        className="w-10 h-14 object-cover rounded-md mr-3 flex-shrink-0 bg-slate-600 border border-slate-500"
                        aria-hidden="true"
                    />
                    <div className="flex items-center space-x-2 min-w-0 flex-grow">
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onBlur={handleRenameConfirm}
                                onKeyDown={handleKeyDown}
                                className="bg-slate-600 text-white rounded px-1 -my-1 w-full font-medium"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <>
                                <p className="font-medium truncate">{contract.title}</p>
                                {contract.status === 'analyzing' && (
                                    <div className="w-4 h-4 border-2 border-t-blue-400 border-slate-500 rounded-full animate-spin flex-shrink-0" title="分析中..."></div>
                                )}
                                {contract.status === 'error' && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                        <title>分析失敗</title>
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </>
                        )}
                    </div>
                </div>
                {!isEditing && (
                    <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-500 hover:text-white transition-all"
                            aria-label={`重新命名合約 ${contract.title}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </li>
    );
};

const ContractList: React.FC<ContractListProps> = (props) => {
    const { contracts, selectedContractId, selection, onSelectContract, onRenameContract, onSelectionChange } = props;

    return (
        <div className="flex-grow flex flex-col min-h-0">
            <div className="flex-shrink-0 mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-300">已上傳合約</h2>
            </div>

            <div className="flex-grow overflow-y-auto pr-1 space-y-4">
                <div className="p-2 rounded-lg">
                    {contracts.length > 0 ? (
                        <ul className="space-y-2">
                            {contracts.map(contract => (
                                <ContractItem
                                    key={contract.id}
                                    contract={contract}
                                    isSelected={selectedContractId === contract.id}
                                    isMultiSelected={selection.has(contract.id)}
                                    onSelect={() => onSelectContract(contract)}
                                    onToggleSelection={() => onSelectionChange(contract.id)}
                                    onRename={(newName) => onRenameContract(contract.id, newName)}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-500 text-center py-4">尚無合約。</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContractList;
