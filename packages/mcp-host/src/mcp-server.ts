import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { loadLocalEnvFiles } from './env.js';
import type { GeneratedMcpModule } from './mcp-host-adapter.js';

function requireMcpServerIdentity(generated: GeneratedMcpModule): { name: string; version: string } {
    const name = generated.mcpServerName?.trim();
    const version = generated.mcpServerVersion?.trim();
    if (!name) {
        throw new Error('Generated module must export "mcpServerName". Regenerate tool code.');
    }
    if (!version) {
        throw new Error('Generated module must export "mcpServerVersion". Regenerate tool code.');
    }
    return { name, version };
}

function requireInputZodSchema(inputZodByTool: Record<string, unknown> | undefined, toolName: string): z.ZodTypeAny {
    if (!inputZodByTool) {
        throw new Error('Generated module must export "inputZodByTool". Regenerate tool code.');
    }
    const schema = inputZodByTool[toolName];
    if (!schema || typeof schema !== 'object') {
        throw new Error(
            `Generated module inputZodByTool has no schema for tool "${toolName}". Regenerate tool code.`
        );
    }
    return schema as z.ZodTypeAny;
}

function reloadEnvFilesForDev(generated: GeneratedMcpModule): void {
    const dirs = generated.adapter.envDirsForReload();
    if (dirs.length > 0) {
        loadLocalEnvFiles(dirs);
    }
}

export async function runMcpServer(generated: GeneratedMcpModule): Promise<void> {
    const { name, version } = requireMcpServerIdentity(generated);
    const server = new McpServer({ name, version });

    for (const tool of generated.generatedTools) {
        const inputSchema = requireInputZodSchema(generated.inputZodByTool, tool.toolName);

        server.registerTool(
            tool.toolName,
            {
                title: typeof tool.title === 'string' && tool.title.length > 0 ? tool.title : undefined,
                description: tool.description,
                inputSchema
            },
            async (args) => {
                reloadEnvFilesForDev(generated);
                const hostContext = generated.adapter.resolveHostContext();
                const result = await generated.invokeTool(
                    tool.toolName,
                    (args ?? {}) as Record<string, unknown>,
                    hostContext
                );
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
        );
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
