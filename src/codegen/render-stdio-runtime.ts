import { renderMcpHostSharedSource } from './render-mcp-host-shared.js';
import { requireBaseUrlEnvArgvCheck, type McpHostProduct } from './mcp-host-product-runtime.js';

/**
 * Generated `cli/stdio-runtime.ts` — import tools module, call `runStdioMcp(tools, argv)`.
 */
export function renderStdioMcpRuntimeSource(product: McpHostProduct = 'api2ai', loggingImport: string): string {
    const shared = renderMcpHostSharedSource('stdio', product);
    return `/**
 * Generated MCP stdio runtime (static tools import — no @toolfactory.dev/core).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, type ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { loggingAdapter } from '${loggingImport}';

${shared}

function defaultMcpEnvDirs(): string[] {
    const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
    return [process.cwd(), path.join(runtimeDir, '..', 'tools')];
}

async function runStdioMcpServer(
    generated: ReturnType<typeof readGeneratedModule>,
    hostConfig: HostRuntimeConfig
): Promise<void> {
    const { name, version } = requireMcpServerIdentity(generated);
    const server = new McpServer({ name, version });
    await registerMcpTools(server, generated, {
        envDirs: hostConfig.envDirs,
        resolveContext: () => resolveHostContextForCall(hostConfig, generated)
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

export async function runStdioMcp(
    toolsModule: Record<string, unknown>,
    argv: string[],
    envDirs: string[] = defaultMcpEnvDirs()
): Promise<void> {
    loadLocalEnvFiles(envDirs);
    const generated = readGeneratedModule(toolsModule);
    const hostConfig = parseHostArgv(argv, envDirs);
    ${requireBaseUrlEnvArgvCheck(product, 'hostConfig.baseUrlEnvKey')}
    validateHostAtStartup(hostConfig, generated);
    printStdioMcpStartupBanner(generated, hostConfig);
    await runStdioMcpServer(generated, hostConfig);
}
`;
}
