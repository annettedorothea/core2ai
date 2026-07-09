/** Shared prefix of readGeneratedModule before product-specific tail. */
export function readGeneratedModulePrefixSnippet(): string {
    return `
function readGeneratedModule(imported: Record<string, unknown>): GeneratedHostModule {
    const generatedTools = imported.generatedTools;
    const invokeTool = imported.invokeTool;
    if (!Array.isArray(generatedTools)) {
        throw new Error('Generated module must export "generatedTools" array.');
    }
    if (typeof invokeTool !== 'function') {
        throw new Error('Generated module must export async "invokeTool" function.');
    }
    const inputZodByTool = imported.inputZodByTool;
    const mcpServerName = imported.mcpServerName;
    const mcpServerVersion = imported.mcpServerVersion;
    const mcpBuildGeneratedAt = imported.mcpBuildGeneratedAt;`.trim();
}

export function requireMcpServerIdentitySnippet(): string {
    return `
function requireMcpServerIdentity(generated: GeneratedHostModule): { name: string; version: string } {
    const name = generated.mcpServerName?.trim();
    const version = generated.mcpServerVersion?.trim();
    if (!name) {
        throw new Error('Generated module must export "mcpServerName". Regenerate tool code.');
    }
    if (!version) {
        throw new Error('Generated module must export "mcpServerVersion". Regenerate tool code.');
    }
    return { name, version };
}`.trim();
}

export function formatMcpDisplayVersionSnippet(): string {
    return `
function formatMcpBuildLine(generated: GeneratedHostModule): string | undefined {
    const semver = generated.mcpServerVersion?.trim();
    const buildAt = generated.mcpBuildGeneratedAt?.trim();
    if (semver && buildAt) {
        return semver + ' · ' + buildAt;
    }
    return semver ?? buildAt;
}

function formatMcpDisplayVersion(generated: GeneratedHostModule): string {
    const line = formatMcpBuildLine(generated);
    if (!line) {
        throw new Error('Generated module must export "mcpServerVersion". Regenerate tool code.');
    }
    return line;
}

function formatMcpServerVersionFields(generated: GeneratedHostModule): { label: string; value: string }[] {
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
}`.trim();
}
