/** Product-neutral credential relay for stdio/passthrough HTTP hosts. */
export function credentialRelaySnippet(): string {
    return `
function resolveRelayHostCredential(
    rawCredential: string | undefined
): { credential?: string } {
    if (!rawCredential?.trim()) {
        return {};
    }
    return { credential: rawCredential.trim() };
}`.trim();
}
