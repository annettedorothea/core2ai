import * as fs from 'node:fs';
import * as path from 'node:path';
import { loggingAdapterImportForCliFile, resolveProjectRootFromGeneratedCliDir } from '../generated-layout.js';

export type McpRuntimePaths = {
    stdioRuntimePath: string;
    publicHttpRuntimePath: string;
    passthroughHttpRuntimePath: string;
    oauthHttpRuntimePath: string;
};

export type McpRuntimeRenderers = {
    renderStdioRuntime: (loggingImport: string) => string;
    renderPublicHttpRuntime: (loggingImport: string) => string;
    renderPassthroughHttpRuntime: (loggingImport: string) => string;
    renderOAuthHttpRuntime: (loggingImport: string) => string;
};

/** Writes four MCP runtime modules under `generated/<product>/cli/`. */
export function writeMcpRuntimes(
    cliDir: string,
    renderers: McpRuntimeRenderers,
    projectRoot?: string
): McpRuntimePaths {
    if (!fs.existsSync(cliDir)) {
        fs.mkdirSync(cliDir, { recursive: true });
    }
    const root = projectRoot ?? resolveProjectRootFromGeneratedCliDir(cliDir);

    const stdioRuntimePath = path.join(cliDir, 'stdio-runtime.ts');
    fs.writeFileSync(
        stdioRuntimePath,
        renderers.renderStdioRuntime(loggingAdapterImportForCliFile(stdioRuntimePath, root)),
        'utf-8'
    );

    const publicHttpRuntimePath = path.join(cliDir, 'public-http-runtime.ts');
    fs.writeFileSync(
        publicHttpRuntimePath,
        renderers.renderPublicHttpRuntime(loggingAdapterImportForCliFile(publicHttpRuntimePath, root)),
        'utf-8'
    );

    const passthroughHttpRuntimePath = path.join(cliDir, 'passthrough-http-runtime.ts');
    fs.writeFileSync(
        passthroughHttpRuntimePath,
        renderers.renderPassthroughHttpRuntime(loggingAdapterImportForCliFile(passthroughHttpRuntimePath, root)),
        'utf-8'
    );

    const oauthHttpRuntimePath = path.join(cliDir, 'oauth-http-runtime.ts');
    fs.writeFileSync(
        oauthHttpRuntimePath,
        renderers.renderOAuthHttpRuntime(loggingAdapterImportForCliFile(oauthHttpRuntimePath, root)),
        'utf-8'
    );

    return { stdioRuntimePath, publicHttpRuntimePath, passthroughHttpRuntimePath, oauthHttpRuntimePath };
}
