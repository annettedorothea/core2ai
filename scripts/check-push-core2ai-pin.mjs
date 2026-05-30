#!/usr/bin/env node
/**
 * Pre-push guard: branch tip manifests must not pin @core2ai/core via file:.
 * Commits may use file: during local dev; before push run npm run core2ai:use-pin.
 *
 * Usage (consumer root): node scripts/run-core2ai-script.mjs check-push-core2ai-pin.mjs
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

function manifestPathsToCheck() {
    if (!fs.existsSync(targetsPath)) {
        return [];
    }
    const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf-8'));
    const paths = [...(targets.packageJson ?? []), 'package-lock.json'];
    return [...new Set(paths)];
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

function readHeadFile(relativePath) {
    const result = git(['show', `HEAD:${relativePath}`]);
    if ((result.status ?? 1) !== 0 || !result.stdout) {
        return undefined;
    }
    return result.stdout;
}

function readWorkingTreeFile(relativePath) {
    const absolute = path.join(consumerRoot, relativePath);
    if (!fs.existsSync(absolute)) {
        return undefined;
    }
    return fs.readFileSync(absolute, 'utf-8');
}

function main() {
    if (!fs.existsSync(targetsPath)) {
        process.exit(0);
    }

    const manifests = manifestPathsToCheck();
    const violations = [];

    for (const relativePath of manifests) {
        const headContent = readHeadFile(relativePath);
        if (headContent !== undefined) {
            violations.push(...findViolations(headContent, `HEAD:${relativePath}`));
        }

        const workContent = readWorkingTreeFile(relativePath);
        if (workContent !== undefined) {
            violations.push(...findViolations(workContent, relativePath));
        }
    }

    if (violations.length === 0) {
        process.exit(0);
    }

    console.error('[core2ai:check-push-pin] refuse push: file: pin to core2ai in branch tip or working tree');
    console.error('Run npm run core2ai:use-pin, commit manifest changes, npm run check, then push.');
    for (const hit of violations) {
        console.error(`  ${hit.relativePath}:${hit.line}: ${hit.text}`);
    }
    process.exit(1);
}

main();
