#!/usr/bin/env node
/**
 * Verify installed @core2ai/core matches package.json link mode (pin vs local).
 * Catches stale nested node_modules when manifests were patched without reinstall.
 *
 * Usage: node scripts/run-core2ai-script.mjs check-resolved-core2ai-link.mjs [--require-pin]
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetsPath = path.join(consumerRoot, 'core2ai-pin.targets.json');
const requirePin = process.argv.includes('--require-pin');

function readCoreDep(relativePath) {
    const packageJsonPath = path.join(consumerRoot, relativePath);
    if (!fs.existsSync(packageJsonPath)) {
        return undefined;
    }
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return pkg.dependencies?.['@core2ai/core'];
}

function classifySpec(spec) {
    if (typeof spec !== 'string' || spec.trim().length === 0) {
        return 'missing';
    }
    if (spec.startsWith('file:')) {
        return 'local';
    }
    if (spec.startsWith('github:')) {
        return 'pin';
    }
    return 'other';
}

function siblingCoreRoot() {
    const siblingPackageJson = path.resolve(consumerRoot, '../core2ai/package.json');
    if (!fs.existsSync(siblingPackageJson)) {
        return undefined;
    }
    return fs.realpathSync(path.resolve(consumerRoot, '../core2ai'));
}

function resolveInstalledCoreRoot(relativePath) {
    const pkgDir = path.join(consumerRoot, path.dirname(relativePath));
    const nestedRoot = path.join(pkgDir, 'node_modules/@core2ai/core');
    const hoistedRoot = path.join(consumerRoot, 'node_modules/@core2ai/core');
    for (const candidate of [nestedRoot, hoistedRoot]) {
        if (fs.existsSync(path.join(candidate, 'package.json'))) {
            return fs.realpathSync(candidate);
        }
    }

    const entry = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(entry)) {
        return undefined;
    }
    try {
        const require = createRequire(entry);
        const codegenEntry = require.resolve('@core2ai/core/codegen');
        let dir = path.dirname(codegenEntry);
        for (let depth = 0; depth < 10; depth += 1) {
            const pkgPath = path.join(dir, 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                if (pkg.name === '@core2ai/core') {
                    return fs.realpathSync(dir);
                }
            }
            const parent = path.dirname(dir);
            if (parent === dir) {
                break;
            }
            dir = parent;
        }
    } catch {
        return undefined;
    }
    return undefined;
}

function main() {
    if (!fs.existsSync(targetsPath)) {
        process.exit(0);
    }

    const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf-8'));
    const sibling = siblingCoreRoot();
    const mismatches = [];

    for (const relative of targets.packageJson ?? []) {
        const spec = readCoreDep(relative);
        const expected = classifySpec(spec);
        const installedRoot = resolveInstalledCoreRoot(relative);

        if (installedRoot === undefined) {
            mismatches.push({
                packageJson: relative,
                reason: '@core2ai/core is not installed for this workspace'
            });
            continue;
        }

        const pointsAtSibling =
            sibling !== undefined &&
            (installedRoot === sibling || installedRoot.startsWith(`${sibling}${path.sep}`));

        if (expected === 'pin' && pointsAtSibling) {
            mismatches.push({
                packageJson: relative,
                reason: 'package.json uses GitHub pin but node_modules still resolves to sibling core2ai',
                installedRoot
            });
            continue;
        }

        if (expected === 'local' && sibling !== undefined && !pointsAtSibling) {
            mismatches.push({
                packageJson: relative,
                reason: 'package.json uses file: sibling but node_modules does not resolve there',
                installedRoot,
                expectedSibling: sibling
            });
        }
    }

    if (mismatches.length === 0) {
        if (requirePin) {
            for (const relative of targets.packageJson ?? []) {
                if (classifySpec(readCoreDep(relative)) !== 'pin') {
                    console.error(
                        `[core2ai:check-resolved] ${relative} is not on GitHub pin — run npm run core2ai:use-pin`
                    );
                    process.exit(1);
                }
            }
        }
        process.exit(0);
    }

    console.error('[core2ai:check-resolved] node_modules does not match package.json link mode');
    console.error('Run npm run core2ai:use-pin or npm run core2ai:use-local to resync installs.');
    for (const hit of mismatches) {
        console.error(`  ${hit.packageJson}: ${hit.reason}`);
        if (hit.installedRoot) {
            console.error(`    resolved: ${hit.installedRoot}`);
        }
    }
    process.exit(1);
}

main();
