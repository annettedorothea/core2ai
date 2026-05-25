#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function resolveGitDir() {
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

const gitDir = resolveGitDir();
if (!gitDir) {
    console.log('[install-hooks] .git not found; skipping pre-commit hook installation.');
    process.exit(0);
}

const hooksDir = path.join(gitDir, 'hooks');
const hookPath = path.join(hooksDir, 'pre-commit');
const hookBody = `#!/bin/sh
set -eu

cd "$(git rev-parse --show-toplevel)"

echo "[pre-commit] running npm run check"
npm run check
`;

fs.mkdirSync(hooksDir, { recursive: true });
fs.writeFileSync(hookPath, hookBody, { mode: 0o755 });
fs.chmodSync(hookPath, 0o755);
console.log(`[install-hooks] installed ${hookPath}`);
