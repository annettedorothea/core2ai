#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisScriptsDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Locate scripts/core2ai-pin.json for a consumer repo (api2ai, db2ai) or core2ai itself.
 *
 * Priority:
 * 1. CORE2AI_PIN_SOURCE — path to scripts/ dir or core2ai-pin.json
 * 2. ../core2ai/scripts — sibling checkout (monorepo dev; avoids stale installed pin)
 * 3. node_modules/@core2ai/core/scripts — installed package (CI / no sibling)
 * 4. this package's scripts/ — when running from a core2ai checkout
 */
export function resolveScriptsDir(consumerRoot) {
    const root = path.resolve(consumerRoot ?? process.cwd());

    const explicit = process.env.CORE2AI_PIN_SOURCE;
    if (explicit) {
        const scriptsDir = resolveExplicitPinSource(explicit);
        return { scriptsDir, source: 'CORE2AI_PIN_SOURCE' };
    }

    if (process.env.CORE2AI_PIN_PREFER_INSTALLED !== '1') {
        const sibling = path.resolve(root, '../core2ai/scripts');
        if (fs.existsSync(path.join(sibling, 'core2ai-pin.json'))) {
            return { scriptsDir: sibling, source: '../core2ai/scripts' };
        }
    }

    const installed = path.join(root, 'node_modules/@core2ai/core/scripts');
    if (fs.existsSync(path.join(installed, 'core2ai-pin.json'))) {
        return { scriptsDir: installed, source: 'node_modules/@core2ai/core/scripts' };
    }

    if (fs.existsSync(path.join(thisScriptsDir, 'core2ai-pin.json'))) {
        return { scriptsDir: thisScriptsDir, source: 'core2ai/scripts' };
    }

    throw new Error(
        `[core2ai] cannot locate core2ai-pin.json (consumer root: ${root}). ` +
            'Install @core2ai/core, clone sibling ../core2ai, or set CORE2AI_PIN_SOURCE.'
    );
}

function resolveExplicitPinSource(explicit) {
    const resolved = path.resolve(explicit);
    if (!fs.existsSync(resolved)) {
        throw new Error(`[core2ai] CORE2AI_PIN_SOURCE not found: ${resolved}`);
    }
    if (fs.statSync(resolved).isDirectory()) {
        const asScripts = path.join(resolved, 'scripts', 'core2ai-pin.json');
        if (fs.existsSync(asScripts)) {
            return path.join(resolved, 'scripts');
        }
        if (fs.existsSync(path.join(resolved, 'core2ai-pin.json'))) {
            return resolved;
        }
    } else if (path.basename(resolved) === 'core2ai-pin.json') {
        return path.dirname(resolved);
    }
    throw new Error(
        `[core2ai] CORE2AI_PIN_SOURCE must be scripts/, core2ai-pin.json, or core2ai repo root: ${resolved}`
    );
}

export function loadPin(consumerRoot) {
    const { scriptsDir, source } = resolveScriptsDir(consumerRoot);
    const pinPath = path.join(scriptsDir, 'core2ai-pin.json');
    const pin = JSON.parse(fs.readFileSync(pinPath, 'utf-8'));
    return { pin, pinPath, scriptsDir, source };
}
