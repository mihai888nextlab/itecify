export declare function generateCode(apiKey: string, code: string, language: string, instruction: string, model?: string): Promise<string>;
export declare function analyzeCode(apiKey: string, code: string, language: string, task: 'review' | 'fix' | 'optimize' | 'explain'): Promise<string>;
//# sourceMappingURL=groqService.d.ts.map