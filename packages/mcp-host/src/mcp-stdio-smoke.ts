import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export type McpStdioSmokeOptions = {
    mcpServePath: string;
    generatedModulePath: string;
    toolName: string;
    toolArgs?: Record<string, unknown>;
    hostArgs?: string[];
    cwd?: string;
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
};

export type McpStdioSmokeResult = {
    toolNames: string[];
    responseText: string;
    responseJson: unknown;
    stderr: string;
};

function mergeEnv(overrides: Record<string, string | undefined> | undefined): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    for (const [key, value] of Object.entries(overrides ?? {})) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    return env;
}

function collectStderr(transport: StdioClientTransport): () => string {
    let stderr = '';
    transport.stderr?.on('data', (chunk: unknown) => {
        stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    });
    return () => stderr.trim();
}

function errorWithStderr(message: string, stderr: string): Error {
    return new Error(stderr.length > 0 ? `${message}\nMCP stderr:\n${stderr}` : message);
}

function extractTextContent(result: Awaited<ReturnType<Client['callTool']>>, stderr: string): string {
    if (!('content' in result) || !Array.isArray(result.content)) {
        throw errorWithStderr('MCP tool call did not return content.', stderr);
    }
    const text = result.content.find((item) => item.type === 'text');
    if (!text || typeof text.text !== 'string') {
        throw errorWithStderr('MCP tool call did not return text content.', stderr);
    }
    return text.text;
}

export async function runMcpStdioSmoke(options: McpStdioSmokeOptions): Promise<McpStdioSmokeResult> {
    const timeout = options.timeoutMs ?? 15_000;
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [options.mcpServePath, options.generatedModulePath, ...(options.hostArgs ?? [])],
        cwd: options.cwd,
        env: mergeEnv(options.env),
        stderr: 'pipe'
    });
    const readStderr = collectStderr(transport);
    const client = new Client({ name: 'core2ai-stdio-smoke', version: '0.0.1' });

    try {
        await client.connect(transport, { timeout });
        const tools = await client.listTools(undefined, { timeout });
        const toolNames = tools.tools.map((tool) => tool.name);
        if (!toolNames.includes(options.toolName)) {
            throw errorWithStderr(
                `MCP tool "${options.toolName}" not found. Available tools: ${toolNames.join(', ')}`,
                readStderr()
            );
        }

        const result = await client.callTool(
            {
                name: options.toolName,
                arguments: options.toolArgs ?? {}
            },
            undefined,
            { timeout }
        );
        if ('isError' in result && result.isError === true) {
            throw errorWithStderr(`MCP tool "${options.toolName}" returned an error result.`, readStderr());
        }

        const responseText = extractTextContent(result, readStderr());
        let responseJson: unknown;
        try {
            responseJson = JSON.parse(responseText);
        } catch (error) {
            throw errorWithStderr(
                `MCP tool "${options.toolName}" did not return parseable JSON text: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                readStderr()
            );
        }

        return {
            toolNames,
            responseText,
            responseJson,
            stderr: readStderr()
        };
    } finally {
        await client.close();
    }
}
