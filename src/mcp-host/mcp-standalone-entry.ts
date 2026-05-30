/**
 * MCP stdio launcher — imported by generated `mcp-serve.ts` or run directly.
 */
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLocalEnvFiles } from './env.js';
import { readGeneratedModule } from './mcp-host-adapter.js';
import { runMcpServer } from './mcp-server.js';

export async function runMcpStandaloneFromArgv(argv: string[]): Promise<void> {
    const modulePath = argv[0];
    if (!modulePath) {
        throw new Error('Usage: node mcp-serve.js <path-to-*-tools.js> [host options...]');
    }

    const envDirs = [process.cwd(), path.dirname(path.resolve(modulePath))];
    loadLocalEnvFiles(envDirs);

    const imported = await import(pathToFileURL(path.resolve(modulePath)).href);
    if (!imported || typeof imported !== 'object') {
        throw new Error(`Generated module "${modulePath}" did not export an object.`);
    }

    const generated = readGeneratedModule(imported as Record<string, unknown>);
    generated.adapter.configureFromArgv(argv.slice(1), envDirs);
    generated.adapter.validateAtStartup(generated.requiresAuth === true);

    console.error('[mcp] host context refreshed each tool call');

    await runMcpServer(generated);
}

const invokedDirectly =
    process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
    await runMcpStandaloneFromArgv(process.argv.slice(2));
}
