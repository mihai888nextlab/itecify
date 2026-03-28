import { z } from 'zod';
import { executeCode } from '../services/codeExecutor.js';
const executeSchema = z.object({
    code: z.string(),
    language: z.enum(['javascript', 'typescript', 'python']).default('javascript'),
});
const executionRoutes = async (fastify) => {
    fastify.post('/execute', async (request, reply) => {
        try {
            const body = executeSchema.parse(request.body);
            const startTime = Date.now();
            const result = await executeCode(body.code, body.language);
            const executionTime = Date.now() - startTime;
            return {
                success: result.success,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                executionTime,
                error: result.error,
            };
        }
        catch (error) {
            fastify.log.error('Execution error:', error);
            return reply.code(500).send({
                success: false,
                error: 'Execution failed',
                details: error.message,
            });
        }
    });
    fastify.get('/languages', async () => {
        return {
            languages: [
                { id: 'javascript', name: 'JavaScript', extension: '.js' },
                { id: 'typescript', name: 'TypeScript', extension: '.ts' },
                { id: 'python', name: 'Python', extension: '.py' },
            ],
        };
    });
};
export default executionRoutes;
//# sourceMappingURL=execution.js.map