import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveModuleCredentialNames } from './auth-module-names.js';
import { authorizeExportName, prepareInputExportName } from './access-stubs.js';
import { relativeJsImportPath, resolveHostProductFromGeneratedToolsPath } from './generated-layout.js';
import { resolveBootstrapProjectRootFromSource } from './project-bootstrap.js';

export type ToolHookStubSpec = {
    toolName: string;
    authorize: boolean;
    prepare: boolean;
    access: 'public' | 'protected';
};

/** @deprecated Use ToolHookStubSpec */
export type ToolAuthStubSpec = ToolHookStubSpec;

/** Basename of `generated/{product}/tools/<name>-tools.ts` — matches exported `mcpServerName`. */
export function resolveMcpModuleNameFromToolsModule(toolsModuleTsPath: string): string {
    return path.parse(toolsModuleTsPath).name;
}

export function resolveHookStubDir(projectRoot: string, toolsModuleTsPath: string): string {
    const hostProduct = resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath);
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    return path.join(projectRoot, 'src', 'hooks', hostProduct, mcpModuleName);
}

/** @deprecated Use resolveHookStubDir */
export const resolveAuthStubDir = resolveHookStubDir;

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
    if (spec.authorize) {
        const fn = authorizeExportName(toolName);
        lines.push(`export function ${fn}(credentials: ModuleCredentials): void {
    void credentials;
}`);
    }
    if (spec.prepare) {
        const fn = prepareInputExportName(toolName);
        if (spec.access === 'public') {
            lines.push(`export function ${fn}(options: InvokeOptions): InvokeOptions {
    void options;
    throw new Error('Implement ${fn} in ${hookStubRelativePath(toolsModuleTsPath, toolName)}');
}`);
        } else {
            lines.push(`export function ${fn}(options: InvokeOptions, credentials?: ModuleCredentials): InvokeOptions {
    void options;
    void credentials;
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
    const hookDir = path.dirname(hookStubTsPath);
    const verifyStubPath = path.join(hookDir, `${resolveModuleCredentialNames(toolsModuleTsPath).fileBase}.ts`);
    const verifyImportSpec = relativeJsImportPath(hookStubTsPath, verifyStubPath);
    const header =
        spec.authorize && spec.prepare
            ? `/**
 * Authorize + prepare hooks for "${toolName}" (write-once — implement authorize / prepareInput).
 */`
            : spec.authorize
              ? `/**
 * Authorize hook for "${toolName}" (write-once — override ${authorizeExportName(toolName)} for role gates).
 */`
              : `/**
 * Prepare hook for "${toolName}" (write-once — implement ${prepareInputExportName(toolName)}).
 */`;
    const needsModuleCredentials = spec.authorize || (spec.prepare && spec.access === 'protected');
    const credentialsImport = needsModuleCredentials
        ? `import type { ModuleCredentials } from '${verifyImportSpec}';\n`
        : '';
    return `${header}
${credentialsImport}import type { InvokeOptions } from '${importSpec}';

${renderToolHookStubBody(toolName, spec, toolsModuleTsPath)}
`;
}

/** @deprecated Use renderToolHookStubFileContent */
export const renderToolAuthStubFileContent = renderToolHookStubFileContent;

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
        if (!spec.authorize && !spec.prepare) {
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

/** @deprecated Use ensureToolHookStubsAtProjectRoot */
export const ensureToolAuthStubsAtProjectRoot = ensureToolHookStubsAtProjectRoot;

export async function ensureToolHookStubsFromSource(
    source: string,
    toolSpecs: readonly ToolHookStubSpec[],
    toolsModuleTsPath: string
): Promise<Map<string, string>> {
    const projectRoot = resolveBootstrapProjectRootFromSource(source);
    return ensureToolHookStubsAtProjectRoot(projectRoot, toolSpecs, toolsModuleTsPath);
}

/** @deprecated Use ensureToolHookStubsFromSource */
export const ensureToolAuthStubsFromSource = ensureToolHookStubsFromSource;

export function renderVerifyCredentialsStubFileContent(toolsModuleTsPath: string): string {
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    const verifyPath = resolveVerifyStubRelPath(toolsModuleTsPath);
    return `/**
 * MCP credential verification (write-once — implement ${names.verifyFunctionName}).
 * Used by oauth-http gate and by invokeTool for protected tools (stdio/relay/OAuth).
 */
export type ModuleCredentials = Record<string, unknown>;

export class ${names.className} implements ModuleCredentials {
    [key: string]: unknown;

    constructor(init: ModuleCredentials) {
        Object.assign(this, init);
    }

    toString(): string {
        return '[${names.pascalBase} credentials]';
    }
}

export function ${names.toFunctionName}(data: ModuleCredentials | Record<string, unknown>): ${names.className} {
    return new ${names.className}(data as ModuleCredentials);
}

export type VerifyCredentialInput = {
    inboundCredential: string;
};

export type VerifyCredentialResult = {
    upstreamCredential: string;
    credentials: ${names.className};
};

export async function ${names.verifyFunctionName}(input: VerifyCredentialInput): Promise<VerifyCredentialResult> {
    void input;
    throw new Error('Implement ${names.verifyFunctionName} in ${verifyPath}');
}

export { ${names.verifyFunctionName} as verifyCredential, ${names.toFunctionName} as toModuleCredentials };
`;
}

export function resolveVerifyCredentialStubPath(projectRoot: string, toolsModuleTsPath: string): string {
    const hookDir = resolveHookStubDir(projectRoot, toolsModuleTsPath);
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    return path.join(hookDir, `${names.fileBase}.ts`);
}

/** Write-once \`src/hooks/{product}/<module>/verify*Credentials.ts\` when DSL has auth. */
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
        fs.writeFileSync(tsPath, renderVerifyCredentialsStubFileContent(toolsModuleTsPath), 'utf-8');
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
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    return `export {
    verifyCredential,
    toModuleCredentials
} from '${rel}';
export type {
    VerifyCredentialInput,
    VerifyCredentialResult,
    ModuleCredentials,
    ${names.className}
} from '${rel}';`;
}

export function renderVerifyCredentialImport(
    toolsModuleTsPath: string,
    verifyStubTsPath: string,
    options?: { includeVerify?: boolean; includeModuleCredentials?: boolean }
): string {
    const rel = relativeJsImportPath(toolsModuleTsPath, verifyStubTsPath);
    const includeVerify = options?.includeVerify !== false;
    const includeModuleCredentials = options?.includeModuleCredentials !== false;
    if (!includeVerify) {
        return `import { toModuleCredentials, type ModuleCredentials } from '${rel}';`;
    }
    if (!includeModuleCredentials) {
        return `import { verifyCredential } from '${rel}';`;
    }
    return `import { verifyCredential, toModuleCredentials, type ModuleCredentials } from '${rel}';`;
}

export function renderAuthorizersMap(toolNames: readonly string[]): string {
    const typeAnnotation = ': Record<string, (credentials: ModuleCredentials) => void | Promise<void>>';
    if (toolNames.length === 0) {
        return `const authorizers${typeAnnotation} = {};`;
    }
    const entries = toolNames.map((toolName) => {
        const fn = authorizeExportName(toolName);
        return `    ${JSON.stringify(toolName)}: ${fn}`;
    });
    return `const authorizers${typeAnnotation} = {\n${entries.join(',\n')}\n};`;
}

export function renderPreparersMap(toolNames: readonly string[], options?: { includeCredentials?: boolean }): string {
    const includeCredentials = options?.includeCredentials !== false;
    const typeAnnotation = includeCredentials
        ? ': Record<string, (options: InvokeOptions, credentials?: ModuleCredentials) => InvokeOptions | Promise<InvokeOptions>>'
        : ': Record<string, (options: InvokeOptions) => InvokeOptions | Promise<InvokeOptions>>';
    if (toolNames.length === 0) {
        return `const preparers${typeAnnotation} = {};`;
    }
    const entries = toolNames.map((toolName) => {
        const fn = prepareInputExportName(toolName);
        return `    ${JSON.stringify(toolName)}: ${fn}`;
    });
    return `const preparers${typeAnnotation} = {\n${entries.join(',\n')}\n};`;
}

/** @deprecated Use renderPreparersMap */
export const renderValidatorsMap = renderPreparersMap;

export function renderAuthorizerImports(
    tsPath: string,
    stubPaths: Map<string, string>,
    authorizeToolNames: readonly string[]
): string {
    const allowed = new Set(authorizeToolNames);
    const lines: string[] = [];
    for (const [toolName, absStub] of stubPaths) {
        if (!allowed.has(toolName)) {
            continue;
        }
        const rel = relativeJsImportPath(tsPath, absStub);
        const fn = authorizeExportName(toolName);
        const stubContent = fs.existsSync(absStub) ? fs.readFileSync(absStub, 'utf-8') : '';
        if (stubContent.includes(`export function ${fn}`)) {
            lines.push(`import { ${fn} } from '${rel}';`);
        }
    }
    return lines.join('\n');
}

export function renderPreparerImports(tsPath: string, stubPaths: Map<string, string>): string {
    const lines: string[] = [];
    for (const [toolName, absStub] of stubPaths) {
        const rel = relativeJsImportPath(tsPath, absStub);
        const fn = prepareInputExportName(toolName);
        const stubContent = fs.existsSync(absStub) ? fs.readFileSync(absStub, 'utf-8') : '';
        if (stubContent.includes(`export function ${fn}`)) {
            lines.push(`import { ${fn} } from '${rel}';`);
        }
    }
    return lines.join('\n');
}

/** @deprecated Use renderPreparerImports */
export const renderValidatorImports = renderPreparerImports;
