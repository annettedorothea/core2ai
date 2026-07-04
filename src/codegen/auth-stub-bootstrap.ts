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

function hookStubRelativePath(toolsModuleTsPath: string, fileBase: string): string {
    const hostProduct = resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath);
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    return `src/hooks/${hostProduct}/${mcpModuleName}/${fileBase}.ts`;
}

function resolveVerifyStubRelPath(toolsModuleTsPath: string): string {
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    return hookStubRelativePath(toolsModuleTsPath, names.fileBase);
}

function renderToolHookStubBody(toolName: string, spec: ToolHookStubSpec, toolsModuleTsPath: string): string {
    const lines: string[] = [];
    if (spec.checkToolAccess) {
        const fn = checkToolAccessExportName(toolName);
        lines.push(`export function ${fn}(credential: string): void {
    void credential;
}`);
    }
    if (spec.prepareToolCall) {
        const fn = prepareToolCallExportName(toolName);
        if (spec.access === 'public') {
            lines.push(`export function ${fn}(options: InvokeOptions): InvokeOptions {
    void options;
    throw new Error('Implement ${fn} in ${hookStubRelativePath(toolsModuleTsPath, toolName)}');
}`);
        } else {
            lines.push(`export function ${fn}(options: InvokeOptions, credential: string): InvokeOptions {
    void options;
    void credential;
    throw new Error('Implement ${fn} in ${hookStubRelativePath(toolsModuleTsPath, toolName)}');
}`);
        }
    }
    return lines.join('\n\n');
}

export function renderToolHookStubFileContent(
    toolName: string,
    spec: ToolHookStubSpec,
    hookStubTsPath: string,
    toolsModuleTsPath: string
): string {
    const importSpec = relativeJsImportPath(hookStubTsPath, toolsModuleTsPath);
    const header =
        spec.checkToolAccess && spec.prepareToolCall
            ? `/**
 * checkToolAccess + prepareToolCall hooks for "${toolName}" (write-once — implement hooks).
 */`
            : spec.checkToolAccess
              ? `/**
 * checkToolAccess hook for "${toolName}" (write-once — override ${checkToolAccessExportName(toolName)} for role gates).
 */`
              : `/**
 * prepareToolCall hook for "${toolName}" (write-once — implement ${prepareToolCallExportName(toolName)}).
 */`;
    return `${header}
import type { InvokeOptions } from '${importSpec}';

${renderToolHookStubBody(toolName, spec, toolsModuleTsPath)}
`;
}

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
        if (!spec.checkToolAccess && !spec.prepareToolCall) {
            continue;
        }
        const tsPath = path.join(hookDir, `${spec.toolName}.ts`);
        if (!fs.existsSync(tsPath)) {
            fs.writeFileSync(
                tsPath,
                renderToolHookStubFileContent(spec.toolName, spec, tsPath, toolsModuleTsPath),
                'utf-8'
            );
        }
        importPaths.set(spec.toolName, tsPath);
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

function stubExportsFunction(stubContent: string, fn: string): boolean {
    return stubContent.includes(`export function ${fn}`) || stubContent.includes(`export async function ${fn}`);
}

export function renderCheckToolAccessHookImports(
    tsPath: string,
    stubPaths: Map<string, string>,
    checkToolAccessToolNames: readonly string[]
): string {
    const allowed = new Set(checkToolAccessToolNames);
    const lines: string[] = [];
    for (const [toolName, absStub] of stubPaths) {
        if (!allowed.has(toolName)) {
            continue;
        }
        const rel = relativeJsImportPath(tsPath, absStub);
        const fn = checkToolAccessExportName(toolName);
        const stubContent = fs.existsSync(absStub) ? fs.readFileSync(absStub, 'utf-8') : '';
        if (stubExportsFunction(stubContent, fn)) {
            lines.push(`import { ${fn} } from '${rel}';`);
        }
    }
    return lines.join('\n');
}

export function renderPrepareToolCallHookImports(tsPath: string, stubPaths: Map<string, string>): string {
    const lines: string[] = [];
    for (const [toolName, absStub] of stubPaths) {
        const rel = relativeJsImportPath(tsPath, absStub);
        const fn = prepareToolCallExportName(toolName);
        const stubContent = fs.existsSync(absStub) ? fs.readFileSync(absStub, 'utf-8') : '';
        if (stubExportsFunction(stubContent, fn)) {
            lines.push(`import { ${fn} } from '${rel}';`);
        }
    }
    return lines.join('\n');
}
