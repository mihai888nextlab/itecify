import { z } from 'zod';
import { generateCode, analyzeCode } from '../services/groqService.js';
const generateSchema = z.object({
    code: z.string(),
    language: z.string().default('javascript'),
    instruction: z.string().default('Complete this code'),
    model: z.string().default('llama-3.1-8b-instant'),
});
const analyzeSchema = z.object({
    code: z.string(),
    language: z.string().default('javascript'),
    task: z.enum(['review', 'fix', 'optimize', 'explain']).default('review'),
});
const aiRoutes = async (fastify) => {
    fastify.post('/generate', async (request, reply) => {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return reply.code(500).send({
                success: false,
                error: 'AI service not configured. Please set GROQ_API_KEY in environment.',
            });
        }
        try {
            const body = generateSchema.parse(request.body);
            const result = await generateCode(apiKey, body.code, body.language, body.instruction, body.model);
            return {
                success: true,
                content: result,
                model: body.model,
            };
        }
        catch (error) {
            fastify.log.error('AI generation error:', error);
            return reply.code(500).send({
                success: false,
                error: error.message || 'AI generation failed',
            });
        }
    });
    fastify.post('/analyze', async (request, reply) => {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return reply.code(500).send({
                success: false,
                error: 'AI service not configured. Please set GROQ_API_KEY in environment.',
            });
        }
        try {
            const body = analyzeSchema.parse(request.body);
            const result = await analyzeCode(apiKey, body.code, body.language, body.task);
            return {
                success: true,
                content: result,
                task: body.task,
            };
        }
        catch (error) {
            fastify.log.error('AI analysis error:', error);
            return reply.code(500).send({
                success: false,
                error: error.message || 'AI analysis failed',
            });
        }
    });
    fastify.get('/models', async () => {
        return {
            models: [
                { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)', description: 'Fast, free tier' },
                { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Powerful)', description: 'More capable, slower' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Good balance' },
            ],
        };
    });
};
export default aiRoutes;
//# sourceMappingURL=ai.js.map