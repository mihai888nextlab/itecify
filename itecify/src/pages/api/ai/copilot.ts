import type { NextApiRequest, NextApiResponse } from 'next';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface CopilotRequest {
  projectId: string;
  code: string;
  cursorPosition: { line: number; ch: number };
  language: string;
  filename?: string;
}

interface Suggestion {
  intent: string;
  type: 'refactor' | 'optimize' | 'fix' | 'security' | 'best-practice';
  code?: string;
  explanation: string;
  severity: 'high' | 'medium' | 'low';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { code, language, filename, cursorPosition } = req.body as CopilotRequest;

  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  const systemPrompt = `You are an expert ${language || 'JavaScript'} developer reviewing code.

REVIEW THE CODE AND:
1. Find syntax errors (code that won't run)
2. Find type errors (wrong types, like TypeScript in JS)
3. Find logic errors (code runs but does wrong thing)
4. Find undefined/null access issues
5. Find security vulnerabilities

DO NOT SUGGEST:
- Adding semicolons
- Changing quote styles
- Style preferences
- Code refactoring (unless there's a real bug)

FOR EACH REAL ISSUE FOUND, RETURN:
- intent: Plain English description of the problem
- type: "fix" or "security"
- code: The corrected code (if applicable)
- explanation: Brief explanation in plain English
- severity: "high" if it will crash, "medium" otherwise

RETURN EMPTY ARRAY [] IF CODE IS CORRECT.
Return ONLY JSON, no explanations.`;
  
  const userPrompt = `Language: ${language || 'JavaScript'}
${filename ? `File: ${filename}` : ''}

Code to analyze:
\`\`\`${language || 'javascript'}
${code}
\`\`\`

Return JSON array only:`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      return res.status(500).json({ error: `AI service error: ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let suggestions: Suggestion[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    const topSuggestion = suggestions.length > 0 ? suggestions[0] : null;

    return res.status(200).json({
      success: true,
      intent: topSuggestion?.intent || 'Code looks good!',
      type: topSuggestion?.type || null,
      suggestion: topSuggestion?.code ? {
        code: topSuggestion.code,
        type: topSuggestion.type,
        explanation: topSuggestion.explanation,
        severity: topSuggestion.severity,
        from: 0,
        to: code.length,
      } : null,
      allSuggestions: suggestions,
      cursorPosition,
    });
  } catch (error: any) {
    console.error('AI copilot error:', error);
    return res.status(500).json({ error: error.message || 'AI analysis failed' });
  }
}
