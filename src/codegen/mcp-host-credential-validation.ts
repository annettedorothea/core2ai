/**
 * Minimal relay credential helpers for generated MCP hosts.
 * Cryptographic validation belongs in src/auth (checked tools, verifyCredential).
 */

export function hostCredentialValidationRelaySource(): string {
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
