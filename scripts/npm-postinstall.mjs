/**
 * npm `postinstall`: husky only in the core2ai dev checkout (husky is a devDependency here).
 * Skip when @toolfactory.dev/core is installed as a dependency elsewhere.
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isDevCheckout = existsSync(path.join(root, 'src', 'codegen', 'index.ts'));
const huskyBin = path.join(root, 'node_modules', 'husky', 'bin.js');

if (isDevCheckout && existsSync(huskyBin)) {
    execSync(process.execPath, [huskyBin], { cwd: root, stdio: 'inherit' });
}
