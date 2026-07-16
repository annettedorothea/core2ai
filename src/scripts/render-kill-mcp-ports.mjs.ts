import { GENERATED_SCRIPTS_BANNER } from './generated-scripts-banner.js';

export function renderKillMcpPortsMjsSource(): string {
    const lines = [
        GENERATED_SCRIPTS_BANNER.trimEnd(),
        '',
        `/**`,
        ` * Kill listeners on ports from demo maps ({ portEnv }).`,
        ` */`,
        `import { killListenersOnPort } from './kill-listeners-on-port.mjs';`,
        `import { optionalEnvInt } from './require-env.mjs';`,
        ``,
        `/**`,
        ` * @param {Record<string, { portEnv: string }>} demos`,
        ` * @param {string[]} names`,
        ` * @param {string} logPrefix`,
        ` */`,
        `export function killPortsFromDemoMaps(demos, names, logPrefix) {`,
        `    for (const name of names) {`,
        `        const portEnv = demos[name]?.portEnv;`,
        `        if (!portEnv) {`,
        `            continue;`,
        `        }`,
        `        const port = optionalEnvInt(portEnv);`,
        `        if (port === undefined) {`,
        `            console.warn(\`[\${logPrefix}] skip \${name}: \${portEnv} not set\`);`,
        `            continue;`,
        `        }`,
        `        killListenersOnPort(port, { logPrefix });`,
        `    }`,
        `}`,
        ``
    ];
    return lines.join('\n');
}
