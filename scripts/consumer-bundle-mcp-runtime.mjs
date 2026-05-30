#!/usr/bin/env node
/**
 * Bundle MCP host standalone entry for api2ai / db2ai CLI resources.
 *
 * Usage: node consumer-bundle-mcp-runtime.mjs <consumer-root> <bundle-mcp-runtime.config.json>
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

function findCore2aiRoot(consumerRoot) {
    const candidates = [
        path.join(consumerRoot, 'node_modules/@core2ai/core'),
        path.join(consumerRoot, 'packages/cli/node_modules/@core2ai/core'),
        path.join(consumerRoot, '../core2ai')
    ];
    for (const candidate of candidates) {
        const entry = path.join(candidate, 'packages/mcp-host/out/mcp-standalone-entry.js');
        if (fs.existsSync(entry)) {
            return { root: candidate, entry };
        }
    }
    return undefined;
}

function loadConfig(configPath) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (typeof config.outfile !== 'string' || !Array.isArray(config.external)) {
        throw new Error('[bundle:mcp-runtime] config needs "outfile" and "external" array');
    }
    return config;
}

function loadEsbuild(consumerRoot) {
    const requireFromConsumer = createRequire(path.join(consumerRoot, 'package.json'));
    return requireFromConsumer('esbuild');
}

function main() {
    const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
    const configPath = path.resolve(process.argv[3] ?? '');
    if (!configPath) {
        console.error('Usage: node consumer-bundle-mcp-runtime.mjs <consumer-root> <bundle-mcp-runtime.config.json>');
        process.exit(1);
    }

    const config = loadConfig(configPath);
    const core = findCore2aiRoot(consumerRoot);
    if (!core) {
        console.error('[bundle:mcp-runtime] @core2ai/core not found — npm install or core2ai:use-local first');
        process.exit(1);
    }

    const outfile = path.resolve(consumerRoot, config.outfile);
    fs.mkdirSync(path.dirname(outfile), { recursive: true });

    console.log(`[bundle:mcp-runtime] ${path.relative(consumerRoot, core.entry)} → ${config.outfile}`);
    const esbuild = loadEsbuild(consumerRoot);
    esbuild.buildSync({
        entryPoints: [core.entry],
        bundle: true,
        platform: 'node',
        format: 'esm',
        banner: { js: '#!/usr/bin/env node' },
        outfile,
        external: config.external
    });
}

main();
