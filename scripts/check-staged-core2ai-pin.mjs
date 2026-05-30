#!/usr/bin/env node
/**
 * Pre-commit guard: reject staged package.json / package-lock.json that pin
 * @core2ai/core via file: (local dev mode must not be committed).
 *
 * Usage (consumer root): node scripts/run-core2ai-script.mjs check-staged-core2ai-pin.mjs
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const consumerRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetsPath = path.join(consumerRoot, 'core2ai-pin.targets.json');

/** file:…/core2ai in manifests or lockfile resolved paths */
const FILE_CORE2AI_PATTERN = /file:[^\s"']*core2ai/i;

function git(args) {
    return spawnSync('git', args, { cwd: consumerRoot, encoding: 'utf-8' });
}

function stagedManifestPaths() {
    const result = git(['diff', '--cached', '--name-only', '--diff-filter=ACM']);
    if ((result.status ?? 1) !== 0) {
        return [];
    }
    return result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => {
            const base = path.basename(line);
            return base === 'package.json' || base === 'package-lock.json';
        });
}

function stagedFileContent(relativePath) {
    const result = git(['show', `:${relativePath}`]);
    if ((result.status ?? 1) !== 0 || !result.stdout) {
        return undefined;
    }
    return result.stdout;
}

function findViolations(text, relativePath) {
    const hits = [];
    const lines = text.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (FILE_CORE2AI_PATTERN.test(line)) {
            hits.push({ relativePath, line: index + 1, text: line.trim() });
        }
    }
    return hits;
}

function main() {
    if (!fs.existsSync(targetsPath)) {
        // core2ai repo itself — no consumer pin manifests to guard
        process.exit(0);
    }

    const staged = stagedManifestPaths();
    if (staged.length === 0) {
        process.exit(0);
    }

    const violations = [];
    for (const relativePath of staged) {
        const content = stagedFileContent(relativePath);
        if (content === undefined) {
            continue;
        }
        violations.push(...findViolations(content, relativePath));
    }

    if (violations.length === 0) {
        process.exit(0);
    }

    console.error('[core2ai:check-staged-pin] refuse commit: staged file: pin to core2ai detected');
    console.error('Use npm run core2ai:use-pin before commit (GitHub pin is canonical in git).');
    for (const hit of violations) {
        console.error(`  ${hit.relativePath}:${hit.line}: ${hit.text}`);
    }
    process.exit(1);
}

main();
