
import type { Contract, ContractGroup } from '../types';

const DB_NAME = 'ContractAnalyzerDB';
const CONTRACT_STORE_NAME = 'contracts';
const GROUP_STORE_NAME = 'groups';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                dbPromise = null;
                reject('Error opening database.');
            };

            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                db.onclose = () => {
                    console.warn('Database connection closed.');
                    dbPromise = null;
                };
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(CONTRACT_STORE_NAME)) {
                    db.createObjectStore(CONTRACT_STORE_NAME, { keyPath: 'id' });
                }
                 if (!db.objectStoreNames.contains(GROUP_STORE_NAME)) {
                    db.createObjectStore(GROUP_STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }
    return dbPromise;
};

// --- Contract Functions ---
export const addContract = async (contract: Contract): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CONTRACT_STORE_NAME, 'readwrite');
        transaction.objectStore(CONTRACT_STORE_NAME).put(contract);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Error adding contract:', transaction.error);
            reject('Could not add contract.');
        };
    });
};

export const getAllContracts = async (): Promise<Contract[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CONTRACT_STORE_NAME, 'readonly');
        const request = transaction.objectStore(CONTRACT_STORE_NAME).getAll();
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => {
            console.error('Error fetching contracts:', transaction.error);
            reject('Could not fetch contracts.');
        };
    });
};

// --- Group Functions ---
export const addGroup = async (group: ContractGroup): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(GROUP_STORE_NAME, 'readwrite');
        transaction.objectStore(GROUP_STORE_NAME).put(group);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Error adding group:', transaction.error);
            reject('Could not add group.');
        }
    });
};

export const getAllGroups = async (): Promise<ContractGroup[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(GROUP_STORE_NAME, 'readonly');
        const request = transaction.objectStore(GROUP_STORE_NAME).getAll();
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => {
            console.error('Error fetching groups:', transaction.error);
            reject('Could not fetch groups.');
        };
    });
};


// --- Bulk Operations ---
export const performBulkDelete = async (
    contractIdsToDelete: Set<string>,
    groupIdsToDelete: Set<string>
): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONTRACT_STORE_NAME, GROUP_STORE_NAME], 'readwrite');
        const contractStore = transaction.objectStore(CONTRACT_STORE_NAME);
        const groupStore = transaction.objectStore(GROUP_STORE_NAME);
        
        const groupUpdateRequestMap = new Map<string, IDBRequest<IDBValidKey>>();

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Bulk delete transaction error:', transaction.error);
            reject('Bulk delete transaction failed.');
        };

        // Step 1: Delete all contracts belonging to the groups marked for deletion
        groupIdsToDelete.forEach(groupId => {
             const getGroupReq = groupStore.get(groupId);
             getGroupReq.onsuccess = () => {
                const group: ContractGroup = getGroupReq.result;
                if (group) {
                    group.contractIds.forEach(contractId => {
                        contractStore.delete(contractId);
                    });
                }
             };
             groupStore.delete(groupId);
        });

        // Step 2: Delete individually selected contracts
        contractIdsToDelete.forEach(id => {
            const getContractReq = contractStore.get(id);
            getContractReq.onsuccess = () => {
                const contract: Contract = getContractReq.result;
                if (contract && contract.groupId && !groupUpdateRequestMap.has(contract.groupId)) {
                    // If we need to update a group, fetch it first
                    const getGroupReq = groupStore.get(contract.groupId);
                    groupUpdateRequestMap.set(contract.groupId, getGroupReq);

                    getGroupReq.onsuccess = () => {
                        const group: ContractGroup = getGroupReq.result;
                        if(group) {
                            group.contractIds = group.contractIds.filter(cid => !contractIdsToDelete.has(cid));
                            groupStore.put(group);
                        }
                    }
                }
            };
            contractStore.delete(id);
        });
    });
};
