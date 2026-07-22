import type { GeneratedHostModule } from './types.js';

export function requireMcpServerIdentity(generated: GeneratedHostModule): { name: string; version: string } {
    const name = generated.mcpServerName?.trim();
    const version = generated.mcpServerVersion?.trim();
    if (!name) {
        throw new Error('Generated module must export "mcpServerName". Regenerate tool code.');
    }
    if (!version) {
        throw new Error('Generated module must export "mcpServerVersion". Regenerate tool code.');
    }
    return { name, version };
}

export function formatMcpBuildLine(generated: GeneratedHostModule): string | undefined {
    const semver = generated.mcpServerVersion?.trim();
    const buildAt = generated.mcpBuildGeneratedAt?.trim();
    if (semver && buildAt) {
        return semver + ' · ' + buildAt;
    }
    return semver ?? buildAt;
}

export function formatMcpDisplayVersion(generated: GeneratedHostModule): string {
    const line = formatMcpBuildLine(generated);
    if (!line) {
        throw new Error('Generated module must export "mcpServerVersion". Regenerate tool code.');
    }
    return line;
}

export function formatMcpServerVersionFields(generated: GeneratedHostModule): { label: string; value: string }[] {
    const semver = generated.mcpServerVersion?.trim();
    const buildAt = generated.mcpBuildGeneratedAt?.trim();
    const fields: { label: string; value: string }[] = [];
    if (semver) {
        fields.push({ label: 'Version:', value: semver });
    }
    if (buildAt) {
        fields.push({ label: 'Build:', value: buildAt });
    }
    return fields;
}
