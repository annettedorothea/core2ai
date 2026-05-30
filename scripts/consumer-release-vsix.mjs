#!/usr/bin/env node
/**
 * VSIX release pipeline for api2ai / db2ai consumer repos.
 *
 * Usage: node consumer-release-vsix.mjs <consumer-root> [extension-workspace]
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
const extensionWorkspace = process.argv[3] ?? 'packages/extension';
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

run('verify (test)', 'npm', ['run', 'test']);
run('verify (check)', 'npm', ['run', 'check']);
run('package VSIX', 'npm', ['run', 'extension:vsix', '-w', extensionWorkspace]);

const vsixName = `${extensionPkg.name}-${extensionPkg.version}.vsix`;
const vsixPath = path.join(extensionDir, vsixName);
const tag = `${extensionPkg.name}-${extensionPkg.version}`;

if (!fs.existsSync(vsixPath)) {
    console.error(`[release:vsix] expected VSIX at ${vsixPath}`);
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
