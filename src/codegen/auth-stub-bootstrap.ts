import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveModuleCredentialNames } from './auth-module-names.js';
import { authorizeExportName, validateInputExportName } from './access-stubs.js';
import { relativeJsImportPath, resolveHostProductFromGeneratedToolsPath } from './generated-layout.js';
import { resolveBootstrapProjectRootFromSource } from './project-bootstrap.js';

export type ToolAuthStubSpec = {
    toolName: string;
    authorize: boolean;
    validate: boolean;
};

/** Basename of `generated/{product}/tools/<name>-tools.ts` — matches exported `mcpServerName`. */
export function resolveMcpModuleNameFromToolsModule(toolsModuleTsPath: string): string {
    return path.parse(toolsModuleTsPath).name;
}

export function resolveAuthStubDir(projectRoot: string, toolsModuleTsPath: string): string {
    const hostProduct = resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath);
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    return path.join(projectRoot, 'src', 'auth', hostProduct, mcpModuleName);
}

function authStubRelativePath(toolsModuleTsPath: string, fileBase: string): string {
    const hostProduct = resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath);
    const mcpModuleName = resolveMcpModuleNameFromToolsModule(toolsModuleTsPath);
    return `src/auth/${hostProduct}/${mcpModuleName}/${fileBase}.ts`;
}

function resolveVerifyStubRelPath(toolsModuleTsPath: string): string {
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    return authStubRelativePath(toolsModuleTsPath, names.fileBase);
}

function renderToolAuthStubBody(toolName: string, spec: ToolAuthStubSpec, toolsModuleTsPath: string): string {
    const lines: string[] = [];
    if (spec.authorize) {
        const fn = authorizeExportName(toolName);
        lines.push(`export function ${fn}(credentials: ModuleCredentials): void {
    void credentials;
}`);
    }
    if (spec.validate) {
        const fn = validateInputExportName(toolName);
        lines.push(`export function ${fn}(options: InvokeOptions, credentials: ModuleCredentials): InvokeOptions {
    void options;
    void credentials;
    throw new Error('Implement ${fn} in ${authStubRelativePath(toolsModuleTsPath, toolName)}');
}`);
    }
    return lines.join('\n\n');
}

export function renderToolAuthStubFileContent(
    toolName: string,
    spec: ToolAuthStubSpec,
    authStubTsPath: string,
    toolsModuleTsPath: string
): string {
    const importSpec = relativeJsImportPath(authStubTsPath, toolsModuleTsPath);
    const authDir = path.dirname(authStubTsPath);
    const verifyStubPath = path.join(authDir, `${resolveModuleCredentialNames(toolsModuleTsPath).fileBase}.ts`);
    const verifyImportSpec = relativeJsImportPath(authStubTsPath, verifyStubPath);
    const header =
        spec.authorize && spec.validate
            ? `/**
 * Authorize + validate stubs for "${toolName}" (write-once — implement authorize / validateInput).
 */`
            : spec.authorize
              ? `/**
 * Authorize stub for "${toolName}" (write-once — override ${authorizeExportName(toolName)} for role gates).
 */`
              : `/**
 * Validate stub for "${toolName}" (write-once — implement ${validateInputExportName(toolName)}).
 */`;
    return `${header}
import type { ModuleCredentials } from '${verifyImportSpec}';
import type { InvokeOptions } from '${importSpec}';

${renderToolAuthStubBody(toolName, spec, toolsModuleTsPath)}
`;
}

export async function ensureToolAuthStubsAtProjectRoot(
    projectRoot: string,
    toolSpecs: readonly ToolAuthStubSpec[],
    toolsModuleTsPath: string
): Promise<Map<string, string>> {
    const authDir = resolveAuthStubDir(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const importPaths = new Map<string, string>();
    for (const spec of toolSpecs) {
        if (!spec.authorize && !spec.validate) {
            continue;
        }
        const tsPath = path.join(authDir, `${spec.toolName}.ts`);
        if (!fs.existsSync(tsPath)) {
            fs.writeFileSync(
                tsPath,
                renderToolAuthStubFileContent(spec.toolName, spec, tsPath, toolsModuleTsPath),
                'utf-8'
            );
        }
        importPaths.set(spec.toolName, tsPath);
    }

    return importPaths;
}

export async function ensureToolAuthStubsFromSource(
    source: string,
    toolSpecs: readonly ToolAuthStubSpec[],
    toolsModuleTsPath: string
): Promise<Map<string, string>> {
    const projectRoot = resolveBootstrapProjectRootFromSource(source);
    return ensureToolAuthStubsAtProjectRoot(projectRoot, toolSpecs, toolsModuleTsPath);
}

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
    const authDir = resolveAuthStubDir(projectRoot, toolsModuleTsPath);
    const names = resolveModuleCredentialNames(toolsModuleTsPath);
    return path.join(authDir, `${names.fileBase}.ts`);
}

/** Write-once \`src/auth/{product}/<module>/verify*Credentials.ts\` when DSL has auth. */
export async function ensureVerifyCredentialStubAtProjectRoot(
    projectRoot: string,
    toolsModuleTsPath: string
): Promise<string | undefined> {
    const authDir = resolveAuthStubDir(projectRoot, toolsModuleTsPath);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
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

export function renderValidatorsMap(toolNames: readonly string[]): string {
    const typeAnnotation =
        ': Record<string, (options: InvokeOptions, credentials: ModuleCredentials) => InvokeOptions | Promise<InvokeOptions>>';
    if (toolNames.length === 0) {
        return `const validators${typeAnnotation} = {};`;
    }
    const entries = toolNames.map((toolName) => {
        const fn = validateInputExportName(toolName);
        return `    ${JSON.stringify(toolName)}: ${fn}`;
    });
    return `const validators${typeAnnotation} = {\n${entries.join(',\n')}\n};`;
}

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

export function renderValidatorImports(tsPath: string, stubPaths: Map<string, string>): string {
    const lines: string[] = [];
    for (const [toolName, absStub] of stubPaths) {
        const rel = relativeJsImportPath(tsPath, absStub);
        const fn = validateInputExportName(toolName);
        const stubContent = fs.existsSync(absStub) ? fs.readFileSync(absStub, 'utf-8') : '';
        if (stubContent.includes(`export function ${fn}`)) {
            lines.push(`import { ${fn} } from '${rel}';`);
        }
    }
    return lines.join('\n');
}
