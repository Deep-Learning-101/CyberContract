import type { Contract, ChatMessage } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const uploadContract = async (file: File): Promise<Contract> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
};

export const getContracts = async (): Promise<Contract[]> => {
    const response = await fetch(`${API_BASE_URL}/contracts`);
    if (!response.ok) {
        throw new Error(`Failed to fetch contracts: ${response.statusText}`);
    }
    return response.json();
};

export const getContract = async (id: number): Promise<Contract> => {
    const response = await fetch(`${API_BASE_URL}/contracts/${id}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch contract: ${response.statusText}`);
    }
    return response.json();
};

export const deleteContract = async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/contracts/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error(`Failed to delete contract: ${response.statusText}`);
    }
};

export const chatWithContract = async (contractId: number, message: string): Promise<ChatMessage> => {
    const response = await fetch(`${API_BASE_URL}/chat/${contractId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'user', content: message }),
    });

    if (!response.ok) {
        throw new Error('Chat failed');
    }

    return response.json();
};

export const globalChat = async (contractIds: number[], message: string): Promise<ChatMessage> => {
    const response = await fetch(`${API_BASE_URL}/chat/global`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contract_ids: contractIds, message }),
    });

    if (!response.ok) {
        throw new Error('Global chat failed');
    }

    return response.json();
};

// Helper to get full thumbnail URL
export const getThumbnailUrl = (filename: string) => {
    // Assuming backend serves uploads at /uploads
    // We need to strip the extension and add .jpg as per backend logic
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    return `http://localhost:8000/uploads/thumbnails/${nameWithoutExt}.jpg`;
};
