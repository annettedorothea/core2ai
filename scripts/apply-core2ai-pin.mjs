#!/usr/bin/env node
/**
 * Sync @core2ai/core GitHub pin from this package into consumer package.json files.
 *
 * Consumer repo must contain core2ai-pin.targets.json at its root (see api2ai / db2ai).
 * Run from the consumer repository root: npm run core2ai:apply-pin
 * Then: npm run install:github-https
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetsPath = path.join(consumerRoot, 'core2ai-pin.targets.json');

if (!fs.existsSync(targetsPath)) {
    console.error(
        `[core2ai:apply-pin] missing ${path.relative(consumerRoot, targetsPath)} — run from api2ai or db2ai root`
    );
    process.exit(1);
}

const pin = JSON.parse(fs.readFileSync(path.join(scriptsDir, 'core2ai-pin.json'), 'utf-8'));
const spec = pin.spec;
const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf-8'));

function setCoreDep(packageJsonPath) {
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (!pkg.dependencies?.['@core2ai/core']) {
        return false;
    }
    pkg.dependencies['@core2ai/core'] = spec;
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 4)}\n`, 'utf-8');
    return true;
}

function patchGeneratorFallback(relativePath) {
    const generatorPath = path.join(consumerRoot, relativePath);
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
    const packageJsonPath = path.join(consumerRoot, relative);
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
} else {
    console.log('[core2ai:apply-pin] run: npm run install:github-https');
}
