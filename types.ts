
import type { GenerateContentResponse } from '@google/genai';

export interface TokenUsage {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export interface ExtractedData {
    summary: string;
    schedule: string[];
    personnel: string[];
    paymentTerms: string[];
}

export interface Contract {
    id: string;
    name: string;
    thumbnailUrl: string;
    status: 'analyzing' | 'completed' | 'error';
    errorMessage?: string;
    extractedData?: ExtractedData;
    chatHistory: ChatMessage[];
    analysisTokenCount?: TokenUsage;
    groupId: string | null;
}

export interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
    tokenCount?: TokenUsage;
}

export interface ContractGroup {
    id: string;
    name: string;
    contractIds: string[];
}


// Exporting GenerateContentResponse to be used in geminiService
export type { GenerateContentResponse };
