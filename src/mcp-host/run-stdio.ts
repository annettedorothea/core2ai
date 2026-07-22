import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseHostArgv } from './argv.js';
import { loadLocalEnvFiles } from './env-loading.js';
import { requireBaseUrlEnvArgvCheck, resolveHostContextForCall, validateHostAtStartup } from './host-context.js';
import { formatMcpDisplayVersion, requireMcpServerIdentity } from './identity.js';
import { resolveMcpServerIcons } from './icons.js';
import { readGeneratedModule } from './read-generated-module.js';
import { registerMcpTools } from './register-mcp-tools.js';
import { printStdioMcpStartupBanner } from './startup-banner.js';
import type { GeneratedHostModule, HostRuntimeConfig } from './types.js';

/**
 * Env search roots relative to a generated server stub (`servers/*.ts`) or cli runtime.
 * Pass `import.meta.url` from the stub so paths resolve next to generated tools, not core.
 */
export function defaultMcpEnvDirsFromMetaUrl(metaUrl: string): string[] {
    const runtimeDir = path.dirname(fileURLToPath(metaUrl));
    return [process.cwd(), path.join(runtimeDir, '..', 'tools')];
}

async function runStdioMcpServer(generated: GeneratedHostModule, hostConfig: HostRuntimeConfig): Promise<void> {
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
    envDirs: string[] = [process.cwd()]
): Promise<void> {
    loadLocalEnvFiles(envDirs);
    const generated = readGeneratedModule(toolsModule);
    const hostConfig = parseHostArgv(argv, envDirs);
    requireBaseUrlEnvArgvCheck(generated, hostConfig.baseUrlEnvKey);
    validateHostAtStartup(hostConfig, generated);
    printStdioMcpStartupBanner(generated, hostConfig);
    await runStdioMcpServer(generated, hostConfig);
}
