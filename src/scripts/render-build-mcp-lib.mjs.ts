import { GENERATED_SCRIPTS_BANNER } from './generated-scripts-banner.js';

export type McpScriptsProduct = 'api2ai' | 'db2ai';

export function renderBuildMcpLibMjsSource(product: McpScriptsProduct): string {
    const defaultPort = product === 'db2ai' ? '4853' : '3854';
    const collectEnvKeysHttpTail =
        product === 'db2ai'
            ? `
    if (demo.mcpAuthHeaderEnv === 'MCP_AUTH_HEADER') {
        keys.push('MCP_AUTH_EXPECTED');
    }`
            : '';
    const db2aiExtraRuntimeDepsBlock =
        product === 'db2ai'
            ? `
/**
 * @param {string} moduleName
 * @param {Record<string, string>} rootDeps
 */
export function db2aiExtraRuntimeDeps(moduleName, rootDeps) {
    if (moduleName.includes('postgresql')) {
        return { pg: rootDeps.pg ?? '^8.21.0' };
    }
    if (moduleName.includes('mysql')) {
        return { mysql2: rootDeps.mysql2 ?? '^3.22.5' };
    }
    if (moduleName.includes('mariadb')) {
        return { mysql2: rootDeps.mysql2 ?? '^3.22.5' };
    }
    if (moduleName.includes('sqlserver')) {
        return { mssql: rootDeps.mssql ?? '^11.0.1' };
    }
    if (moduleName.includes('oracle')) {
        return { oracledb: rootDeps.oracledb ?? '^6.10.0' };
    }
    return {};
}
`
            : '';

    return `${GENERATED_SCRIPTS_BANNER}/**
 * Shared helpers for bundling generated servers/* MCP hosts into dist/mcp/.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const VALID_HOST_KINDS = new Set(['stdio', 'public-http', 'passthrough-http', 'oauth-http']);

/**
 * @param {string} moduleName
 * @param {string} hostKind
 * @param {Record<string, object>} httpDemos
 * @param {Record<string, object>} oauthDemos
 */
export function collectEnvKeys(moduleName, hostKind, httpDemos, oauthDemos) {
    if (hostKind === 'oauth-http') {
        const demo = oauthDemos[moduleName];
        if (!demo) {
            throw new Error(\`Unknown oauth-http demo module: \${moduleName}\`);
        }
        const keys = [demo.baseUrlEnv, demo.connectionEnv, demo.oauthIdpUrlEnv, demo.portEnv].filter(Boolean);
        keys.push('OAUTH_IDP_REDIRECT_URIS', 'MCP_HTTP_CORS_ORIGIN');
        return [...new Set(keys)];
    }
    const demo = httpDemos[moduleName];
    if (!demo) {
        throw new Error(\`Unknown HTTP demo module: \${moduleName}\`);
    }
    if (demo.hostKind && demo.hostKind !== hostKind) {
        throw new Error(\`Demo \${moduleName} uses host kind \${demo.hostKind}, not \${hostKind}\`);
    }
    const keys = [demo.baseUrlEnv, demo.connectionEnv, demo.authEnv, demo.portEnv, demo.mcpAuthHeaderEnv, demo.authExpectedEnv].filter(
        Boolean
    );${collectEnvKeysHttpTail}
    return [...new Set(keys)];
}

/**
 * @param {string} text
 * @param {string[]} keys
 */
export function extractEnvExampleSections(text, keys) {
    const keySet = new Set(keys);
    const lines = text.split('\\n');
    /** @type {string[]} */
    const sections = [];
    /** @type {string[]} */
    let current = [];

    const flush = () => {
        if (current.length === 0) {
            return;
        }
        const include = current.some((line) => {
            const match = /^([A-Z][A-Z0-9_]*)=/.exec(line);
            return match && keySet.has(match[1]);
        });
        if (include) {
            sections.push(...current);
        }
        current = [];
    };

    for (const line of lines) {
        if (line.trim() === '' && current.length > 0) {
            flush();
            continue;
        }
        current.push(line);
    }
    flush();

    const body = sections.join('\\n').trim();
    return body ? \`\${body}\\n\` : \`# Set required variables (see demo .env.example in the authoring workspace).\\n\`;
}

/**
 * @param {string} envExampleText
 * @param {string} portEnv
 */
export function readExamplePort(envExampleText, portEnv) {
    const match = new RegExp(\`^\${portEnv}=(\\\\d+)\`, 'm').exec(envExampleText);
    return match ? match[1] : '${defaultPort}';
}

/**
 * @param {string} envExampleText
 * @param {string | undefined} key
 */
export function readExampleEnvValue(envExampleText, key) {
    if (!key) {
        return undefined;
    }
    const match = new RegExp(\`^\${key}=(.+)$\`, 'm').exec(envExampleText);
    if (!match) {
        return undefined;
    }
    return match[1].trim().replace(/^["']|["']$/g, '');
}

/**
 * @param {string} moduleName
 * @param {string} hostKind
 * @param {string} port
 * @param {string} envExampleText
 * @param {Record<string, object>} httpDemos
 * @param {Record<string, object>} oauthDemos
 */
export function renderMcpJsonExample(moduleName, hostKind, port, envExampleText, httpDemos, oauthDemos) {
    const mcpUrl = \`http://127.0.0.1:\${port}/mcp\`;
    if (hostKind === 'oauth-http') {
        return JSON.stringify(
            {
                mcpServers: {
                    [moduleName]: {
                        url: mcpUrl,
                        auth: {
                            CLIENT_ID: 'mcp-demo-local'
                        }
                    }
                }
            },
            null,
            4
        );
    }
    const demo = httpDemos[moduleName];
    const server = { url: mcpUrl };
    if (demo?.mcpAuthHeaderEnv) {
        const headerEnv = demo.mcpAuthHeaderEnv;
        const match = new RegExp(\`^\${headerEnv}=(.+)$\`, 'm').exec(envExampleText);
        const headerName = match ? match[1].trim() : 'x-api-token';
        server.headers = { [headerName]: '<credential>' };
    }
    return JSON.stringify({ mcpServers: { [moduleName]: server } }, null, 4);
}

/**
 * CLI flags for \`node server.mjs\` in a dist bundle (mirrors demo start scripts).
 *
 * @param {string} moduleName
 * @param {string} hostKind
 * @param {string} examplePort
 * @param {string} envExampleText
 * @param {Record<string, object>} httpDemos
 * @param {Record<string, object>} oauthDemos
 */
export function buildDistServerArgv(moduleName, hostKind, examplePort, envExampleText, httpDemos, oauthDemos) {
    /** @type {string[]} */
    const argv = [];
    if (hostKind === 'oauth-http') {
        const demo = oauthDemos[moduleName];
        if (!demo) {
            throw new Error(\`Unknown oauth-http demo module: \${moduleName}\`);
        }
        if (demo.baseUrlEnv) {
            argv.push('--base-url-env', demo.baseUrlEnv);
        }
        const idpUrl = readExampleEnvValue(envExampleText, demo.oauthIdpUrlEnv);
        if (idpUrl) {
            argv.push('--oauth-idp-url', idpUrl);
        }
        argv.push('--oauth-scope', demo.oauthScope ?? moduleName);
        argv.push('--port', examplePort, '--path', '/mcp');
        return argv;
    }
    if (hostKind === 'stdio') {
        const demo = httpDemos[moduleName];
        if (demo?.baseUrlEnv) {
            argv.push('--base-url-env', demo.baseUrlEnv);
        }
        if (demo?.authEnv) {
            argv.push('--auth-env', demo.authEnv);
        }
        return argv;
    }
    const demo = httpDemos[moduleName];
    if (!demo) {
        throw new Error(\`Unknown HTTP demo module: \${moduleName}\`);
    }
    if (demo.baseUrlEnv) {
        argv.push('--base-url-env', demo.baseUrlEnv);
    }
    if (demo.authEnv) {
        argv.push('--auth-env', demo.authEnv);
    }
    argv.push('--port', examplePort, '--path', '/mcp');
    return argv;
}

/**
 * @param {string[]} argv
 */
function shellQuoteArg(argv) {
    return argv.map((arg) => (/^[A-Za-z0-9_./:=+-]+$/.test(arg) ? arg : \`'\${arg.replace(/'/g, "'\\\\''")}'\`)).join(' ');
}

/**
 * @param {string[]} serverArgv
 */
export function renderDistStartScript(serverArgv) {
    return \`node server.mjs \${shellQuoteArg(serverArgv)}\`;
}

/**
 * @param {string} hostKind
 * @param {Record<string, string>} rootDeps
 * @param {Record<string, string>} [extraDeps]
 * @param {string} [startScript]
 */
export function renderDistPackageJson(moduleName, hostKind, rootDeps, extraDeps = {}, startScript) {
    /** @type {Record<string, string>} */
    const dependencies = {
        '@modelcontextprotocol/sdk': rootDeps['@modelcontextprotocol/sdk'] ?? '^1.29.0',
        zod: rootDeps.zod ?? '^4.4.3',
        ...extraDeps
    };
    if (hostKind === 'oauth-http') {
        dependencies.jose = rootDeps.jose ?? '^6.2.3';
    }
    /** @type {Record<string, unknown>} */
    const pkg = {
        name: \`@private/\${moduleName}-\${hostKind}-mcp\`,
        private: true,
        type: 'module',
        dependencies
    };
    if (startScript) {
        pkg.scripts = { start: startScript };
    }
    return JSON.stringify(pkg, null, 4);
}
${db2aiExtraRuntimeDepsBlock}
/**
 * @param {object} options
 * @param {string} options.demosRoot
 * @param {string} options.productName
 * @param {string} options.moduleName
 * @param {string} options.hostKind
 * @param {Record<string, object>} options.httpDemos
 * @param {Record<string, object>} options.oauthDemos
 * @param {(moduleName: string) => Record<string, string>} [options.extraRuntimeDeps]
 */
export async function buildMcpPackage({
    demosRoot,
    productName,
    moduleName,
    hostKind,
    httpDemos,
    oauthDemos,
    extraRuntimeDeps = () => ({})
}) {
    if (!VALID_HOST_KINDS.has(hostKind)) {
        throw new Error(\`Invalid --host \${hostKind}. Use: \${[...VALID_HOST_KINDS].join(', ')}\`);
    }

    const serverJs = path.join(
        demosRoot,
        'generated',
        productName,
        'servers',
        \`\${moduleName}-\${hostKind}-mcp-server.js\`
    );
    if (!existsSync(serverJs)) {
        throw new Error(\`Missing \${serverJs}. Run: npm run build:generated\`);
    }

    const envKeys = collectEnvKeys(moduleName, hostKind, httpDemos, oauthDemos);
    const envExamplePath = path.join(demosRoot, '.env.example');
    const envExampleText = readFileSync(envExamplePath, 'utf-8');
    const envExampleOut = extractEnvExampleSections(envExampleText, envKeys);

    const portEnv =
        hostKind === 'oauth-http'
            ? oauthDemos[moduleName]?.portEnv
            : httpDemos[moduleName]?.portEnv;
    const examplePort = portEnv ? readExamplePort(envExampleText, portEnv) : '${defaultPort}';

    const demosPackage = JSON.parse(readFileSync(path.join(demosRoot, 'package.json'), 'utf-8'));
    const rootDeps = demosPackage.dependencies ?? {};
    const distExtraDeps = extraRuntimeDeps(moduleName);
    const serverArgv = buildDistServerArgv(
        moduleName,
        hostKind,
        examplePort,
        envExampleText,
        httpDemos,
        oauthDemos
    );
    const startScript = renderDistStartScript(serverArgv);
    const outDir = path.join(demosRoot, 'dist', 'mcp', \`\${moduleName}-\${hostKind}\`);
    mkdirSync(outDir, { recursive: true });

    writeFileSync(
        path.join(outDir, 'package.json'),
        \`\${renderDistPackageJson(moduleName, hostKind, rootDeps, distExtraDeps, startScript)}\\n\`,
        'utf-8'
    );

    await esbuild.build({
        entryPoints: [serverJs],
        bundle: true,
        platform: 'node',
        target: 'node20',
        format: 'esm',
        outfile: path.join(outDir, 'server.mjs'),
        packages: 'external',
        logLevel: 'info'
    });

    writeFileSync(path.join(outDir, '.env.example'), envExampleOut, 'utf-8');
    writeFileSync(
        path.join(outDir, 'mcp.json.example'),
        \`\${renderMcpJsonExample(moduleName, hostKind, examplePort, envExampleText, httpDemos, oauthDemos)}\\n\`,
        'utf-8'
    );

    return { outDir, startScript };
}
`;
}
