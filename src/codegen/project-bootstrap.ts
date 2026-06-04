import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderStdioMcpServerSource } from './render-stdio-mcp-server.js';

export type ProjectBootstrapConfig = {
    generatorImplementationDir: string;
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

export function resolveGeneratedCliDir(destinationTsPath: string): string {
    const dir = path.dirname(path.resolve(destinationTsPath));
    return path.basename(dir) === 'tools' ? path.join(path.dirname(dir), 'cli') : path.join(dir, 'cli');
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

export function writeGeneratedStdioMcpHost(cliDir: string, _config?: ProjectBootstrapConfig): string {
    if (!fs.existsSync(cliDir)) {
        fs.mkdirSync(cliDir, { recursive: true });
    }
    const dest = path.join(cliDir, 'stdio-mcp-server.ts');
    fs.writeFileSync(dest, renderStdioMcpServerSource(), 'utf-8');
    return dest;
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
                `[generate] "${pjsonPath}": install runtime dependencies: ${missing.join(', ')} (npm install), then generated/cli/stdio-mcp-server.js can run.`
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
