import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type AccessKind = 'public' | 'protected' | 'checked';

export function parameterCheckExportName(toolName: string): string {
    return `check${toolName.charAt(0).toUpperCase()}${toolName.slice(1)}Parameters`;
}

export async function compileAuthStubSources(authDir: string): Promise<void> {
    if (!fs.existsSync(authDir)) {
        return;
    }
    const tsFiles = fs
        .readdirSync(authDir)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => path.join(authDir, name));
    for (const tsPath of tsFiles) {
        const mjsPath = tsPath.replace(/\.ts$/, '.mjs');
        await esbuild.build({
            entryPoints: [tsPath],
            outfile: mjsPath,
            bundle: false,
            platform: 'node',
            format: 'esm',
            target: 'node20',
            logLevel: 'silent'
        });
    }
}
