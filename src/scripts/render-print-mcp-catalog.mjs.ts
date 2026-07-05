import { GENERATED_SCRIPTS_BANNER } from './generated-scripts-banner.js';

export function renderPrintMcpCatalogMjsSource(): string {
    return `${GENERATED_SCRIPTS_BANNER}/**
 * Pretty-print MCP server catalog (shared by npm run start).
 */

const CATALOG_BANNER = [
    '  ╭──────────────────────────────────────────────╮',
    '  │  ⚡ MCP servers · Streamable HTTP            │',
    '  ╰──────────────────────────────────────────────╯'
].join('\\n');

/**
 * @param {'running' | 'warning' | 'skipped'} status
 * @returns {string}
 */
function statusGlyph(status) {
    if (status === 'running') {
        return '●';
    }
    if (status === 'warning') {
        return '▲';
    }
    return '○';
}

/**
 * @param {string} status
 * @param {string | undefined} skipReason
 */
function printStatusNote(status, skipReason) {
    if ((status === 'skipped' || status === 'warning') && skipReason) {
        printField('Note:', skipReason);
    }
}

/**
 * @param {string} label
 * @param {string} value
 */
function printField(label, value) {
    const pad = ' '.repeat(Math.max(1, 10 - label.length));
    console.log(\`     \${label}\${pad}\${value}\`);
}

/**
 * @param {{ name: string, kind?: string, status?: string, skipReason?: string, url: string, auth: string, headers?: string, clientId?: string, oauthServerUrl?: string, oauthNote?: string }} entry
 */
function printHttpEntry(entry) {
    const status = entry.status ?? 'running';
    const kind = entry.kind ?? 'HTTP';
    console.log(\`  ┌─ \${entry.name} (\${kind}) \${statusGlyph(status)} \${status} ─\`);
    printStatusNote(status, entry.skipReason);
    printField('URL:', entry.url);
    printField('Auth:', entry.auth);
    if (entry.headers) {
        printField('Headers:', entry.headers);
    }
    console.log('  └────────────────────────────────────────────');
    console.log('');
}

/**
 * @param {{ name: string, kind?: string, status?: string, skipReason?: string, url: string, auth: string, clientId?: string, oauthServerUrl?: string, oauthNote?: string }} entry
 */
function printOAuthEntry(entry) {
    const status = entry.status ?? 'running';
    const kind = entry.kind ?? 'OAuth';
    console.log(\`  ┌─ \${entry.name} (\${kind}) \${statusGlyph(status)} \${status} ─\`);
    printStatusNote(status, entry.skipReason);
    printField('URL:', entry.url);
    printField('Auth:', entry.auth);
    if (entry.clientId) {
        printField('Client ID:', entry.clientId);
    }
    if (entry.oauthServerUrl) {
        printField('IdP URL:', entry.oauthServerUrl);
    }
    if (entry.oauthNote) {
        printField('Hint:', entry.oauthNote);
    }
    console.log('  └────────────────────────────────────────────');
    console.log('');
}

/**
 * @param {{
 *   logPrefix?: string,
 *   title?: string,
 *   subtitleLines?: string[],
 *   httpEntries?: object[],
 *   oauthEntries?: object[],
 *   footerLines?: string[]
 * }} options
 */
export function printMcpServerCatalog(options = {}) {
    const logPrefix = options.logPrefix ?? '[mcp]';
    const title = options.title ?? 'MCP servers';
    const httpEntries = options.httpEntries ?? [];
    const oauthEntries = options.oauthEntries ?? [];
    const subtitleLines = options.subtitleLines ?? [];
    const footerLines = options.footerLines ?? [];

    console.log('');
    console.log(CATALOG_BANNER);
    console.log(\`  \${title}\`);
    for (const line of subtitleLines) {
        console.log(\`  \${line}\`);
    }
    console.log('');

    if (httpEntries.length === 0 && oauthEntries.length === 0) {
        console.log(\`\${logPrefix} (no MCP servers configured)\`);
        console.log('');
        return;
    }

    for (const entry of httpEntries) {
        printHttpEntry(entry);
    }
    for (const entry of oauthEntries) {
        printOAuthEntry(entry);
    }

    for (const line of footerLines) {
        console.log(\`\${logPrefix} \${line}\`);
    }
    console.log('');
}
`;
}
