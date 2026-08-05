import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveModuleVerifyCredentialNames, resolveModuleTokenExchangeNames } from './auth-module-names.js';
import { checkToolAccessExportName, prepareToolCallExportName, afterToolCallExportName } from './access-stubs.js';
import { relativeJsImportPath, resolveHostProductFromGeneratedToolsPath } from './generated-layout.js';
import { resolveBootstrapProjectRootFromSource } from './project-bootstrap.js';

export type ToolHookStubSpec = {
    toolName: string;
    checkToolAccess: boolean;
    prepareToolCall: boolean;
    afterToolCall: boolean;
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
    const names = resolveModuleVerifyCredentialNames(toolsModuleTsPath);
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

export function renderAfterToolCallStubFileContent(
    toolName: string,
    access: 'public' | 'protected',
    hookStubTsPath: string,
    toolsModuleTsPath: string
): string {
    const fn = afterToolCallExportName(toolName);
    const importSpec = relativeJsImportPath(hookStubTsPath, toolsModuleTsPath);
    const signature =
        access === 'public'
            ? `export function ${fn}(result: unknown, options: InvokeOptions): unknown`
            : `export function ${fn}(result: unknown, options: InvokeOptions, credential: string): unknown`;
    const voidLines =
        access === 'public'
            ? `    void result;
    void options;`
            : `    void result;
    void options;
    void credential;`;
    return `/**
 * afterToolCall hook for "${toolName}" (write-once — implement ${fn}).
 * Runs after a successful tool invoke; return value is what MCP receives.
 */
import type { InvokeOptions } from '${importSpec}';

${signature} {
${voidLines}
    throw new Error('Implement ${fn} in ${hookStubRelativePath(toolsModuleTsPath, fn)}');
}
`;
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
        if (spec.afterToolCall) {
            const fn = afterToolCallExportName(spec.toolName);
            const tsPath = path.join(hookDir, `${fn}.ts`);
            if (!fs.existsSync(tsPath)) {
                fs.writeFileSync(
                    tsPath,
                    renderAfterToolCallStubFileContent(spec.toolName, spec.access, tsPath, toolsModuleTsPath),
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
    const names = resolveModuleVerifyCredentialNames(toolsModuleTsPath);
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
    const names = resolveModuleVerifyCredentialNames(toolsModuleTsPath);
    return path.join(hookDir, `${names.fileBase}.ts`);
}

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

function resolveTokenExchangeStubRelPath(toolsModuleTsPath: string): string {
    const names = resolveModuleTokenExchangeNames(toolsModuleTsPath);
    return hookStubRelativePath(toolsModuleTsPath, names.fileBase);
}

export function renderTokenExchangeStubFileContent(toolsModuleTsPath: string): string {
    const names = resolveModuleTokenExchangeNames(toolsModuleTsPath);
    const stubPath = resolveTokenExchangeStubRelPath(toolsModuleTsPath);
    return `/**
 * OAuth IdP → portal token exchange (write-once — implement ${names.tokenExchangeFunctionName}).
 * Used by oauth-http host only when auth.hooks.tokenExchange is enabled.
 */
export async function ${names.tokenExchangeFunctionName}(idpCredential: string): Promise<string> {
    void idpCredential;
    throw new Error('Implement ${names.tokenExchangeFunctionName} in ${stubPath}');
}

export { ${names.tokenExchangeFunctionName} as tokenExchange };
`;
}

export function resolveTokenExchangeStubPath(projectRoot: string, toolsModuleTsPath: string): string {
    const hookDir = resolveHookStubDir(projectRoot, toolsModuleTsPath);
    const names = resolveModuleTokenExchangeNames(toolsModuleTsPath);
    return path.join(hookDir, `${names.fileBase}.ts`);
}

export async function ensureTokenExchangeStubAtProjectRoot(
    projectRoot: string,
    toolsModuleTsPath: string
): Promise<string | undefined> {
    const hookDir = resolveHookStubDir(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(hookDir)) {
        fs.mkdirSync(hookDir, { recursive: true });
    }
    const tsPath = resolveTokenExchangeStubPath(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(tsPath)) {
        fs.writeFileSync(tsPath, renderTokenExchangeStubFileContent(toolsModuleTsPath), 'utf-8');
    }
    return tsPath;
}

export async function ensureTokenExchangeStubFromSource(
    source: string,
    toolsModuleTsPath: string
): Promise<string | undefined> {
    const projectRoot = resolveBootstrapProjectRootFromSource(source);
    return ensureTokenExchangeStubAtProjectRoot(projectRoot, toolsModuleTsPath);
}

export function renderTokenExchangeReExport(toolsModuleTsPath: string, tokenExchangeStubTsPath: string): string {
    const rel = relativeJsImportPath(toolsModuleTsPath, tokenExchangeStubTsPath);
    return `export { tokenExchange } from '${rel}';`;
}

export function renderTokenExchangeImport(toolsModuleTsPath: string, tokenExchangeStubTsPath: string): string {
    const rel = relativeJsImportPath(toolsModuleTsPath, tokenExchangeStubTsPath);
    return `import { tokenExchange } from '${rel}';`;
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

export type AfterToolCallHookMapEntry = {
    toolName: string;
    access: 'public' | 'protected';
};

export function renderAfterToolCallHooksMap(entries: readonly AfterToolCallHookMapEntry[]): string {
    const typeAnnotation =
        ': Record<string, (result: unknown, options: InvokeOptions, credential?: string) => unknown | Promise<unknown>>';
    if (entries.length === 0) {
        return `const afterToolCallHooks${typeAnnotation} = {};`;
    }
    const mapEntries = entries.map(({ toolName, access }) => {
        const fn = afterToolCallExportName(toolName);
        if (access === 'protected') {
            return `    ${JSON.stringify(toolName)}: (result, options, credential) => ${fn}(result, options, credential!)`;
        }
        return `    ${JSON.stringify(toolName)}: ${fn}`;
    });
    return `const afterToolCallHooks${typeAnnotation} = {\n${mapEntries.join(',\n')}\n};`;
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

export function renderAfterToolCallHookImports(
    tsPath: string,
    stubPaths: Map<string, string>,
    afterToolCallToolNames: readonly string[]
): string {
    const lines: string[] = [];
    for (const toolName of afterToolCallToolNames) {
        const fn = afterToolCallExportName(toolName);
        const absStub = stubPaths.get(fn);
        if (!absStub) {
            continue;
        }
        const rel = relativeJsImportPath(tsPath, absStub);
        lines.push(`import { ${fn} } from '${rel}';`);
    }
    return lines.join('\n');
}

export function listCheckToolAccessToolNamesFromSpecs(specs: readonly ToolHookStubSpec[]): string[] {
    return specs.filter((spec) => spec.checkToolAccess).map((spec) => spec.toolName);
}

export function listPrepareToolCallToolNamesFromSpecs(specs: readonly ToolHookStubSpec[]): string[] {
    return specs.filter((spec) => spec.prepareToolCall).map((spec) => spec.toolName);
}

export function listAfterToolCallToolNamesFromSpecs(specs: readonly ToolHookStubSpec[]): string[] {
    return specs.filter((spec) => spec.afterToolCall).map((spec) => spec.toolName);
}

export function listPrepareToolCallHookEntriesFromSpecs(
    specs: readonly ToolHookStubSpec[]
): PrepareToolCallHookMapEntry[] {
    return specs.filter((spec) => spec.prepareToolCall).map(({ toolName, access }) => ({ toolName, access }));
}

export function listAfterToolCallHookEntriesFromSpecs(specs: readonly ToolHookStubSpec[]): AfterToolCallHookMapEntry[] {
    return specs.filter((spec) => spec.afterToolCall).map(({ toolName, access }) => ({ toolName, access }));
}

/** Writes write-once hook stubs from precomputed specs; returns stub paths for imports. */
export async function renderCheckStubsFromSpecs(
    source: string,
    specs: readonly ToolHookStubSpec[],
    toolsModuleTsPath: string
): Promise<Map<string, string>> {
    if (specs.length === 0) {
        return new Map();
    }
    return ensureToolHookStubsFromSource(source, specs, toolsModuleTsPath);
}
