#!/usr/bin/env node
/**
 * Install pre-commit and pre-push hooks for api2ai / db2ai consumer repos.
 *
 * Usage: node install-consumer-git-hooks.mjs [consumer-root]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());

function resolveGitDir(root) {
    const dotGit = path.join(root, '.git');
    if (!fs.existsSync(dotGit)) {
        return undefined;
    }
    const stat = fs.statSync(dotGit);
    if (stat.isDirectory()) {
        return dotGit;
    }
    if (!stat.isFile()) {
        return undefined;
    }
    const content = fs.readFileSync(dotGit, 'utf-8').trim();
    const match = /^gitdir:\s*(.+)$/i.exec(content);
    if (!match) {
        return undefined;
    }
    return path.resolve(root, match[1]);
}

function installHook(hooksDir, name, body) {
    const hookPath = path.join(hooksDir, name);
    fs.writeFileSync(hookPath, body, { mode: 0o755 });
    fs.chmodSync(hookPath, 0o755);
    console.log(`[install-hooks] installed ${hookPath}`);
}

const gitDir = resolveGitDir(consumerRoot);
if (!gitDir) {
    console.log('[install-hooks] .git not found; skipping hook installation.');
    process.exit(0);
}

const hooksDir = path.join(gitDir, 'hooks');

installHook(
    hooksDir,
    'pre-commit',
    `#!/bin/sh
set -eu

cd "$(git rev-parse --show-toplevel)"

echo "[pre-commit] running npm run check"
npm run check
`
);

installHook(
    hooksDir,
    'pre-push',
    `#!/bin/sh
set -eu

cd "$(git rev-parse --show-toplevel)"

echo "[pre-push] @core2ai/core pin guard (no file: in branch tip manifests)"
node scripts/run-core2ai-script.mjs check-push-core2ai-pin.mjs

echo "[pre-push] verify node_modules matches GitHub pin"
node scripts/run-core2ai-script.mjs check-resolved-core2ai-link.mjs --require-pin

echo "[pre-push] running npm run check (forced typecheck)"
npm run format:check
npm run typecheck -- --force
npm run lint
npm run check:generated
`
);
