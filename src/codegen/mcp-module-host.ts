import * as path from 'node:path';
import { relativeJsImportPath } from './generated-layout.js';

/** Host kinds for per-module MCP server entrypoints under `generated/<product>/servers/`. */
export type McpModuleHostKind = 'stdio' | 'public-http' | 'passthrough-http' | 'oauth-http';

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
    const stemByKind: Record<McpModuleHostKind, string> = {
        stdio: 'stdio-mcp-server',
        'public-http': 'public-http-mcp-server',
        'passthrough-http': 'passthrough-http-mcp-server',
        'oauth-http': 'oauth-http-mcp-server'
    };
    return `${moduleBasename}-${stemByKind[hostKind]}.ts`;
}

export const MCP_MODULE_HOST_KINDS: readonly McpModuleHostKind[] = [
    'stdio',
    'public-http',
    'passthrough-http',
    'oauth-http'
];

export { relativeJsImportPath };
