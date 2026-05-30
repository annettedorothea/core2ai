#!/usr/bin/env node
/**
 * Shared npm install helpers for core2ai:use-local / core2ai:refresh-pin.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export function githubHttpsEnv() {
    const existingCount = Number.parseInt(process.env.GIT_CONFIG_COUNT ?? '0', 10);
    const configCount = Number.isFinite(existingCount) && existingCount >= 0 ? existingCount : 0;
    return {
        ...process.env,
        GIT_CONFIG_COUNT: String(configCount + 2),
        [`GIT_CONFIG_KEY_${configCount}`]: 'url.https://github.com/.insteadOf',
        [`GIT_CONFIG_VALUE_${configCount}`]: 'ssh://git@github.com/',
        [`GIT_CONFIG_KEY_${configCount + 1}`]: 'url.https://github.com/.insteadOf',
        [`GIT_CONFIG_VALUE_${configCount + 1}`]: 'git@github.com:'
    };
}

export function runNpm(args, consumerRoot, label = 'core2ai') {
    const rel = path.relative(process.cwd(), consumerRoot) || '.';
    console.log(`[${label}] npm ${args.join(' ')} (cwd: ${rel})`);
    const result = spawnSync(npmCommand, args, {
        cwd: consumerRoot,
        env: githubHttpsEnv(),
        stdio: 'inherit'
    });
    if ((result.status ?? 1) !== 0) {
        process.exit(result.status ?? 1);
    }
}

export function readWorkspaces(consumerRoot) {
    const pkgPath = path.join(consumerRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return [];
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.workspaces ?? [];
}

export function installTargetForPackageJson(relativePath, workspaces) {
    const dir = path.dirname(relativePath).replace(/\\/g, '/');
    const workspaceMatch = workspaces.find((ws) => {
        const normalized = ws.replace(/\\/g, '/');
        return dir === normalized;
    });
    if (workspaceMatch) {
        return { type: 'workspace', ref: workspaceMatch };
    }
    return { type: 'prefix', ref: dir };
}

export function removeInstalledCore(consumerRoot, packageJsonRelative) {
    const pkgDir = path.join(consumerRoot, path.dirname(packageJsonRelative));
    const candidates = [
        path.join(consumerRoot, 'node_modules/@core2ai/core'),
        path.join(pkgDir, 'node_modules/@core2ai/core')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            fs.rmSync(candidate, { recursive: true, force: true });
            console.log(`[core2ai:install] removed ${path.relative(consumerRoot, candidate)}`);
        }
    }
}

/** Root npm install plus prefix installs for targets outside workspaces (e.g. demos). */
export function syncCoreInstalls(consumerRoot, targets, label) {
    const workspaces = readWorkspaces(consumerRoot);
    const packageJsonTargets = targets.packageJson ?? [];

    for (const relative of packageJsonTargets) {
        removeInstalledCore(consumerRoot, relative);
    }

    runNpm(['install'], consumerRoot, label);

    const seenPrefix = new Set();
    for (const relative of packageJsonTargets) {
        const target = installTargetForPackageJson(relative, workspaces);
        if (target.type !== 'prefix' || seenPrefix.has(target.ref)) {
            continue;
        }
        seenPrefix.add(target.ref);
        runNpm(['install'], path.join(consumerRoot, target.ref), label);
    }
}

/**
 * Remove stale @core2ai/core copies, then install the given spec per workspace target.
 */
export function reinstallCoreForTargets(consumerRoot, targets, spec, label) {
    const workspaces = readWorkspaces(consumerRoot);
    const packageJsonTargets = targets.packageJson ?? [];

    for (const relative of packageJsonTargets) {
        removeInstalledCore(consumerRoot, relative);
    }

    const seen = new Set();
    for (const relative of packageJsonTargets) {
        const target = installTargetForPackageJson(relative, workspaces);
        const key = `${target.type}:${target.ref}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const installArgs =
            target.type === 'workspace'
                ? ['install', `@core2ai/core@${spec}`, '-w', target.ref]
                : ['install', `@core2ai/core@${spec}`, '--prefix', target.ref];

        runNpm(installArgs, consumerRoot, label);
    }

    runNpm(['install'], consumerRoot, label);
}
