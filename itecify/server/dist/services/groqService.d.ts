interface CopilotSuggestion {
    intent: string;
    type: 'refactor' | 'optimize' | 'fix' | 'security' | 'best-practice';
    code?: string;
    explanation: string;
    from?: number;
    to?: number;
    severity: 'high' | 'medium' | 'low';
}
export declare function copilotSuggest(apiKey: string, code: string, language: string, filename?: string, cursorContext?: string): Promise<CopilotSuggestion[]>;
export declare function generateCode(apiKey: string, code: string, language: string, instruction: string, model?: string): Promise<string>;
export declare function analyzeCode(apiKey: string, code: string, language: string, task: 'review' | 'fix' | 'optimize' | 'explain'): Promise<string>;
export {};
//# sourceMappingURL=groqService.d.ts.map