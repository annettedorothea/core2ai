import { compose } from '../compose.js';

const STDIO_RUNTIME_SKELETON = `/**
 * Generated MCP stdio runtime (static tools import — no @toolfactory.dev/core).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, type ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { loggingAdapter } from '<<loggingImport>>';

<<sharedHost>>

function defaultMcpEnvDirs(): string[] {
    const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
    return [process.cwd(), path.join(runtimeDir, '..', 'tools')];
}

async function runStdioMcpServer(
    generated: ReturnType<typeof readGeneratedModule>,
    hostConfig: HostRuntimeConfig
): Promise<void> {
    const { name } = requireMcpServerIdentity(generated);
    const server = new McpServer({
        name,
        version: formatMcpDisplayVersion(generated),
        icons: resolveMcpServerIcons(hostConfig.iconPath)
    });
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
    <<requireBaseUrlEnvArgvCheck>>
    validateHostAtStartup(hostConfig, generated);
    printStdioMcpStartupBanner(generated, hostConfig);
    await runStdioMcpServer(generated, hostConfig);
}
`;

export type StdioRuntimeTemplateSlots = {
    loggingImport: string;
    sharedHost: string;
    requireBaseUrlEnvArgvCheck: string;
};

export function renderStdioRuntimeTemplate(slots: StdioRuntimeTemplateSlots): string {
    return compose(STDIO_RUNTIME_SKELETON, slots);
}
