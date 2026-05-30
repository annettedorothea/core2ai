#!/usr/bin/env node
/**
 * Publish a pre-built VSIX to GitHub (prerelease).
 *
 * Expects the artifact from CP6/8 preview:
 *   packages/extension/<extension-name>-<version>.vsix
 *
 * Does not run test, check, or extension:vsix — only uploads the tested file.
 *
 * Usage: node consumer-release-vsix.mjs <consumer-root> [extension-workspace]
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const consumerRoot = path.resolve(positional[0] ?? process.cwd());
const extensionWorkspace = positional[1] ?? 'packages/extension';
const extensionDir = path.join(consumerRoot, extensionWorkspace);
const extensionPkgPath = path.join(extensionDir, 'package.json');

if (!fs.existsSync(extensionPkgPath)) {
    console.error(`[release:vsix] missing ${extensionPkgPath}`);
    process.exit(1);
}

const extensionPkg = JSON.parse(fs.readFileSync(extensionPkgPath, 'utf-8'));
const releaseNotes =
    'Internal test build of the Cursor/VS Code extension (prerelease on GitHub).';

function run(label, command, args, options = {}) {
    console.log(`[release:vsix] ${label}`);
    const result = spawnSync(command, args, {
        cwd: consumerRoot,
        stdio: 'inherit',
        ...options
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

const vsixName = `${extensionPkg.name}-${extensionPkg.version}.vsix`;
const vsixPath = path.join(extensionDir, vsixName);
const tag = `${extensionPkg.name}-${extensionPkg.version}`;

console.log(`[release:vsix] publishing tested artifact: ${vsixPath}`);

if (!fs.existsSync(vsixPath)) {
    console.error(`[release:vsix] missing VSIX at ${vsixPath}`);
    console.error('[release:vsix] build and test first: npm run extension:vsix -w packages/extension');
    process.exit(1);
}

run('GitHub release', 'gh', [
    'release',
    'create',
    tag,
    vsixPath,
    '--title',
    `${extensionPkg.name} ${extensionPkg.version}`,
    '--notes',
    releaseNotes,
    '--prerelease'
]);

console.log(`[release:vsix] done (${tag})`);
