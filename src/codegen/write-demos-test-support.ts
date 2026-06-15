import * as fs from 'node:fs';
import * as path from 'node:path';

import { PROJECT_GENERATE_CONFIG } from '../scripts/write-generated-scripts.js';

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
    const configPath = path.join(projectRoot, PROJECT_GENERATE_CONFIG);
    if (!fs.existsSync(configPath)) {
        return;
    }

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
