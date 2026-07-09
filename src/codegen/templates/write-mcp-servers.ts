import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    MCP_MODULE_HOST_KINDS,
    moduleBasenameFromToolsPath,
    moduleMcpServerFileName,
    relativeJsImportPath,
    resolveGeneratedServersDir,
    type McpModuleHostKind
} from '../mcp-module-host.js';
import { renderMcpServerTemplate } from './mcp-server.template.js';

const RUNTIME_FILE_BY_KIND: Record<McpModuleHostKind, string> = {
    stdio: 'stdio-runtime',
    'public-http': 'public-http-runtime',
    'passthrough-http': 'passthrough-http-runtime',
    'oauth-http': 'oauth-http-runtime'
};

/** Writes four per-module MCP servers under `generated/<product>/servers/`. */
export function writeMcpServers(toolsModuleTsPath: string): string[] {
    const serversDir = resolveGeneratedServersDir(toolsModuleTsPath);
    if (!fs.existsSync(serversDir)) {
        fs.mkdirSync(serversDir, { recursive: true });
    }
    const moduleBasename = moduleBasenameFromToolsPath(toolsModuleTsPath);
    const written: string[] = [];
    for (const hostKind of MCP_MODULE_HOST_KINDS) {
        const serverPath = path.join(serversDir, moduleMcpServerFileName(moduleBasename, hostKind));
        const runtimeTsPath = path.join(path.dirname(serverPath), '..', 'cli', `${RUNTIME_FILE_BY_KIND[hostKind]}.ts`);
        fs.writeFileSync(
            serverPath,
            renderMcpServerTemplate({
                hostKind,
                moduleBasename,
                toolsImport: relativeJsImportPath(serverPath, toolsModuleTsPath),
                runtimeImport: relativeJsImportPath(serverPath, runtimeTsPath)
            }),
            'utf-8'
        );
        written.push(serverPath);
    }
    return written;
}
