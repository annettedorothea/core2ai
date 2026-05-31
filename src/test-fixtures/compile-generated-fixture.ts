import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const require = createRequire(import.meta.url);
const tscBin = require.resolve('typescript/bin/tsc');

function findConsumerWorkspaceRoot(startDir: string): string {
    let dir = path.resolve(startDir);
    while (true) {
        if (fs.existsSync(path.join(dir, 'tsconfig.build.json'))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            throw new Error('[compile-generated-fixture] consumer workspace root not found (tsconfig.build.json)');
        }
        dir = parent;
    }
}

function compileGeneratedInDir(projectRoot: string, consumerWorkspaceRoot: string, include: string[]): void {
    const tsconfigRelExtends = path
        .relative(projectRoot, path.join(consumerWorkspaceRoot, 'tsconfig.json'))
        .split(path.sep)
        .join('/');
    const tsconfig = {
        extends: tsconfigRelExtends,
        compilerOptions: {
            noEmit: false,
            declaration: false,
            composite: false,
            rootDir: '.',
            outDir: '.',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            skipLibCheck: true,
            noUnusedLocals: false
        },
        include
    };
    const tsconfigPath = path.join(projectRoot, 'tsconfig.generated-fixture.json');
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    try {
        execFileSync(process.execPath, [tscBin, '-p', tsconfigPath], {
            cwd: projectRoot,
            stdio: 'pipe',
            encoding: 'utf-8'
        });
    } finally {
        fs.unlinkSync(tsconfigPath);
    }
}

/** Emit `.js` next to generated `.ts` (and optional `src/auth` stubs) for Vitest fixtures. */
export function compileGeneratedForSmoke(runRoot: string): void {
    const consumerWorkspaceRoot = findConsumerWorkspaceRoot(runRoot);
    compileGeneratedInDir(runRoot, consumerWorkspaceRoot, ['generated/**/*.ts']);

    const localAuth = path.join(runRoot, 'src', 'auth');
    if (fs.existsSync(localAuth)) {
        compileGeneratedInDir(runRoot, consumerWorkspaceRoot, ['src/auth/**/*.ts']);
    }

    const parentRoot = path.dirname(runRoot);
    const parentAuth = path.join(parentRoot, 'src', 'auth');
    if (parentRoot !== runRoot && fs.existsSync(parentAuth)) {
        compileGeneratedInDir(parentRoot, consumerWorkspaceRoot, ['src/auth/**/*.ts']);
    }
}
