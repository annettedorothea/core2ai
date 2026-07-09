import * as path from 'node:path';

export type GeneratedProductId = 'api2ai' | 'db2ai';

/** Relative `.js` import spec from one `.ts` file to another. */
export function relativeJsImportPath(fromTsPath: string, toTsPath: string): string {
    let rel = path
        .relative(path.dirname(path.resolve(fromTsPath)), path.resolve(toTsPath))
        .split(path.sep)
        .join('/');
    if (!rel.startsWith('.')) {
        rel = `./${rel}`;
    }
    return rel.replace(/\.ts$/, '.js');
}

/** `generated/{hostProduct}/tools/{basename}-tools.ts` */
export function resolveGeneratedToolsPath(
    projectRoot: string,
    hostProduct: GeneratedProductId,
    dslBasename: string
): string {
    return path.join(projectRoot, 'generated', hostProduct, 'tools', `${dslBasename}-tools.ts`);
}

/** Host product segment from a tools module path (`generated/api2ai/tools/…`). */
export function resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath: string): GeneratedProductId {
    const toolsDir = path.dirname(path.resolve(toolsModuleTsPath));
    if (path.basename(toolsDir) !== 'tools') {
        throw new Error(`Expected tools module under generated/<product>/tools/: ${toolsModuleTsPath}`);
    }
    const product = path.basename(path.dirname(toolsDir));
    if (product !== 'api2ai' && product !== 'db2ai') {
        throw new Error(`Unknown host product in tools path: ${product}`);
    }
    return product;
}

/** `generated/{product}/cli` for a tools module under `generated/{product}/tools/`. */
export function resolveGeneratedCliDir(toolsModuleTsPath: string): string {
    const toolsDir = path.dirname(path.resolve(toolsModuleTsPath));
    if (path.basename(toolsDir) !== 'tools') {
        return path.join(toolsDir, 'cli');
    }
    return path.join(path.dirname(toolsDir), 'cli');
}

export function resolveProjectRootFromGeneratedCliDir(cliDir: string): string {
    return path.resolve(cliDir, '..', '..', '..');
}

/** Fail when CLI destination path product segment does not match the generating CLI. */
export function assertGeneratedToolsDestinationMatchesHostProduct(
    toolsModuleTsPath: string,
    hostProduct: GeneratedProductId
): void {
    const actual = resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath);
    if (actual !== hostProduct) {
        throw new Error(
            `[generate] destination "${toolsModuleTsPath}" is for host product "${actual}", but this CLI generates "${hostProduct}". Use generated/${hostProduct}/tools/<name>-tools.ts.`
        );
    }
}

/** Relative import from a generated cli/tools file to `src/utils/logging-adapter.ts`. */
export function relativeImportToLoggingAdapter(fromGeneratedTsPath: string, projectRoot: string): string {
    return relativeJsImportPath(fromGeneratedTsPath, path.join(projectRoot, 'src', 'utils', 'logging-adapter.ts'));
}

export function loggingAdapterImportForCliFile(cliFileTsPath: string, projectRoot: string): string {
    return relativeImportToLoggingAdapter(cliFileTsPath, projectRoot);
}
