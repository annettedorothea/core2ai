import * as fs from 'node:fs';
import * as path from 'node:path';

import { renderBuildMcpLibMjsSource, type McpScriptsProduct } from './render-build-mcp-lib.mjs.js';
import { renderEnsureMcpBuildStampMjsSource } from './render-ensure-mcp-build-stamp.mjs.js';
import { renderForegroundLifecycleMjsSource } from './render-foreground-lifecycle.mjs.js';
import { renderGenerateAllVsixMjsSource } from './render-generate-all-vsix.mjs.js';
import { renderGenerateVsixMjsSource } from './render-generate-vsix.mjs.js';
import { renderKillListenersOnPortMjsSource } from './render-kill-listeners-on-port.mjs.js';
import { renderKillMcpPortsMjsSource } from './render-kill-mcp-ports.mjs.js';
import { renderLoadEnvLocalMjsSource } from './render-load-env-local.mjs.js';
import { renderMcpInspectLibMjsSource } from './render-mcp-inspect-lib.mjs.js';
import { renderPrintMcpCatalogMjsSource } from './render-print-mcp-catalog.mjs.js';
import { renderProjectMetaMjsSource } from './render-project-meta.mjs.js';
import { renderRequireEnvMjsSource } from './render-require-env.mjs.js';
import { renderResolveCliVsixMjsSource } from './render-resolve-cli-vsix.mjs.js';
import { renderStartServiceLibMjsSource } from './render-start-service-lib.mjs.js';
import type { ScriptsProduct } from './product-scripts-meta.js';

export type { ScriptsProduct } from './product-scripts-meta.js';
export { productScriptsMeta, generatedScriptsDirRelative } from './product-scripts-meta.js';
export { runGenerateBatch, listRootDslFiles } from './run-generate-batch.js';

/** @deprecated Removed — use generated/{product}/scripts/project-meta.mjs as workspace marker. */
export const PROJECT_GENERATE_CONFIG = 'project-generate.config.json';

/** Marker file under generated/{product}/scripts/ for demo project root detection. */
export const PROJECT_META_SCRIPT = 'project-meta.mjs';

/**
 * Write VSIX utility scripts under `generated/{product}/scripts/`.
 * Does not touch other products' trees.
 */
export function writeGeneratedScripts(projectRoot: string, product: ScriptsProduct): void {
    const resolved: McpScriptsProduct = product === 'db2ai' ? 'db2ai' : 'api2ai';
    const outDir = path.join(projectRoot, 'generated', resolved, 'scripts');
    fs.mkdirSync(outDir, { recursive: true });

    const files: { fileName: string; source: string }[] = [
        { fileName: 'project-meta.mjs', source: renderProjectMetaMjsSource(resolved) },
        { fileName: 'resolve-cli-vsix.mjs', source: renderResolveCliVsixMjsSource(resolved) },
        { fileName: 'generate-vsix.mjs', source: renderGenerateVsixMjsSource(resolved) },
        { fileName: 'generate-all-vsix.mjs', source: renderGenerateAllVsixMjsSource(resolved) },
        { fileName: 'ensure-mcp-build-stamp.mjs', source: renderEnsureMcpBuildStampMjsSource(resolved) },
        { fileName: 'load-env-local.mjs', source: renderLoadEnvLocalMjsSource() },
        { fileName: 'kill-listeners-on-port.mjs', source: renderKillListenersOnPortMjsSource() },
        { fileName: 'require-env.mjs', source: renderRequireEnvMjsSource() },
        { fileName: 'print-mcp-catalog.mjs', source: renderPrintMcpCatalogMjsSource() },
        { fileName: 'build-mcp-lib.mjs', source: renderBuildMcpLibMjsSource(resolved) },
        { fileName: 'kill-mcp-ports.mjs', source: renderKillMcpPortsMjsSource() },
        { fileName: 'foreground-lifecycle.mjs', source: renderForegroundLifecycleMjsSource() },
        { fileName: 'start-service-lib.mjs', source: renderStartServiceLibMjsSource() },
        { fileName: 'mcp-inspect-lib.mjs', source: renderMcpInspectLibMjsSource() }
    ];

    for (const { fileName, source } of files) {
        fs.writeFileSync(path.join(outDir, fileName), source, 'utf-8');
    }

    // Remove legacy flat scripts/generated if empty after callers migrate
    const legacyDir = path.join(projectRoot, 'scripts', 'generated');
    if (fs.existsSync(legacyDir)) {
        /* callers delete when updating demos; leave untouched here */
    }
}
