/** Trim a credential string, or omit when empty/missing. */
export function normalizeHostCredential(rawCredential: string | undefined): { credential?: string } {
    if (!rawCredential?.trim()) {
        return {};
    }
    return { credential: rawCredential.trim() };
}
