import * as fs from 'node:fs';
import * as path from 'node:path';

const REMOVED_FILES = [
    'generated-module.ts',
    'mcp-stdio-smoke.ts',
    'mcp-http-smoke.ts',
    'env-helpers.ts',
    'compile-generated-fixture.ts',
    'index.ts'
];

/** Remove legacy `test/generated/*` helpers; compile check uses `npm run build:generated`. */
export function writeGeneratedDemosTestSupport(projectRoot: string): void {
    const outDir = path.join(projectRoot, 'test', 'generated');
    for (const fileName of REMOVED_FILES) {
        const stalePath = path.join(outDir, fileName);
        if (fs.existsSync(stalePath)) {
            fs.unlinkSync(stalePath);
        }
    }
    if (fs.existsSync(outDir) && fs.readdirSync(outDir).length === 0) {
        fs.rmdirSync(outDir);
    }
}
