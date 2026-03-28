const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export async function copilotSuggest(apiKey, code, language, filename, cursorContext) {
    const systemPrompt = `You are an expert code assistant helping a developer in real-time. Your job is to:

1. Analyze the code for potential issues (bugs, errors, security vulnerabilities)
2. Suggest improvements and best practices
3. Offer helpful refactoring when code could be cleaner
4. Identify where new code could be added to complete the current task

IMPORTANT RULES:
- Be concise and actionable
- Focus on the most impactful suggestions
- If code looks complete and well-written, suggest ONE minor improvement or nothing at all
- Prioritize fixes over refactoring
- Look for common mistakes in ${language}

Return your response as a JSON array with this exact format:
[
  {
    "intent": "Short description of what you're suggesting (e.g., 'Fix: undefined variable', 'Improve: use const instead of var')",
    "type": "fix|optimize|refactor|security|best-practice",
    "code": "The exact code to insert (optional, for refactor/optimize)",
    "explanation": "Brief explanation of why this helps",
    "severity": "high|medium|low"
  }
]

If no improvements are needed, return an empty array [].`;
    const fileContext = filename ? `File: ${filename}` : `Language: ${language}`;
    const cursorInfo = cursorContext ? `\nCursor context (recent lines):\n${cursorContext}` : '';
    const userPrompt = `${fileContext}${cursorInfo}

Current code:
\`\`\`${language}
${code}
\`\`\`

Analyze this code and provide suggestions. Focus on:
- Errors or bugs
- Security issues
- Performance improvements
- Best practices for ${language}
- Missing functionality

Return JSON array only, no other text:`;
    const request = {
        model: 'llama-3.1-70b-versatile',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
    };
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${error}`);
    }
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return [];
    }
    catch (e) {
        console.error('Failed to parse copilot response:', e);
        return [];
    }
}
export async function generateCode(apiKey, code, language, instruction, model = 'llama-3.1-8b-instant') {
    const systemPrompt = `You are an expert ${language} programmer. Generate code based on the user's request. 
Only return the code, no explanations. Wrap code in markdown code blocks with the language specified.
Keep the code concise and production-ready.`;
    const userPrompt = `Current code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nInstruction: ${instruction}`;
    const request = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
    };
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${error}`);
    }
    const data = await response.json();
    let content = data.choices[0]?.message?.content || '';
    const codeBlockMatch = content.match(/```(?:\w+)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
        content = codeBlockMatch[1].trim();
    }
    return content;
}
export async function analyzeCode(apiKey, code, language, task) {
    const tasks = {
        review: 'Review this code and suggest improvements. Return only the suggestions.',
        fix: 'Find and fix bugs in this code. Return only the corrected code wrapped in markdown.',
        optimize: 'Optimize this code for better performance. Return only the optimized code.',
        explain: 'Explain what this code does in simple terms.',
    };
    const systemPrompt = `You are an expert ${language} programmer.`;
    const userPrompt = `${tasks[task]}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``;
    const request = {
        model: 'llama-3.1-8b-instant',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2048,
    };
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${error}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}
//# sourceMappingURL=groqService.js.map