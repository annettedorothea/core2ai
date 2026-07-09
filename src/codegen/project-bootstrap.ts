import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratedProductId } from './generated-layout.js';
import { relativeJsImportPath } from './generated-layout.js';

export {
    resolveGeneratedCliDir,
    resolveGeneratedToolsPath,
    resolveHostProductFromGeneratedToolsPath
} from './generated-layout.js';

export type ProjectBootstrapConfig = {
    generatorImplementationDir: string;
    /** api2ai: HTTP/OpenAPI hosts only. db2ai: adds connectionEnv / database URL validation. Default api2ai. */
    hostProduct?: GeneratedProductId;
    embedHomeEnv?: string;
    fallbackProjectName: string;
    requiredRuntimeDeps: readonly string[];
    dependencyVersionFallbacks?: Record<string, string>;
    resolvePackageRoot?: (generatorImplementationDir: string) => string;
    missingDepsMessage?: (packageJsonPath: string, missing: readonly string[]) => string;
};

function resolveEmbedHomeDirectory(config: ProjectBootstrapConfig): string | undefined {
    const raw = config.embedHomeEnv ? process.env[config.embedHomeEnv]?.trim() : undefined;
    return raw ? path.resolve(raw) : undefined;
}

export function resolveBootstrapProjectRootFromSource(sourcePath: string): string {
    return path.dirname(path.resolve(sourcePath));
}

function resolveCliPackageRoot(config: ProjectBootstrapConfig): string {
    const embed = resolveEmbedHomeDirectory(config);
    if (embed) {
        return embed;
    }
    return (
        config.resolvePackageRoot?.(config.generatorImplementationDir) ??
        path.resolve(config.generatorImplementationDir, '..')
    );
}

function resolveCliPackageJsonPathForVersions(config: ProjectBootstrapConfig): string {
    return path.join(resolveCliPackageRoot(config), 'package.json');
}

function readCliPackageJson(config: ProjectBootstrapConfig): {
    version: string;
    dependencies?: Record<string, string>;
} {
    const p = resolveCliPackageJsonPathForVersions(config);
    const raw = fs.readFileSync(p, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string; dependencies?: Record<string, string> };
    return {
        version: typeof pkg.version === 'string' ? pkg.version : '0.0.1',
        dependencies: pkg.dependencies
    };
}

function readCliVersionsForBootstrap(config: ProjectBootstrapConfig): Record<string, string> {
    const pkg = readCliPackageJson(config);
    const out: Record<string, string> = {};
    for (const dep of config.requiredRuntimeDeps) {
        out[dep] = pkg.dependencies?.[dep] ?? config.dependencyVersionFallbacks?.[dep] ?? '*';
    }
    return out;
}

export function resolveMcpServerIdentityFromDestination(
    destinationTsPath: string,
    config: ProjectBootstrapConfig
): { name: string; version: string } {
    const pkg = readCliPackageJson(config);
    return {
        name: path.parse(destinationTsPath).name,
        version: pkg.version
    };
}

/** Env var set once by demos `generate-all.mjs` so every module shares the same build stamp. */
export const CODEGEN_BUILD_TIMESTAMP_ENV = 'TF_BUILD_GENERATED_AT';

/** Local readable build stamp, e.g. `2026-07-09 06:43 (UTC+2)`. */
export function formatCodegenBuildTimestamp(date: Date = new Date()): string {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = Math.floor(absOffset / 60);
    const offsetMins = absOffset % 60;
    const tzLabel =
        offsetMins === 0
            ? `UTC${sign}${offsetHours}`
            : `UTC${sign}${offsetHours}:${String(offsetMins).padStart(2, '0')}`;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min} (${tzLabel})`;
}

export function resolveCodegenBuildTimestamp(): string {
    const fromEnv = process.env[CODEGEN_BUILD_TIMESTAMP_ENV]?.trim();
    if (fromEnv) {
        return fromEnv;
    }
    return formatCodegenBuildTimestamp();
}

/** Basename (no ext) of the shared gitignored MCP build stamp next to `generated/{product}/tools/`. */
export const MCP_BUILD_GENERATED_AT_BASENAME = 'mcp-build-generated-at';

/** `generated/{product}/mcp-build-generated-at.ts` for a tools module under `generated/{product}/tools/*.ts`. */
export function resolveMcpBuildGeneratedAtTsPathFromToolsModule(toolsModuleTsPath: string): string {
    const toolsDir = path.dirname(path.resolve(toolsModuleTsPath));
    return path.join(path.dirname(toolsDir), `${MCP_BUILD_GENERATED_AT_BASENAME}.ts`);
}

export function renderMcpBuildGeneratedAtModuleSource(buildGeneratedAt: string): string {
    const quoted = buildGeneratedAt.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `/** Written by codegen — gitignored in demo workspaces. Do not edit. */
export const mcpBuildGeneratedAt = '${quoted}';
`;
}

export function renderMcpBuildGeneratedAtReExport(toolsModuleTsPath: string): string {
    const buildModuleTsPath = resolveMcpBuildGeneratedAtTsPathFromToolsModule(toolsModuleTsPath);
    const rel = relativeJsImportPath(toolsModuleTsPath, buildModuleTsPath);
    return `export { mcpBuildGeneratedAt } from '${rel}';`;
}

/** Writes or updates the shared build stamp module (typically gitignored). */
export function writeMcpBuildGeneratedAtModule(toolsModuleTsPath: string, buildGeneratedAt?: string): string {
    const outPath = resolveMcpBuildGeneratedAtTsPathFromToolsModule(toolsModuleTsPath);
    ensureParentDir(outPath);
    const stamp = buildGeneratedAt ?? resolveCodegenBuildTimestamp();
    fs.writeFileSync(outPath, renderMcpBuildGeneratedAtModuleSource(stamp), 'utf-8');
    return outPath;
}

function warnIfPackageJsonMissingMcpDeps(packageJsonDir: string, config: ProjectBootstrapConfig): void {
    const pjsonPath = path.join(packageJsonDir, 'package.json');
    if (!fs.existsSync(pjsonPath)) {
        return;
    }
    let pkg: unknown;
    try {
        pkg = JSON.parse(fs.readFileSync(pjsonPath, 'utf-8'));
    } catch {
        return;
    }
    if (!pkg || typeof pkg !== 'object') {
        return;
    }
    const rec = pkg as { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
    const merged = {
        ...(rec.optionalDependencies ?? {}),
        ...(rec.dependencies ?? {})
    };
    const missing = config.requiredRuntimeDeps.filter((key) => merged[key] === undefined);
    if (missing.length > 0) {
        console.warn(
            config.missingDepsMessage?.(pjsonPath, missing) ??
                `[generate] "${pjsonPath}": install runtime dependencies: ${missing.join(', ')} (npm install), then run a generated servers/*-mcp-server.js host.`
        );
    }
}

export function writeMinimalPackageJsonIfAbsent(projectRoot: string, config: ProjectBootstrapConfig): void {
    const dest = path.join(projectRoot, 'package.json');
    if (fs.existsSync(dest)) {
        warnIfPackageJsonMissingMcpDeps(projectRoot, config);
        return;
    }
    const versionsByDep = readCliVersionsForBootstrap(config);
    const slug =
        path
            .basename(projectRoot)
            .replace(/[^a-zA-Z0-9-]/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || config.fallbackProjectName;
    const body = {
        name: slug,
        private: true,
        type: 'module',
        dependencies: versionsByDep
    };
    fs.writeFileSync(dest, `${JSON.stringify(body, null, 4)}\n`, 'utf-8');
}

export function ensureParentDir(destination: string): void {
    const destinationDir = path.dirname(destination);
    if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
    }
}
