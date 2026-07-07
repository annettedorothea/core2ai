import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveModuleCredentialNames } from './auth-module-names.js';
import { checkToolAccessExportName, prepareToolCallExportName } from './access-stubs.js';
import { relativeJsImportPath, resolveHostProductFromGeneratedToolsPath } from './generated-layout.js';
import { resolveBootstrapProjectRootFromSource } from './project-bootstrap.js';

export type ToolHookStubSpec = {
    toolName: string;
    checkToolAccess: boolean;
    prepareToolCall: boolean;
    access: 'public' | 'protected';
};

/** Basename of `generated/{product}/tools/<name>-tools.ts` — matches exported `mcpServerName`. */
export function resolveMcpModuleNameFromToolsModule(toolsModuleTsPath: string): string {
    return path.parse(toolsModuleTsPath).name;
}

export function resolveHookStubDir(projectRoot: string, toolsModuleTsPath: string): string {
    const hostProduct = resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath);
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    return path.join(projectRoot, 'src', 'hooks', hostProduct, mcpModuleName);
}

function hookStubRelativePath(toolsModuleTsPath: string, exportName: string): string {
    const hostProduct = resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath);
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    return `src/hooks/${hostProduct}/${mcpModuleName}/${exportName}.ts`;
}

function resolveVerifyStubRelPath(toolsModuleTsPath: string): string {
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    return hookStubRelativePath(toolsModuleTsPath, names.fileBase);
}

export function renderCheckToolAccessStubFileContent(
    toolName: string,
    hookStubTsPath: string,
    toolsModuleTsPath: string
): string {
    const fn = checkToolAccessExportName(toolName);
    return `/**
 * checkToolAccess hook for "${toolName}" (write-once — implement ${fn}).
 */
export function ${fn}(credential: string): void {
    void credential;
    throw new Error('Implement ${fn} in ${hookStubRelativePath(toolsModuleTsPath, fn)}');
}
`;
}

export function renderPrepareToolCallStubFileContent(
    toolName: string,
    access: 'public' | 'protected',
    hookStubTsPath: string,
    toolsModuleTsPath: string
): string {
    const fn = prepareToolCallExportName(toolName);
    const importSpec = relativeJsImportPath(hookStubTsPath, toolsModuleTsPath);
    const signature =
        access === 'public'
            ? `export function ${fn}(options: InvokeOptions): InvokeOptions`
            : `export function ${fn}(options: InvokeOptions, credential: string): InvokeOptions`;
    const voidLines =
        access === 'public'
            ? `    void options;`
            : `    void options;
    void credential;`;
    return `/**
 * prepareToolCall hook for "${toolName}" (write-once — implement ${fn}).
 */
import type { InvokeOptions } from '${importSpec}';

${signature} {
${voidLines}
    throw new Error('Implement ${fn} in ${hookStubRelativePath(toolsModuleTsPath, fn)}');
}
`;
}

/** @deprecated Use renderCheckToolAccessStubFileContent / renderPrepareToolCallStubFileContent. */
export function renderToolHookStubFileContent(
    toolName: string,
    spec: ToolHookStubSpec,
    hookStubTsPath: string,
    toolsModuleTsPath: string
): string {
    const parts: string[] = [];
    if (spec.checkToolAccess) {
        parts.push(renderCheckToolAccessStubFileContent(toolName, hookStubTsPath, toolsModuleTsPath).trimEnd());
    }
    if (spec.prepareToolCall) {
        parts.push(
            renderPrepareToolCallStubFileContent(toolName, spec.access, hookStubTsPath, toolsModuleTsPath).trimEnd()
        );
    }
    return `${parts.join('\n\n')}\n`;
}

/** Map export name → absolute stub path (one file per hook function). */
export async function ensureToolHookStubsAtProjectRoot(
    projectRoot: string,
    toolSpecs: readonly ToolHookStubSpec[],
    toolsModuleTsPath: string
): Promise<Map<string, string>> {
    const hookDir = resolveHookStubDir(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(hookDir)) {
        fs.mkdirSync(hookDir, { recursive: true });
    }

    const importPaths = new Map<string, string>();
    for (const spec of toolSpecs) {
        if (spec.checkToolAccess) {
            const fn = checkToolAccessExportName(spec.toolName);
            const tsPath = path.join(hookDir, `${fn}.ts`);
            if (!fs.existsSync(tsPath)) {
                fs.writeFileSync(
                    tsPath,
                    renderCheckToolAccessStubFileContent(spec.toolName, tsPath, toolsModuleTsPath),
                    'utf-8'
                );
            }
            importPaths.set(fn, tsPath);
        }
        if (spec.prepareToolCall) {
            const fn = prepareToolCallExportName(spec.toolName);
            const tsPath = path.join(hookDir, `${fn}.ts`);
            if (!fs.existsSync(tsPath)) {
                fs.writeFileSync(
                    tsPath,
                    renderPrepareToolCallStubFileContent(spec.toolName, spec.access, tsPath, toolsModuleTsPath),
                    'utf-8'
                );
            }
            importPaths.set(fn, tsPath);
        }
    }

    return importPaths;
}

export async function ensureToolHookStubsFromSource(
    source: string,
    toolSpecs: readonly ToolHookStubSpec[],
    toolsModuleTsPath: string
): Promise<Map<string, string>> {
    const projectRoot = resolveBootstrapProjectRootFromSource(source);
    return ensureToolHookStubsAtProjectRoot(projectRoot, toolSpecs, toolsModuleTsPath);
}

export function renderVerifyCredentialStubFileContent(toolsModuleTsPath: string): string {
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    const verifyPath = resolveVerifyStubRelPath(toolsModuleTsPath);
    return `/**
 * MCP credential verification (write-once — implement ${names.verifyFunctionName}).
 * Used by oauth-http gate and by invokeTool for protected tools (stdio/relay/OAuth).
 */
export async function ${names.verifyFunctionName}(credential: string): Promise<void> {
    void credential;
    throw new Error('Implement ${names.verifyFunctionName} in ${verifyPath}');
}

export { ${names.verifyFunctionName} as verifyCredential };
`;
}

export function resolveVerifyCredentialStubPath(projectRoot: string, toolsModuleTsPath: string): string {
    const hookDir = resolveHookStubDir(projectRoot, toolsModuleTsPath);
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    return path.join(hookDir, `${names.fileBase}.ts`);
}

/** @deprecated Use `resolveVerifyCredentialStubPath`. */
export const resolveVerifyCredentialsStubPath = resolveVerifyCredentialStubPath;

/** Write-once \`src/hooks/{product}/<module>/verify*Credential.ts\` when DSL has auth. */
export async function ensureVerifyCredentialStubAtProjectRoot(
    projectRoot: string,
    toolsModuleTsPath: string
): Promise<string | undefined> {
    const hookDir = resolveHookStubDir(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(hookDir)) {
        fs.mkdirSync(hookDir, { recursive: true });
    }
    const tsPath = resolveVerifyCredentialStubPath(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(tsPath)) {
        fs.writeFileSync(tsPath, renderVerifyCredentialStubFileContent(toolsModuleTsPath), 'utf-8');
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
    return `export { verifyCredential } from '${rel}';`;
}

export function renderVerifyCredentialImport(toolsModuleTsPath: string, verifyStubTsPath: string): string {
    const rel = relativeJsImportPath(toolsModuleTsPath, verifyStubTsPath);
    return `import { verifyCredential } from '${rel}';`;
}

export function renderCheckToolAccessHooksMap(toolNames: readonly string[]): string {
    const typeAnnotation = ': Record<string, (credential: string) => void | Promise<void>>';
    if (toolNames.length === 0) {
        return `const checkToolAccessHooks${typeAnnotation} = {};`;
    }
    const entries = toolNames.map((toolName) => {
        const fn = checkToolAccessExportName(toolName);
        return `    ${JSON.stringify(toolName)}: ${fn}`;
    });
    return `const checkToolAccessHooks${typeAnnotation} = {\n${entries.join(',\n')}\n};`;
}

export type PrepareToolCallHookMapEntry = {
    toolName: string;
    access: 'public' | 'protected';
};

export function renderPrepareToolCallHooksMap(entries: readonly PrepareToolCallHookMapEntry[]): string {
    const typeAnnotation =
        ': Record<string, (options: InvokeOptions, credential?: string) => InvokeOptions | Promise<InvokeOptions>>';
    if (entries.length === 0) {
        return `const prepareToolCallHooks${typeAnnotation} = {};`;
    }
    const mapEntries = entries.map(({ toolName, access }) => {
        const fn = prepareToolCallExportName(toolName);
        if (access === 'protected') {
            return `    ${JSON.stringify(toolName)}: (options, credential) => ${fn}(options, credential!)`;
        }
        return `    ${JSON.stringify(toolName)}: ${fn}`;
    });
    return `const prepareToolCallHooks${typeAnnotation} = {\n${mapEntries.join(',\n')}\n};`;
}

export function renderCheckToolAccessHookImports(
    tsPath: string,
    stubPaths: Map<string, string>,
    checkToolAccessToolNames: readonly string[]
): string {
    const lines: string[] = [];
    for (const toolName of checkToolAccessToolNames) {
        const fn = checkToolAccessExportName(toolName);
        const absStub = stubPaths.get(fn);
        if (!absStub) {
            continue;
        }
        const rel = relativeJsImportPath(tsPath, absStub);
        lines.push(`import { ${fn} } from '${rel}';`);
    }
    return lines.join('\n');
}

export function renderPrepareToolCallHookImports(
    tsPath: string,
    stubPaths: Map<string, string>,
    prepareToolCallToolNames: readonly string[]
): string {
    const lines: string[] = [];
    for (const toolName of prepareToolCallToolNames) {
        const fn = prepareToolCallExportName(toolName);
        const absStub = stubPaths.get(fn);
        if (!absStub) {
            continue;
        }
        const rel = relativeJsImportPath(tsPath, absStub);
        lines.push(`import { ${fn} } from '${rel}';`);
    }
    return lines.join('\n');
}
