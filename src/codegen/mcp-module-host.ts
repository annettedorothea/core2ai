import * as path from 'node:path';
import { relativeJsImportPath } from './generated-layout.js';

/** Host kinds for per-module MCP server entrypoints under `generated/<product>/servers/`. */
export type McpModuleHostKind = 'stdio' | 'public-http' | 'passthrough-http' | 'oauth-http';

const HOST_KIND_CONFIG: Record<McpModuleHostKind, { fileStem: string; runtimeFile: string; runExport: string }> = {
    stdio: { fileStem: 'stdio-mcp-server', runtimeFile: 'stdio-runtime', runExport: 'runStdioMcp' },
    'public-http': {
        fileStem: 'public-http-mcp-server',
        runtimeFile: 'public-http-runtime',
        runExport: 'runPublicHttpMcp'
    },
    'passthrough-http': {
        fileStem: 'passthrough-http-mcp-server',
        runtimeFile: 'passthrough-http-runtime',
        runExport: 'runPassthroughHttpMcp'
    },
    'oauth-http': {
        fileStem: 'oauth-http-mcp-server',
        runtimeFile: 'oauth-http-runtime',
        runExport: 'runOAuthHttpMcp'
    }
};

/** `github-tools.ts` → `github`. */
export function moduleBasenameFromToolsPath(toolsModuleTsPath: string): string {
    const base = path.parse(toolsModuleTsPath).name;
    if (base.endsWith('-tools')) {
        return base.slice(0, -'-tools'.length);
    }
    return base;
}

export function resolveGeneratedServersDir(toolsModuleTsPath: string): string {
    const toolsDir = path.dirname(path.resolve(toolsModuleTsPath));
    return path.join(path.dirname(toolsDir), 'servers');
}

export function moduleMcpServerFileName(moduleBasename: string, hostKind: McpModuleHostKind): string {
    const stem = HOST_KIND_CONFIG[hostKind].fileStem;
    return `${moduleBasename}-${stem}.ts`;
}

export function renderModuleMcpServerSource(
    hostKind: McpModuleHostKind,
    toolsModuleTsPath: string,
    serverTsPath: string
): string {
    const cfg = HOST_KIND_CONFIG[hostKind];
    const toolsImport = relativeJsImportPath(serverTsPath, toolsModuleTsPath);
    const runtimeTsPath = path.join(path.dirname(serverTsPath), '..', 'cli', `${cfg.runtimeFile}.ts`);
    const runtimeImport = relativeJsImportPath(serverTsPath, runtimeTsPath);
    const moduleBasename = moduleBasenameFromToolsPath(toolsModuleTsPath);
    return `#!/usr/bin/env node
/**
 * Generated MCP ${hostKind} host for ${moduleBasename} (static tools import).
 */
import * as tools from '${toolsImport}';
import { ${cfg.runExport} } from '${runtimeImport}';

await ${cfg.runExport}(tools, process.argv.slice(2));
`;
}

export const MCP_MODULE_HOST_KINDS: readonly McpModuleHostKind[] = [
    'stdio',
    'public-http',
    'passthrough-http',
    'oauth-http'
];
