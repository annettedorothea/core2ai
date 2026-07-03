/**
 * Set @toolfactory.dev/core package version (library tag / release prelude).
 *
 * Usage: node scripts/bump-version.mjs <X.Y.Z>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];

const SEMVER =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

if (!version || !SEMVER.test(version)) {
    console.error('Usage: node scripts/bump-version.mjs <X.Y.Z>');
    process.exit(1);
}

const filePath = path.join(root, 'package.json');
const pkg = JSON.parse(readFileSync(filePath, 'utf8'));
const previous = pkg.version;
pkg.version = version;
writeFileSync(filePath, `${JSON.stringify(pkg, null, 4)}\n`, 'utf8');
console.log(`package.json: ${previous} → ${version}`);
