import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileAuthStubSources, parameterCheckExportName } from './access-stubs.js';
import { resolveBootstrapProjectRootFromSource } from './project-bootstrap.js';

export function renderAuthStubFileContent(toolName: string, invokeOptionsBasename: string): string {
    const fn = parameterCheckExportName(toolName);
    return `/**
 * Checked access parameter check for "${toolName}" (write-once — implement ${fn}).
 */
import type { InvokeOptions, CheckedHostContext } from './${invokeOptionsBasename}.js';

export function ${fn}(options: InvokeOptions, host: CheckedHostContext): InvokeOptions {
    void options;
    void host;
    throw new Error('Implement ${fn} in src/auth/${toolName}.ts');
}
`;
}

export function writeAuthInvokeOptionsTypeFile(authDir: string, basename: string, content: string): void {
    fs.writeFileSync(path.join(authDir, `${basename}.ts`), content, 'utf-8');
}

export async function ensureCheckedAuthStubsAtProjectRoot(
    projectRoot: string,
    checkedToolNames: readonly string[],
    invokeOptionsBasename: string,
    invokeOptionsTypeContent: string
): Promise<Map<string, string>> {
    const authDir = path.join(projectRoot, 'src', 'auth');
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    if (checkedToolNames.length === 0) {
        return new Map();
    }

    writeAuthInvokeOptionsTypeFile(authDir, invokeOptionsBasename, invokeOptionsTypeContent);

    const importPaths = new Map<string, string>();
    for (const toolName of checkedToolNames) {
        const tsPath = path.join(authDir, `${toolName}.ts`);
        const mjsPath = path.join(authDir, `${toolName}.mjs`);
        if (!fs.existsSync(tsPath)) {
            fs.writeFileSync(tsPath, renderAuthStubFileContent(toolName, invokeOptionsBasename), 'utf-8');
        }
        importPaths.set(toolName, mjsPath);
    }

    await compileAuthStubSources(authDir);
    return importPaths;
}

export async function ensureCheckedAuthStubsFromSource(
    source: string,
    checkedToolNames: readonly string[],
    invokeOptionsBasename: string,
    invokeOptionsTypeContent: string
): Promise<Map<string, string>> {
    const projectRoot = resolveBootstrapProjectRootFromSource(source);
    return ensureCheckedAuthStubsAtProjectRoot(
        projectRoot,
        checkedToolNames,
        invokeOptionsBasename,
        invokeOptionsTypeContent
    );
}

export function renderParameterCheckerImports(
    tsPath: string,
    stubPaths: Map<string, string>,
    typescript: boolean
): string {
    const lines: string[] = [];
    for (const [toolName, absStub] of stubPaths) {
        const absImport = typescript ? path.resolve(path.dirname(absStub), `${toolName}.ts`) : path.resolve(absStub);
        let rel = path
            .relative(path.dirname(path.resolve(tsPath)), absImport)
            .split(path.sep)
            .join('/');
        if (!rel.startsWith('.')) {
            rel = `./${rel}`;
        }
        if (typescript) {
            rel = rel.replace(/\.ts$/, '.js');
        }
        const fn = parameterCheckExportName(toolName);
        lines.push(`import { ${fn} } from '${rel}';`);
    }
    return lines.join('\n');
}

export function renderParameterCheckersMap(stubPaths: Map<string, string>, typescript = false): string {
    if (stubPaths.size === 0) {
        return typescript ? 'const parameterCheckers: Record<string, never> = {};' : 'const parameterCheckers = {};';
    }
    const typeAnnotation = typescript
        ? ': Record<string, (options: InvokeOptions, host: CheckedHostContext) => InvokeOptions | Promise<InvokeOptions>>'
        : '';
    const entries = [...stubPaths.keys()].map((toolName) => {
        const fn = parameterCheckExportName(toolName);
        return `    ${JSON.stringify(toolName)}: ${fn}`;
    });
    return `const parameterCheckers${typeAnnotation} = {\n${entries.join(',\n')}\n};`;
}
