#!/usr/bin/env node
/**
 * Apply @core2ai/core GitHub pin and force reinstall so lockfile + node_modules match.
 *
 * Run from api2ai or db2ai root: npm run core2ai:refresh-pin
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { applyCore2aiPin } from './apply-core2ai-pin.mjs';
import { loadPin } from './resolve-core2ai-scripts.mjs';

const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetsPath = path.join(consumerRoot, 'core2ai-pin.targets.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!fs.existsSync(targetsPath)) {
    console.error(
        `[core2ai:refresh-pin] missing ${path.relative(consumerRoot, targetsPath)} — run from api2ai or db2ai root`
    );
    process.exit(1);
}

function githubHttpsEnv() {
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

function runNpm(args, cwd = consumerRoot) {
    const rel = path.relative(process.cwd(), cwd) || '.';
    console.log(`[core2ai:refresh-pin] npm ${args.join(' ')} (cwd: ${rel})`);
    const result = spawnSync(npmCommand, args, {
        cwd,
        env: githubHttpsEnv(),
        stdio: 'inherit'
    });
    if ((result.status ?? 1) !== 0) {
        process.exit(result.status ?? 1);
    }
}

function readWorkspaces(root) {
    const pkgPath = path.join(root, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return [];
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.workspaces ?? [];
}

function installTargetForPackageJson(relativePath, workspaces) {
    const dir = path.dirname(relativePath).replace(/\\/g, '/');
    const workspaceMatch = workspaces.find((ws) => {
        const normalized = ws.replace(/\\/g, '/');
        return dir === normalized || dir.startsWith(`${normalized}/`);
    });
    if (workspaceMatch) {
        return { type: 'workspace', ref: workspaceMatch };
    }
    return { type: 'prefix', ref: dir };
}

function removeInstalledCore(packageJsonRelative) {
    const pkgDir = path.join(consumerRoot, path.dirname(packageJsonRelative));
    const candidates = [
        path.join(consumerRoot, 'node_modules/@core2ai/core'),
        path.join(pkgDir, 'node_modules/@core2ai/core')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            fs.rmSync(candidate, { recursive: true, force: true });
            console.log(`[core2ai:refresh-pin] removed ${path.relative(consumerRoot, candidate)}`);
        }
    }
}

applyCore2aiPin(consumerRoot);

const { pin, source } = loadPin(consumerRoot);
const spec = pin.spec;
const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf-8'));
const workspaces = readWorkspaces(consumerRoot);

console.log(`[core2ai:refresh-pin] reinstall ${spec} (pin source: ${source})`);

for (const relative of targets.packageJson ?? []) {
    removeInstalledCore(relative);
}

const seen = new Set();
for (const relative of targets.packageJson ?? []) {
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

    runNpm(installArgs);
}

runNpm(['install']);

console.log('[core2ai:refresh-pin] done');
