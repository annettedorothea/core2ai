import { GENERATED_SCRIPTS_BANNER } from './generated-scripts-banner.js';
import { productScriptsMeta, type ScriptsProduct } from './product-scripts-meta.js';

export function renderEnsureMcpBuildStampMjsSource(product: ScriptsProduct): string {
    const meta = productScriptsMeta(product);
    const lines = [
        GENERATED_SCRIPTS_BANNER.trimEnd(),
        '',
        `/**`,
        ` * Ensures generated/${meta.productName}/mcp-build-generated-at.ts exists for tsc.`,
        ` */`,
        `import { existsSync, mkdirSync, writeFileSync } from 'node:fs';`,
        `import * as path from 'node:path';`,
        `import { fileURLToPath } from 'node:url';`,
        ``,
        `import { productName } from './project-meta.mjs';`,
        ``,
        `const scriptsDir = path.dirname(fileURLToPath(import.meta.url));`,
        `const projectRoot = path.resolve(scriptsDir, '../../..');`,
        `const outPath = path.join(projectRoot, 'generated', productName, 'mcp-build-generated-at.ts');`,
        ``,
        `if (!existsSync(outPath)) {`,
        `    mkdirSync(path.dirname(outPath), { recursive: true });`,
        `    writeFileSync(`,
        `        outPath,`,
        `        \`/** Placeholder until generate:all — not for release verification. */\\nexport const mcpBuildGeneratedAt = 'placeholder (run generate:all)';\\n\`,`,
        `        'utf-8'`,
        `    );`,
        `    console.log(\`[ensure-mcp-build-stamp] created \${path.relative(projectRoot, outPath)}\`);`,
        `}`,
        ``
    ];
    return lines.join('\n');
}
