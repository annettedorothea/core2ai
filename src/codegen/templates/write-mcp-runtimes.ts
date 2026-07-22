import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveProjectRootFromGeneratedCliDir } from '../generated-layout.js';

export type McpRuntimePaths = {
    stdioRuntimePath: string;
    publicHttpRuntimePath: string;
    passthroughHttpRuntimePath: string;
    oauthHttpRuntimePath: string;
};

export type McpRuntimeRenderers = {
    /** Ignored — stdio is a thin re-export from `@toolfactory.dev/core/mcp-host`. */
    renderStdioRuntime: (loggingImport: string) => string;
    renderPublicHttpRuntime: (loggingImport: string) => string;
    renderPassthroughHttpRuntime: (loggingImport: string) => string;
    renderOAuthHttpRuntime: (loggingImport: string) => string;
};

/** Logging import for generated HTTP runtimes (Phase 1: core package). */
export const CORE_LOGGING_IMPORT = '@toolfactory.dev/core/logging';

const THIN_STDIO_RUNTIME = `/**
 * Thin re-export — server stubs import \`runStdioMcp\` from \`@toolfactory.dev/core/mcp-host\`.
 */
export { defaultMcpEnvDirsFromMetaUrl, runStdioMcp } from '@toolfactory.dev/core/mcp-host';
`;

/** Writes MCP runtime modules under `generated/<product>/cli/` (stdio = thin re-export). */
export function writeMcpRuntimes(
    cliDir: string,
    renderers: McpRuntimeRenderers,
    projectRoot?: string
): McpRuntimePaths {
    if (!fs.existsSync(cliDir)) {
        fs.mkdirSync(cliDir, { recursive: true });
    }
    // projectRoot retained for API compatibility with consumer generators
    void (projectRoot ?? resolveProjectRootFromGeneratedCliDir(cliDir));

    const stdioRuntimePath = path.join(cliDir, 'stdio-runtime.ts');
    fs.writeFileSync(stdioRuntimePath, THIN_STDIO_RUNTIME, 'utf-8');

    const publicHttpRuntimePath = path.join(cliDir, 'public-http-runtime.ts');
    fs.writeFileSync(publicHttpRuntimePath, renderers.renderPublicHttpRuntime(CORE_LOGGING_IMPORT), 'utf-8');

    const passthroughHttpRuntimePath = path.join(cliDir, 'passthrough-http-runtime.ts');
    fs.writeFileSync(passthroughHttpRuntimePath, renderers.renderPassthroughHttpRuntime(CORE_LOGGING_IMPORT), 'utf-8');

    const oauthHttpRuntimePath = path.join(cliDir, 'oauth-http-runtime.ts');
    fs.writeFileSync(oauthHttpRuntimePath, renderers.renderOAuthHttpRuntime(CORE_LOGGING_IMPORT), 'utf-8');

    return { stdioRuntimePath, publicHttpRuntimePath, passthroughHttpRuntimePath, oauthHttpRuntimePath };
}

/** Content of the thin `cli/stdio-runtime.ts` (for tests / docs). */
export function renderThinStdioRuntime(): string {
    return THIN_STDIO_RUNTIME;
}
