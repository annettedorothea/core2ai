#!/usr/bin/env node
/**
 * Sync @core2ai/core GitHub pin into consumer package.json files.
 *
 * Consumer repo must contain core2ai-pin.targets.json at its root (see api2ai / db2ai).
 * Run from the consumer repository root: npm run core2ai:apply-pin
 * Prefer: npm run core2ai:refresh-pin (apply + forced reinstall)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPin } from './resolve-core2ai-scripts.mjs';

export function applyCore2aiPin(consumerRootArg = process.cwd()) {
    const root = path.resolve(consumerRootArg);
    const targetsFile = path.join(root, 'core2ai-pin.targets.json');

    if (!fs.existsSync(targetsFile)) {
        throw new Error(
            `[core2ai:apply-pin] missing ${path.relative(root, targetsFile)} — run from api2ai or db2ai root`
        );
    }

    const { pin, source } = loadPin(root);
    const spec = pin.spec;
    const targets = JSON.parse(fs.readFileSync(targetsFile, 'utf-8'));

    console.log(`[core2ai:apply-pin] pin from ${source} → ${spec}`);

    function setCoreDep(packageJsonPath) {
        const raw = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(raw);
        if (!pkg.dependencies?.['@core2ai/core']) {
            return false;
        }
        if (pkg.dependencies['@core2ai/core'] === spec) {
            return false;
        }
        pkg.dependencies['@core2ai/core'] = spec;
        fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 4)}\n`, 'utf-8');
        return true;
    }

    function patchGeneratorFallback(relativePath) {
        const generatorPath = path.join(root, relativePath);
        if (!fs.existsSync(generatorPath)) {
            return false;
        }
        let text = fs.readFileSync(generatorPath, 'utf-8');
        const next = text.replace(/'@core2ai\/core':\s*'github:[^']+'/, `'@core2ai/core': '${spec}'`);
        if (next === text) {
            return false;
        }
        fs.writeFileSync(generatorPath, next, 'utf-8');
        return true;
    }

    let changed = 0;
    for (const relative of targets.packageJson ?? []) {
        const packageJsonPath = path.join(root, relative);
        if (fs.existsSync(packageJsonPath) && setCoreDep(packageJsonPath)) {
            console.log(`[core2ai:apply-pin] ${relative} → ${spec}`);
            changed += 1;
        }
    }

    if (targets.generatorFallback && patchGeneratorFallback(targets.generatorFallback)) {
        console.log(`[core2ai:apply-pin] ${targets.generatorFallback} dependencyVersionFallbacks`);
        changed += 1;
    }

    if (changed === 0) {
        console.log('[core2ai:apply-pin] nothing to update (already pinned?)');
    }

    return { spec, changed, targets };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
    try {
        applyCore2aiPin(process.argv[2]);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
