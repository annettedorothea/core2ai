import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

import { productScriptsMeta, type ScriptsProduct } from './product-scripts-meta.js';

export type RunGenerateBatchOptions = {
    workspaceRoot: string;
    /** Absolute path to CLI entry (cli.js / cli.cjs). Required — no discovery. */
    cliPath: string;
    product: ScriptsProduct;
    /** When set, injected as embed home env for the CLI spawn. */
    embedHome?: string;
};

function formatCodegenBuildTimestamp(date = new Date()): string {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = Math.floor(absOffset / 60);
    const offsetMins = absOffset % 60;
    const tzLabel =
        offsetMins === 0
            ? `UTC${sign}${offsetHours}`
            : `UTC${sign}${offsetHours}:${String(offsetMins).padStart(2, '0')}`;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min} (${tzLabel})`;
}

/** Top-level DSL files only (workspace root), matching product extension. */
export function listRootDslFiles(workspaceRoot: string, dslExtension: string): string[] {
    return readdirSync(workspaceRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(dslExtension))
        .map((entry) => entry.name)
        .sort();
}

/**
 * Spawn CLI generate for each root-level DSL file.
 * Callers supply an explicit `cliPath` — no env / extension / monorepo discovery.
 */
export function runGenerateBatch(options: RunGenerateBatchOptions): void {
    const { workspaceRoot, cliPath, product, embedHome } = options;
    const meta = productScriptsMeta(product);

    if (!existsSync(cliPath)) {
        throw new Error(`[runGenerateBatch] CLI not found at ${cliPath}`);
    }

    const dslFiles = listRootDslFiles(workspaceRoot, meta.dslExtension);
    if (dslFiles.length === 0) {
        throw new Error(`[runGenerateBatch] no *${meta.dslExtension} files at workspace root ${workspaceRoot}`);
    }

    process.env.TF_BUILD_GENERATED_AT = formatCodegenBuildTimestamp();
    const env = embedHome && embedHome.length > 0 ? { ...process.env, [meta.embedHomeEnvVar]: embedHome } : process.env;

    for (const dslName of dslFiles) {
        const dslPath = path.join(workspaceRoot, dslName);
        const baseName = path.basename(dslName, meta.dslExtension);
        const outPath = path.join(workspaceRoot, 'generated', product, 'tools', `${baseName}-tools.ts`);
        console.log(`[runGenerateBatch] ${dslName} → generated/${product}/tools/${baseName}-tools.ts`);
        execFileSync(process.execPath, [cliPath, 'generate', dslPath, outPath], {
            stdio: 'inherit',
            cwd: workspaceRoot,
            env
        });
    }
}
