/**
 * npm `prepare`: build from source only in the core2ai git checkout.
 * Consumers install prebuilt `out/` from npm — no TypeScript build, no husky.
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isDevCheckout = existsSync(path.join(root, 'src', 'codegen', 'index.ts'));

if (isDevCheckout) {
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
}
