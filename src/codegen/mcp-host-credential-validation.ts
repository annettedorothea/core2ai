/**
 * Minimal credential helpers for generated MCP hosts.
 * Cryptographic validation belongs in src/hooks (checked tools, verifyCredential).
 */

export function hostCredentialNormalizeSource(): string {
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
