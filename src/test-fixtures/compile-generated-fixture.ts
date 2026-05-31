import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const require = createRequire(import.meta.url);
const tscBin = require.resolve('typescript/bin/tsc');

type CompileWorkspaceRoot = {
    root: string;
    extendsConfig: 'tsconfig.json' | 'tsconfig.generated.json';
};

function findCompileWorkspaceRoot(startDir: string): CompileWorkspaceRoot {
    let dir = path.resolve(startDir);
    let demosCandidate: CompileWorkspaceRoot | undefined;
    while (true) {
        if (
            fs.existsSync(path.join(dir, 'tsconfig.base.json')) &&
            fs.existsSync(path.join(dir, 'demos-generate.config.json'))
        ) {
            demosCandidate = { root: dir, extendsConfig: 'tsconfig.generated.json' };
        }
        if (fs.existsSync(path.join(dir, 'tsconfig.build.json'))) {
            return { root: dir, extendsConfig: 'tsconfig.json' };
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            if (demosCandidate) {
                return demosCandidate;
            }
            throw new Error(
                '[compile-generated-fixture] compile workspace root not found (tsconfig.build.json or demos tsconfig.generated.json)'
            );
        }
        dir = parent;
    }
}

function compileGeneratedInDir(projectRoot: string, workspace: CompileWorkspaceRoot, include: string[]): void {
    const tsconfigRelExtends = path
        .relative(projectRoot, path.join(workspace.root, workspace.extendsConfig))
        .split(path.sep)
        .join('/');
    const isDemosTmpFixture =
        workspace.extendsConfig === 'tsconfig.generated.json' &&
        path.resolve(projectRoot) !== path.resolve(workspace.root);
    const tsconfig: Record<string, unknown> = {
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
    if (isDemosTmpFixture) {
        tsconfig.exclude = [];
    }
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
    const workspace = findCompileWorkspaceRoot(runRoot);
    compileGeneratedInDir(runRoot, workspace, ['generated/**/*.ts']);

    const localAuth = path.join(runRoot, 'src', 'auth');
    if (fs.existsSync(localAuth)) {
        compileGeneratedInDir(runRoot, workspace, ['src/auth/**/*.ts']);
    }

    const parentRoot = path.dirname(runRoot);
    const parentAuth = path.join(parentRoot, 'src', 'auth');
    if (parentRoot !== runRoot && fs.existsSync(parentAuth)) {
        compileGeneratedInDir(parentRoot, workspace, ['src/auth/**/*.ts']);
    }
}
