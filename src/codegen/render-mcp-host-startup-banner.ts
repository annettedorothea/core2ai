/** Shared stderr startup banner (catalog-style single-host card). */
export function renderMcpHostStartupBannerSource(describeUpstreamEnvField: string): string {
    return `
function formatStartupFieldLine(label: string, value: string): string {
    const pad = ' '.repeat(Math.max(1, 10 - label.length));
    return '     ' + label + pad + value;
}

function printMcpHostStartupBanner(options: {
    serverName: string;
    transport: string;
    status?: 'ready' | 'warning';
    note?: string;
    fields: { label: string; value: string }[];
}): void {
    const status = options.status ?? 'ready';
    const glyph = status === 'warning' ? '▲' : '●';
    const lines = [
        '',
        '  ┌─ ' + options.serverName + ' (' + options.transport + ') ' + glyph + ' ' + status + ' ─'
    ];
    if (options.note) {
        lines.push(formatStartupFieldLine('Note:', options.note));
    }
    for (const field of options.fields) {
        lines.push(formatStartupFieldLine(field.label, field.value));
    }
    lines.push('  └────────────────────────────────────────────');
    lines.push('');
    loggingAdapter.banner(lines);
}

${describeUpstreamEnvField}

function collectMissingEnvNote(keys: (string | undefined)[]): string | undefined {
    const missing = keys.filter((key): key is string => Boolean(key?.trim())).filter((key) => !process.env[key]?.trim());
    if (missing.length === 0) {
        return undefined;
    }
    return missing.join(', ') + ' unset — tool calls may fail until set in .env';
}

function requireMcpServerDisplayName(generated: GeneratedHostModule): string {
    const { name } = requireMcpServerIdentity(generated);
    return name;
}`.trim();
}

export function renderHttpMcpStartupBannerFn(
    profile: 'public' | 'passthrough',
    startupBannerConnectionEnvNotePrefix: string
): string {
    const authBlock =
        profile === 'public'
            ? `fields.push({ label: 'Auth:', value: 'None' });`
            : `const headerName = readAuthHeaderNameFromEnv();
    const authEnv = httpHostConfig.authEnvKey?.trim();
    if (authEnv) {
        const hasEnv = Boolean(process.env[authEnv]?.trim());
        fields.push({
            label: 'Auth:',
            value: 'Header ' + headerName + ' or .env ' + authEnv + (hasEnv ? '' : ' (env unset)')
        });
    } else {
        fields.push({ label: 'Auth:', value: 'Header ' + headerName });
    }`;

    return `
function printHttpMcpStartupBanner(
    generated: GeneratedHostModule,
    httpHostConfig: HttpMcpHostRuntimeConfig
): void {
    const url =
        'http://' + httpHostConfig.listenHost + ':' + httpHostConfig.port + httpHostConfig.mcpPath;
    const fields: { label: string; value: string }[] = [{ label: 'URL:', value: url }];
    fields.push(...formatMcpServerVersionFields(generated));
    ${authBlock}
    const upstream = describeUpstreamEnvField(generated, httpHostConfig);
    if (upstream) {
        fields.push(upstream);
    }
    const note = collectMissingEnvNote([
        ${startupBannerConnectionEnvNotePrefix}httpHostConfig.baseUrlEnvKey,
        httpHostConfig.authEnvKey
    ]);
    printMcpHostStartupBanner({
        serverName: requireMcpServerDisplayName(generated),
        transport: '${profile}-http',
        status: note ? 'warning' : 'ready',
        note,
        fields
    });
}`.trim();
}

export function renderOAuthHttpStartupBannerFn(startupBannerConnectionEnvNotePrefix: string): string {
    return `
function printOAuthHttpStartupBanner(
    generated: GeneratedHostModule,
    httpHostConfig: OAuthHttpHostRuntimeConfig
): void {
    const url =
        'http://' + httpHostConfig.listenHost + ':' + httpHostConfig.port + httpHostConfig.mcpPath;
    const fields: { label: string; value: string }[] = [
        { label: 'URL:', value: url },
        { label: 'Auth:', value: 'OAuth Bearer (MCP login)' },
        { label: 'Scope:', value: httpHostConfig.oauthScope },
        { label: 'IdP URL:', value: httpHostConfig.oauthIdpUrl }
    ];
    fields.push(...formatMcpServerVersionFields(generated));
    const upstream = describeUpstreamEnvField(generated, httpHostConfig);
    if (upstream) {
        fields.push(upstream);
    }
    const note = collectMissingEnvNote([${startupBannerConnectionEnvNotePrefix}httpHostConfig.baseUrlEnvKey]);
    printMcpHostStartupBanner({
        serverName: requireMcpServerDisplayName(generated),
        transport: 'oauth-http',
        status: note ? 'warning' : 'ready',
        note,
        fields
    });
}`.trim();
}

export function renderStdioMcpStartupBannerFn(startupBannerConnectionEnvNotePrefix: string): string {
    return `
function printStdioMcpStartupBanner(
    generated: GeneratedHostModule,
    hostConfig: HostRuntimeConfig
): void {
    const fields: { label: string; value: string }[] = [
        { label: 'Transport:', value: 'stdio (stdin/stdout JSON-RPC)' }
    ];
    fields.push(...formatMcpServerVersionFields(generated));
    const upstream = describeUpstreamEnvField(generated, hostConfig);
    if (upstream) {
        fields.push(upstream);
    }
    if (hostConfig.authEnvKey?.trim()) {
        const key = hostConfig.authEnvKey.trim();
        const set = Boolean(process.env[key]?.trim());
        fields.push({
            label: 'Credential:',
            value: '.env ' + key + (set ? '' : ' (unset)')
        });
    }
    const note = collectMissingEnvNote([
        ${startupBannerConnectionEnvNotePrefix}hostConfig.baseUrlEnvKey,
        hostConfig.authEnvKey
    ]);
    printMcpHostStartupBanner({
        serverName: requireMcpServerDisplayName(generated),
        transport: 'stdio',
        status: note ? 'warning' : 'ready',
        note,
        fields
    });
}`.trim();
}
