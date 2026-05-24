/**
 * Bundled by consumer CLI (esbuild) → mcp-serve-emitted.mjs → generated/cli/mcp-serve.mjs.
 */
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadLocalEnvFiles } from './env.js';
import { readGeneratedModule } from './mcp-host-adapter.js';
import { runMcpServer } from './mcp-server.js';

const argv = process.argv.slice(2);
const modulePath = argv[0];
if (!modulePath) {
    throw new Error('Usage: node mcp-serve.mjs <path-to-*-tools.mjs> [host options...]');
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
