import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export type McpStdioConnectOptions = {
    mcpServePath: string;
    generatedModulePath: string;
    hostArgs?: string[];
    cwd?: string;
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
};

export type McpStdioSession = {
    listToolNames: () => Promise<string[]>;
    callTool: (toolName: string, toolArgs?: Record<string, unknown>) => Promise<unknown>;
    stderr: () => string;
    close: () => Promise<void>;
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

/** Spawn generated `mcp-serve.js` and connect an MCP client over stdio. */
export async function connectMcpStdio(options: McpStdioConnectOptions): Promise<McpStdioSession> {
    const timeout = options.timeoutMs ?? 15_000;
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [options.mcpServePath, options.generatedModulePath, ...(options.hostArgs ?? [])],
        cwd: options.cwd,
        env: mergeEnv(options.env),
        stderr: 'pipe'
    });
    const readStderr = collectStderr(transport);
    const client = new Client({ name: 'cli-stdio-smoke', version: '0.0.1' });
    await client.connect(transport, { timeout });

    return {
        async listToolNames() {
            const tools = await client.listTools(undefined, { timeout });
            return tools.tools.map((tool) => tool.name);
        },
        async callTool(toolName, toolArgs) {
            const result = await client.callTool(
                {
                    name: toolName,
                    arguments: toolArgs ?? {}
                },
                undefined,
                { timeout }
            );
            if ('isError' in result && result.isError === true) {
                throw errorWithStderr(`MCP tool "${toolName}" returned an error result.`, readStderr());
            }
            const responseText = extractTextContent(result, readStderr());
            try {
                return JSON.parse(responseText) as unknown;
            } catch (error) {
                throw errorWithStderr(
                    `MCP tool "${toolName}" did not return parseable JSON text: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                    readStderr()
                );
            }
        },
        stderr: readStderr,
        async close() {
            await client.close();
        }
    };
}

export async function withMcpStdioSession(
    options: McpStdioConnectOptions,
    run: (session: McpStdioSession) => Promise<void>
): Promise<void> {
    const session = await connectMcpStdio(options);
    try {
        await run(session);
    } finally {
        await session.close();
    }
}
