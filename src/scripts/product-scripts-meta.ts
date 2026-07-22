import type { McpScriptsProduct } from './render-build-mcp-lib.mjs.js';

export type ScriptsProduct = McpScriptsProduct;

export type ProductScriptsMeta = {
    productName: ScriptsProduct;
    dslExtension: string;
    embedHomeEnvVar: string;
    embedDirName: string;
    extensionIdPrefix: string;
    /** Fallback MCP HTTP port when `.env.example` has no matching portEnv line. */
    defaultMcpPort: string;
};

export function productScriptsMeta(product: ScriptsProduct): ProductScriptsMeta {
    if (product === 'db2ai') {
        return {
            productName: 'db2ai',
            dslExtension: '.db2ai',
            embedHomeEnvVar: 'DB2AI_EMBED_HOME',
            embedDirName: 'embed-db2ai',
            extensionIdPrefix: 'toolfactory-dev.vscode-db2ai-',
            defaultMcpPort: '4853'
        };
    }
    return {
        productName: 'api2ai',
        dslExtension: '.api2ai',
        embedHomeEnvVar: 'API2AI_EMBED_HOME',
        embedDirName: 'embed-api2ai',
        extensionIdPrefix: 'toolfactory-dev.vscode-api2ai-',
        defaultMcpPort: '3854'
    };
}

/** Relative path from workspace root to generated scripts dir. */
export function generatedScriptsDirRelative(product: ScriptsProduct): string {
    return pathPosixJoin('generated', product, 'scripts');
}

function pathPosixJoin(...parts: string[]): string {
    return parts.join('/');
}
