import { renderMcpHostSharedSource } from './render-mcp-host-shared.js';
import { requireBaseUrlEnvArgvCheck, type McpHostProduct } from './mcp-host-product-runtime.js';

/**
 * Static MCP stdio host for generated `cli/stdio-mcp-server.ts`.
 */
export function renderStdioMcpServerSource(product: McpHostProduct = 'api2ai'): string {
    const shared = renderMcpHostSharedSource('stdio', product);
    return `#!/usr/bin/env node
/**
 * Generated MCP stdio host (static runtime — no @core2ai/core).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

${shared}

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

async function runStdioMcpStandaloneFromArgv(argv: string[]): Promise<void> {
    const modulePath = argv[0];
    if (!modulePath) {
        throw new Error('Usage: node stdio-mcp-server.js <path-to-*-tools.js> [host options...]');
    }
    const envDirs = [process.cwd(), path.dirname(path.resolve(modulePath))];
    loadLocalEnvFiles(envDirs);
    const imported = await import(pathToFileURL(path.resolve(modulePath)).href);
    if (!imported || typeof imported !== 'object') {
        throw new Error(\`Generated module "\${modulePath}" did not export an object.\`);
    }
    const generated = readGeneratedModule(imported as Record<string, unknown>);
    const hostConfig = parseHostArgv(argv.slice(1), envDirs);
    ${requireBaseUrlEnvArgvCheck(product, 'hostConfig.baseUrlEnvKey')}
    validateHostAtStartup(hostConfig, generated);
    console.error('[mcp] host context refreshed each tool call');
    await runStdioMcpServer(generated, hostConfig);
}

await runStdioMcpStandaloneFromArgv(process.argv.slice(2));
`;
}
