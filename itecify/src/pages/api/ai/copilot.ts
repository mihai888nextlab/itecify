import type { NextApiRequest, NextApiResponse } from 'next';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface CopilotRequest {
  projectId: string;
  code: string;
  cursorPosition: { line: number; ch: number };
  language: string;
  filename?: string;
}

interface ChangedLine {
  lineNumber: number;
  original: string;
  fixed: string;
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

  const systemPrompt = `You are an expert ${language || 'JavaScript'} code analyzer.

Look for ACTUAL ERRORS in the code:
1. Syntax errors - code that won't run at all
2. Type errors - using wrong variable types (e.g., "int" in JavaScript)
3. Undefined variables - using variables that weren't declared
4. Logic errors - code that runs but does the wrong thing
5. Missing brackets, parentheses, or semicolons that break the code

Examples of bugs to fix:
- JavaScript: "int x = 10" → should be "let x = 10"
- Python: "print("hello" (missing closing paren)
- JavaScript: "console.log(undefinedVar)" where undefinedVar doesn't exist
- Any language: mismatched brackets/braces

Return this EXACT JSON format:
{
  "hasChanges": true,
  "fixedCode": "THE ENTIRE CODE WITH FIXES",
  "changes": [
    {"lineNumber": 1, "original": "int x = 10", "fixed": "let x = 10"}
  ],
  "intent": "Fix: [brief description]",
  "explanation": "[one sentence explanation]"
}

If NO bugs found: {"hasChanges": false, "fixedCode": "", "changes": [], "intent": "No issues found"}`;

  const userPrompt = `Find and fix bugs in this ${language || 'JavaScript'} code:

${filename ? `File: ${filename}` : ''}

\`\`\`${language || 'javascript'}
${code}
\`\`\`

Return the COMPLETE fixed code and list each change with line numbers.
IMPORTANT: Only fix actual bugs, not style preferences.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      return res.status(500).json({ error: `AI service error: ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log('[AI Copilot] Raw AI response:', content);

    let parsed: any = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
        console.log('[AI Copilot] Parsed JSON:', JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.error('[AI Copilot] Failed to parse AI response:', e, 'Content:', content);
    }

    if (parsed && parsed.hasChanges && parsed.changes && parsed.changes.length > 0) {
      const changedLines: ChangedLine[] = parsed.changes.map((c: any) => ({
        lineNumber: c.lineNumber,
        original: c.original,
        fixed: c.fixed,
      }));

      return res.status(200).json({
        success: true,
        intent: parsed.intent || 'Code fixed',
        explanation: parsed.explanation,
        hasChanges: true,
        fixedCode: parsed.fixedCode,
        changes: changedLines,
      });
    }

    return res.status(200).json({
      success: true,
      intent: 'Code looks good!',
      hasChanges: false,
      changes: [],
    });
  } catch (error: any) {
    console.error('AI copilot error:', error);
    return res.status(500).json({ error: error.message || 'AI analysis failed' });
  }
}
