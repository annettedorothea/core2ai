#!/usr/bin/env node
/**
 * Apply @core2ai/core GitHub pin and force reinstall so lockfile + node_modules match.
 *
 * Run from api2ai or db2ai root: npm run core2ai:refresh-pin
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { applyCore2aiPin } from './apply-core2ai-pin.mjs';
import { reinstallCoreForTargets } from './core2ai-install-utils.mjs';
import { loadPin } from './resolve-core2ai-scripts.mjs';

const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetsPath = path.join(consumerRoot, 'core2ai-pin.targets.json');

if (!fs.existsSync(targetsPath)) {
    console.error(
        `[core2ai:refresh-pin] missing ${path.relative(consumerRoot, targetsPath)} — run from api2ai or db2ai root`
    );
    process.exit(1);
}

applyCore2aiPin(consumerRoot);

const { pin, source } = loadPin(consumerRoot);
const spec = pin.spec;
const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf-8'));

console.log(`[core2ai:refresh-pin] reinstall ${spec} (pin source: ${source})`);
reinstallCoreForTargets(consumerRoot, targets, spec, 'core2ai:refresh-pin');
console.log('[core2ai:refresh-pin] done');
