/**
 * JWT helpers for generated MCP host adapters (decode only — no signature verification).
 */

export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> {
    const parts = String(token).trim().split('.');
    if (parts.length !== 3) {
        throw new Error('credential is not a JWT (expected three dot-separated segments).');
    }
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
        b64 += '=';
    }
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
}

export function resolveCredentialFromEnv(authEnvKey: string | undefined): string | undefined {
    const key = authEnvKey?.trim();
    if (!key) {
        return undefined;
    }
    const value = process.env[key]?.trim();
    return value && value.length > 0 ? value : undefined;
}

export function resolveCredentialAndOptionalJwt(authEnvKey: string | undefined): {
    credential?: string;
    jwt?: Record<string, unknown>;
} {
    const credential = resolveCredentialFromEnv(authEnvKey);
    if (!credential) {
        return {};
    }
    const segments = String(credential).trim().split('.');
    if (segments.length !== 3) {
        return { credential };
    }
    try {
        return { credential, jwt: decodeJwtPayloadUnsafe(credential) };
    } catch {
        return { credential };
    }
}
