#!/usr/bin/env node
/**
 * Report whether @core2ai/core is linked via file: (local/dev) or github: pin.
 *
 * Usage (api2ai / db2ai root): npm run core2ai:link-mode
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPin } from './resolve-core2ai-scripts.mjs';

const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetsPath = path.join(consumerRoot, 'core2ai-pin.targets.json');

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

function main() {
    if (!fs.existsSync(targetsPath)) {
        console.log('[core2ai:link-mode] not a consumer repo (no core2ai-pin.targets.json)');
        process.exit(0);
    }

    const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf-8'));
    const { pin } = loadPin(consumerRoot);
    const entries = [];

    for (const relative of targets.packageJson ?? []) {
        const spec = readCoreDep(relative);
        entries.push({
            packageJson: relative,
            spec: spec ?? '(missing)',
            mode: classifySpec(spec)
        });
    }

    const modes = new Set(entries.map((entry) => entry.mode));
    let overall = 'unknown';
    if (modes.size === 1 && modes.has('local')) {
        overall = 'local';
    } else if (modes.size === 1 && modes.has('pin')) {
        overall = 'pin';
    } else if (modes.has('local')) {
        overall = 'mixed';
    } else if (modes.has('pin')) {
        overall = 'pin';
    }

    if (process.argv.includes('--json')) {
        console.log(JSON.stringify({ overall, canonicalPin: pin.spec, entries }, null, 2));
        return;
    }

    console.log(`[core2ai:link-mode] overall=${overall} canonicalPin=${pin.spec}`);
    for (const entry of entries) {
        console.log(`  ${entry.packageJson}: ${entry.mode} (${entry.spec})`);
    }

    if (process.argv.includes('--require-pin') && overall !== 'pin') {
        console.error('[core2ai:link-mode] expected pin mode — run npm run core2ai:use-pin');
        process.exit(1);
    }
}

main();
