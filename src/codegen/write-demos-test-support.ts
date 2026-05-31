import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderCompileGeneratedFixtureSource } from '../test-fixtures/render-compile-generated-fixture.js';
import { renderEnvHelpersSource } from '../test-fixtures/render-env-helpers.js';
import { renderGeneratedModuleSource } from '../test-fixtures/render-generated-module.js';
import { renderMcpStdioSmokeSource } from '../test-fixtures/render-mcp-stdio-smoke.js';
import { renderTestSupportIndexSource } from '../test-fixtures/render-test-support-index.js';

const DEMOS_GENERATE_CONFIG = 'demos-generate.config.json';

const OUTPUT_FILES: { fileName: string; render: () => string }[] = [
    { fileName: 'generated-module.ts', render: renderGeneratedModuleSource },
    { fileName: 'compile-generated-fixture.ts', render: renderCompileGeneratedFixtureSource },
    { fileName: 'mcp-stdio-smoke.ts', render: renderMcpStdioSmokeSource },
    { fileName: 'env-helpers.ts', render: renderEnvHelpersSource },
    { fileName: 'index.ts', render: renderTestSupportIndexSource }
];

/** Write `test/generated/*.ts` for demo workspaces (api2ai/db2ai layout). */
export function writeGeneratedDemosTestSupport(projectRoot: string): void {
    const configPath = path.join(projectRoot, DEMOS_GENERATE_CONFIG);
    if (!fs.existsSync(configPath)) {
        return;
    }

    const outDir = path.join(projectRoot, 'test', 'generated');
    fs.mkdirSync(outDir, { recursive: true });

    for (const { fileName, render } of OUTPUT_FILES) {
        fs.writeFileSync(path.join(outDir, fileName), render(), 'utf-8');
    }
}
