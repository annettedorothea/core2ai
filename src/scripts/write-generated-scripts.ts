import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderKillListenersOnPortMjsSource } from './render-kill-listeners-on-port.mjs.js';
import { renderLoadEnvLocalMjsSource } from './render-load-env-local.mjs.js';
import { renderRequireEnvMjsSource } from './render-require-env.mjs.js';

/** Project marker for workspaces that use generated `scripts/generated/*.mjs` utilities. */
export const PROJECT_GENERATE_CONFIG = 'project-generate.config.json';

const OUTPUT_FILES: { fileName: string; render: () => string }[] = [
    { fileName: 'load-env-local.mjs', render: renderLoadEnvLocalMjsSource },
    { fileName: 'kill-listeners-on-port.mjs', render: renderKillListenersOnPortMjsSource },
    { fileName: 'require-env.mjs', render: renderRequireEnvMjsSource }
];

/** Write utility scripts under `scripts/generated/` (not generate / generate-all — those are hand-maintained). */
export function writeGeneratedScripts(projectRoot: string): void {
    const configPath = path.join(projectRoot, PROJECT_GENERATE_CONFIG);
    if (!fs.existsSync(configPath)) {
        return;
    }

    const outDir = path.join(projectRoot, 'scripts', 'generated');
    fs.mkdirSync(outDir, { recursive: true });

    for (const { fileName, render } of OUTPUT_FILES) {
        fs.writeFileSync(path.join(outDir, fileName), render(), 'utf-8');
    }
}
