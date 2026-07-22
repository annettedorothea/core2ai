/** Trim a credential string, or omit when empty/missing (stdio / public / passthrough hosts). */
export function normalizeHostCredentialSnippet(): string {
    return `
function normalizeHostCredential(
    rawCredential: string | undefined
): { credential?: string } {
    if (!rawCredential?.trim()) {
        return {};
    }
    return { credential: rawCredential.trim() };
}`.trim();
}
