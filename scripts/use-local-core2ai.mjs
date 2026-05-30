#!/usr/bin/env node
/**
 * Switch @core2ai/core to file:../…/core2ai for sibling monorepo dev.
 * Removes stale installs and reinstalls per workspace so node_modules matches manifests.
 *
 * Usage (api2ai / db2ai root): npm run core2ai:use-local
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { syncCoreInstalls } from './core2ai-install-utils.mjs';

const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetsPath = path.join(consumerRoot, 'core2ai-pin.targets.json');
const siblingCore = path.resolve(consumerRoot, '../core2ai');

function fileSpecForPackageJson(relativePath) {
    const packageJsonPath = path.join(consumerRoot, relativePath);
    const pkgDir = path.dirname(packageJsonPath);
    let rel = path.relative(pkgDir, siblingCore).replace(/\\/g, '/');
    if (!rel.startsWith('.')) {
        rel = `./${rel}`;
    }
    return `file:${rel}`;
}

function main() {
    if (!fs.existsSync(targetsPath)) {
        console.error('[core2ai:use-local] missing core2ai-pin.targets.json — run from api2ai or db2ai root');
        process.exit(1);
    }
    if (!fs.existsSync(path.join(siblingCore, 'package.json'))) {
        console.error(`[core2ai:use-local] sibling core2ai not found at ${siblingCore}`);
        process.exit(1);
    }

    const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf-8'));
    let changed = 0;
    const specsByTarget = new Map();

    for (const relative of targets.packageJson ?? []) {
        const packageJsonPath = path.join(consumerRoot, relative);
        if (!fs.existsSync(packageJsonPath)) {
            continue;
        }
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (!pkg.dependencies?.['@core2ai/core']) {
            continue;
        }
        const nextSpec = fileSpecForPackageJson(relative);
        specsByTarget.set(relative, nextSpec);
        if (pkg.dependencies['@core2ai/core'] === nextSpec) {
            console.log(`[core2ai:use-local] ${relative} already ${nextSpec}`);
            continue;
        }
        pkg.dependencies['@core2ai/core'] = nextSpec;
        fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 4)}\n`, 'utf-8');
        console.log(`[core2ai:use-local] ${relative} → ${nextSpec}`);
        changed += 1;
    }

    if (changed === 0) {
        console.log('[core2ai:use-local] package.json entries already local');
    }

    console.log('[core2ai:use-local] reinstall sibling core2ai (build core2ai first if sources changed)');
    syncCoreInstalls(consumerRoot, targets, 'core2ai:use-local');

    console.log('[core2ai:use-local] done');
}

main();
