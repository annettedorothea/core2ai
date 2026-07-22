import { loggingAdapter } from '../logging/index.js';
import { describeUpstreamEnvField } from './host-context.js';
import { formatMcpServerVersionFields, requireMcpServerIdentity } from './identity.js';
import type { GeneratedHostModule, HostRuntimeConfig } from './types.js';

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
    const lines = ['', '  ┌─ ' + options.serverName + ' (' + options.transport + ') ' + glyph + ' ' + status + ' ─'];
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

function collectMissingEnvNote(keys: (string | undefined)[]): string | undefined {
    const missing = keys
        .filter((key): key is string => Boolean(key?.trim()))
        .filter((key) => !process.env[key]?.trim());
    if (missing.length === 0) {
        return undefined;
    }
    return missing.join(', ') + ' unset — tool calls may fail until set in .env';
}

function requireMcpServerDisplayName(generated: GeneratedHostModule): string {
    const { name } = requireMcpServerIdentity(generated);
    return name;
}

export function printStdioMcpStartupBanner(generated: GeneratedHostModule, hostConfig: HostRuntimeConfig): void {
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
    const note = collectMissingEnvNote([generated.connectionEnv, hostConfig.baseUrlEnvKey, hostConfig.authEnvKey]);
    printMcpHostStartupBanner({
        serverName: requireMcpServerDisplayName(generated),
        transport: 'stdio',
        status: note ? 'warning' : 'ready',
        note,
        fields
    });
}
