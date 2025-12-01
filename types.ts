```

import type { GenerateContentResponse } from '@google/genai';

export interface ExtractedData {
    summary: string;
    schedule: string[];
    personnel: string[];
    paymentTerms: string[];
}

export interface TokenUsage {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export interface ChatMessage {
    id?: number;
    role: 'user' | 'ai'; // Backend uses 'role', frontend used 'sender'
    content: string; // Backend uses 'content', frontend used 'text'
    timestamp?: string;
}

export interface Contract {
    id: number; // Backend uses int
    title: string; // Backend uses title
    filename: string;
    status: 'uploading' | 'analyzing' | 'completed' | 'error';
    extracted_data?: ExtractedData; // Backend uses snake_case
    created_at: string;
    chat_history: ChatMessage[];
    // Computed on frontend
    thumbnailUrl?: string;
}

export interface ContractGroup {
    id: string;
    name: string;
    contractIds: string[];
}


// Exporting GenerateContentResponse to be used in geminiService
export type { GenerateContentResponse };
