import * as fs from 'node:fs';
import * as path from 'node:path';
import { parameterCheckExportName } from './access-stubs.js';
import { resolveBootstrapProjectRootFromSource } from './project-bootstrap.js';

function relativeJsImportPath(fromTsPath: string, toTsPath: string): string {
    let rel = path
        .relative(path.dirname(path.resolve(fromTsPath)), path.resolve(toTsPath))
        .split(path.sep)
        .join('/');
    if (!rel.startsWith('.')) {
        rel = `./${rel}`;
    }
    return rel.replace(/\.ts$/, '.js');
}

/** Basename of `generated/tools/<name>-tools.ts` — matches exported `mcpServerName`. */
export function resolveMcpModuleNameFromToolsModule(toolsModuleTsPath: string): string {
    return path.parse(toolsModuleTsPath).name;
}

export function resolveAuthStubDir(projectRoot: string, toolsModuleTsPath: string): string {
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    return path.join(projectRoot, 'src', 'auth', mcpModuleName);
}

export function renderAuthStubFileContent(
    toolName: string,
    authStubTsPath: string,
    toolsModuleTsPath: string,
    mcpModuleName: string
): string {
    const fn = parameterCheckExportName(toolName);
    const importSpec = relativeJsImportPath(authStubTsPath, toolsModuleTsPath);
    return `/**
 * Checked access parameter check for "${toolName}" (write-once — implement ${fn}).
 */
import type { InvokeOptions, CheckedHostContext } from '${importSpec}';

export function ${fn}(options: InvokeOptions, host: CheckedHostContext): InvokeOptions {
    void options;
    void host;
    throw new Error('Implement ${fn} in src/auth/${mcpModuleName}/${toolName}.ts');
}
`;
}

export async function ensureCheckedAuthStubsAtProjectRoot(
    projectRoot: string,
    checkedToolNames: readonly string[],
    toolsModuleTsPath: string
): Promise<Map<string, string>> {
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    const authDir = resolveAuthStubDir(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    if (checkedToolNames.length === 0) {
        return new Map();
    }

    const importPaths = new Map<string, string>();
    for (const toolName of checkedToolNames) {
        const tsPath = path.join(authDir, `${toolName}.ts`);
        if (!fs.existsSync(tsPath)) {
            fs.writeFileSync(
                tsPath,
                renderAuthStubFileContent(toolName, tsPath, toolsModuleTsPath, mcpModuleName),
                'utf-8'
            );
        }
        importPaths.set(toolName, tsPath);
    }

    return importPaths;
}

export async function ensureCheckedAuthStubsFromSource(
    source: string,
    checkedToolNames: readonly string[],
    toolsModuleTsPath: string
): Promise<Map<string, string>> {
    const projectRoot = resolveBootstrapProjectRootFromSource(source);
    return ensureCheckedAuthStubsAtProjectRoot(projectRoot, checkedToolNames, toolsModuleTsPath);
}

export function renderVerifyCredentialStubFileContent(mcpModuleName: string): string {
    return `/**
 * MCP credential verification (write-once — implement verifyCredential).
 * Used by oauth-http gate and by invokeTool when sessionClaims are not yet set (stdio/relay).
 */
export type VerifyCredentialInput = {
    inboundCredential: string;
};

export type VerifyCredentialResult = {
    upstreamCredential: string;
    sessionClaims?: Record<string, unknown>;
};

export async function verifyCredential(input: VerifyCredentialInput): Promise<VerifyCredentialResult> {
    void input;
    throw new Error('Implement verifyCredential in src/auth/${mcpModuleName}/verifyCredential.ts');
}
`;
}

export function resolveVerifyCredentialStubPath(projectRoot: string, toolsModuleTsPath: string): string {
    const authDir = resolveAuthStubDir(projectRoot, toolsModuleTsPath);
    return path.join(authDir, 'verifyCredential.ts');
}

/** Write-once \`src/auth/<module>/verifyCredential.ts\` when DSL \`requiresAuth\`. */
export async function ensureVerifyCredentialStubAtProjectRoot(
    projectRoot: string,
    toolsModuleTsPath: string
): Promise<string | undefined> {
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    const authDir = resolveAuthStubDir(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }
    const tsPath = path.join(authDir, 'verifyCredential.ts');
    if (!fs.existsSync(tsPath)) {
        fs.writeFileSync(tsPath, renderVerifyCredentialStubFileContent(mcpModuleName), 'utf-8');
    }
    return tsPath;
}

export async function ensureVerifyCredentialStubFromSource(
    source: string,
    toolsModuleTsPath: string
): Promise<string | undefined> {
    const projectRoot = resolveBootstrapProjectRootFromSource(source);
    return ensureVerifyCredentialStubAtProjectRoot(projectRoot, toolsModuleTsPath);
}

export function renderVerifyCredentialReExport(toolsModuleTsPath: string, verifyStubTsPath: string): string {
    const rel = relativeJsImportPath(toolsModuleTsPath, verifyStubTsPath);
    return `export { verifyCredential } from '${rel}';
export type { VerifyCredentialInput, VerifyCredentialResult } from '${rel}';`;
}

export function renderVerifyCredentialImport(toolsModuleTsPath: string, verifyStubTsPath: string): string {
    const rel = relativeJsImportPath(toolsModuleTsPath, verifyStubTsPath);
    return `import { verifyCredential } from '${rel}';`;
}

export function renderParameterCheckerImports(tsPath: string, stubPaths: Map<string, string>): string {
    const lines: string[] = [];
    for (const [toolName, absStub] of stubPaths) {
        const rel = relativeJsImportPath(tsPath, absStub);
        const fn = parameterCheckExportName(toolName);
        lines.push(`import { ${fn} } from '${rel}';`);
    }
    return lines.join('\n');
}

export function renderParameterCheckersMap(stubPaths: Map<string, string>): string {
    if (stubPaths.size === 0) {
        return 'const parameterCheckers: Record<string, never> = {};';
    }
    const typeAnnotation =
        ': Record<string, (options: InvokeOptions, host: CheckedHostContext) => InvokeOptions | Promise<InvokeOptions>>';
    const entries = [...stubPaths.keys()].map((toolName) => {
        const fn = parameterCheckExportName(toolName);
        return `    ${JSON.stringify(toolName)}: ${fn}`;
    });
    return `const parameterCheckers${typeAnnotation} = {\n${entries.join(',\n')}\n};`;
}
