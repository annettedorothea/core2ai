import type { McpHostProduct } from './mcp-host-product-runtime.js';

function warnCredentialValidationBlock(product: McpHostProduct): string {
    const db2aiOpaqueWarn =
        product === 'db2ai'
            ? `
    if (mode === 'opaque' && generated.connectionEnv) {
        loggingAdapter.warn(
            '[mcp] opaque credential validation on db2ai — host is the only auth layer; prefer static or hs256 in production.'
        );
    }`
            : '';
    return `
function generatedHasCheckedTool(generated: GeneratedHostModule): boolean {
    return generated.generatedTools.some((t) => t.access === 'checked');
}

function warnCredentialValidationModeAtStartup(
    generated: GeneratedHostModule,
    mode: HostCredentialValidationMode
): void {
    ${db2aiOpaqueWarn}
    if (mode === 'opaque' && generatedHasCheckedTool(generated)) {
        loggingAdapter.warn(
            '[mcp] opaque mode with checked tools — JWT claims in src/auth are not cryptographically verified.'
        );
    }
}`.trim();
}

function credentialValidationTypesBlock(): string {
    return `
type HostCredentialValidationMode = 'hs256' | 'static' | 'opaque' | 'oidc';

type CredentialValidationFields = {
    credentialValidation?: HostCredentialValidationMode;
    jwtSecretEnvKey?: string;
    authExpectedEnvKey?: string;
};

function parseHostCredentialValidationMode(raw: string | undefined): HostCredentialValidationMode {
    if (raw === 'hs256' || raw === 'static' || raw === 'opaque' || raw === 'oidc') {
        return raw;
    }
    throw new Error('Invalid credential validation mode (expected hs256|static|opaque|oidc): ' + String(raw));
}

function readJwtSecretFromEnv(jwtSecretEnvKey: string): string {
    const value = process.env[jwtSecretEnvKey]?.trim();
    if (!value) {
        throw new Error('Environment variable "' + jwtSecretEnvKey + '" is missing or empty.');
    }
    return value;
}

function verifyAccessTokenJwt(
    token: string,
    secret: string
): { ok: true; payload: Record<string, unknown> } | { ok: false } {
    const parts = token.split('.');
    if (parts.length !== 3) {
        return { ok: false };
    }
    const [headerSeg, payloadSeg, sigSeg] = parts;
    const signingInput = headerSeg + '.' + payloadSeg;
    const expected = crypto.createHmac('sha256', secret).update(signingInput).digest();
    let actual: Buffer;
    try {
        let b64 = sigSeg.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) {
            b64 += '=';
        }
        actual = Buffer.from(b64, 'base64');
    } catch {
        return { ok: false };
    }
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return { ok: false };
    }
    try {
        let b64 = payloadSeg.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) {
            b64 += '=';
        }
        const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
        const now = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === 'number' && payload.exp < now) {
            return { ok: false };
        }
        return { ok: true, payload };
    } catch {
        return { ok: false };
    }
}`.trim();
}

/**
 * Shared types + JWT helpers for OAuth HTTP hosts.
 */
export function hostCredentialValidationOAuthCore(product: McpHostProduct): string {
    return `${credentialValidationTypesBlock()}\n\n${warnCredentialValidationBlock(product)}`;
}

/**
 * Full credential validation for stdio and stateless HTTP hosts.
 */
export function hostCredentialValidationStdioHttpSource(product: McpHostProduct): string {
    return `
${credentialValidationTypesBlock()}

function timingSafeEqualStrings(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
}

${warnCredentialValidationBlock(product)}

function validateStdioOrHttpCredentialValidationAtStartup(
    generated: GeneratedHostModule,
    fields: CredentialValidationFields
): void {
    if (!generated.requiresAuth) {
        return;
    }
    if (!fields.credentialValidation) {
        throw new Error(
            'Generated tools require auth; pass --credential-validation <hs256|static|opaque> on the MCP host.'
        );
    }
    const mode = fields.credentialValidation;
    if (mode === 'oidc') {
        throw new Error('credential validation mode "oidc" is not supported on stdio or stateless HTTP — use OAuth HTTP host.');
    }
    if (mode === 'static') {
        const expectedKey = fields.authExpectedEnvKey?.trim();
        if (!expectedKey) {
            throw new Error('Required for static validation: --auth-expected-env <ENV_VAR_NAME>');
        }
        const expected = process.env[expectedKey]?.trim();
        if (!expected) {
            throw new Error(
                'Environment variable "' + expectedKey + '" is missing or empty (required by --auth-expected-env).'
            );
        }
    }
    if (mode === 'hs256') {
        const secretKey = fields.jwtSecretEnvKey?.trim();
        if (!secretKey) {
            throw new Error('Required for hs256 validation: --jwt-secret-env <ENV_VAR_NAME>');
        }
        readJwtSecretFromEnv(secretKey);
    }
    warnCredentialValidationModeAtStartup(generated, mode);
}

async function verifyHostCredential(
    credential: string,
    fields: CredentialValidationFields
): Promise<{ ok: true; payload?: Record<string, unknown> } | { ok: false }> {
    const trimmed = credential.trim();
    if (!trimmed) {
        return { ok: false };
    }
    const mode = fields.credentialValidation ?? 'opaque';
    if (mode === 'opaque') {
        return { ok: true };
    }
    if (mode === 'static') {
        const expectedKey = fields.authExpectedEnvKey?.trim();
        if (!expectedKey) {
            return { ok: false };
        }
        const expected = process.env[expectedKey]?.trim();
        if (!expected) {
            return { ok: false };
        }
        return timingSafeEqualStrings(trimmed, expected) ? { ok: true } : { ok: false };
    }
    if (mode === 'hs256') {
        const secretKey = fields.jwtSecretEnvKey?.trim();
        if (!secretKey) {
            return { ok: false };
        }
        const secret = readJwtSecretFromEnv(secretKey);
        return verifyAccessTokenJwt(trimmed, secret);
    }
    return { ok: false };
}

async function resolveVerifiedHostCredential(
    rawCredential: string | undefined,
    generated: GeneratedHostModule,
    fields: CredentialValidationFields
): Promise<{ credential?: string; jwt?: Record<string, unknown> }> {
    if (!rawCredential?.trim()) {
        return {};
    }
    if (!generated.requiresAuth || !fields.credentialValidation) {
        return credentialWithOptionalJwt(rawCredential);
    }
    const verified = await verifyHostCredential(rawCredential, fields);
    if (!verified.ok) {
        throw new Error('Invalid host credential (failed ' + fields.credentialValidation + ' validation).');
    }
    const trimmed = rawCredential.trim();
    if (verified.payload) {
        return { credential: trimmed, jwt: verified.payload };
    }
    return credentialWithOptionalJwt(trimmed);
}

function parseCredentialValidationArgvFlags(argv: string[], index: number): {
    nextIndex: number;
    credentialValidation?: HostCredentialValidationMode;
    jwtSecretEnvKey?: string;
    authExpectedEnvKey?: string;
} {
    const arg = argv[index];
    if (arg === '--credential-validation') {
        const raw = argv[index + 1];
        if (!raw) {
            throw new Error('Missing value after --credential-validation');
        }
        return {
            nextIndex: index + 2,
            credentialValidation: parseHostCredentialValidationMode(raw)
        };
    }
    if (arg === '--jwt-secret-env') {
        const raw = argv[index + 1];
        if (!raw) {
            throw new Error('Missing value after --jwt-secret-env');
        }
        return { nextIndex: index + 2, jwtSecretEnvKey: raw };
    }
    if (arg === '--auth-expected-env') {
        const raw = argv[index + 1];
        if (!raw) {
            throw new Error('Missing value after --auth-expected-env');
        }
        return { nextIndex: index + 2, authExpectedEnvKey: raw };
    }
    return { nextIndex: index };
}`.trim();
}

/** @deprecated Use hostCredentialValidationStdioHttpSource or hostCredentialValidationOAuthCore */
export function hostCredentialValidationSource(product: McpHostProduct): string {
    return hostCredentialValidationStdioHttpSource(product);
}

export function oauthCredentialValidationStartupSource(): string {
    return `
function validateOAuthCredentialValidationAtStartup(
    generated: GeneratedHostModule,
    httpHostConfig: OAuthHttpHostRuntimeConfig
): void {
    if (!generated.requiresAuth) {
        return;
    }
    const mode = httpHostConfig.tokenValidation;
    if (mode === 'static') {
        throw new Error('credential validation mode "static" is not supported on OAuth HTTP — use opaque, hs256, or oidc.');
    }
    if (mode === 'hs256') {
        readJwtSecretFromEnv(httpHostConfig.jwtSecretEnvKey!);
    } else if (mode === 'oidc') {
        if (!httpHostConfig.oauthIssuer?.trim()) {
            throw new Error('Required for oidc: --oauth-issuer <url>');
        }
    }
    warnCredentialValidationModeAtStartup(generated, mode);
}`.trim();
}

export function credentialValidationArgvHandler(): string {
    return `
        if (arg === '--credential-validation' || arg === '--jwt-secret-env' || arg === '--auth-expected-env') {
            const parsed = parseCredentialValidationArgvFlags(argv, i);
            if (parsed.credentialValidation !== undefined) {
                credentialValidation = parsed.credentialValidation;
            }
            if (parsed.jwtSecretEnvKey !== undefined) {
                jwtSecretEnvKey = parsed.jwtSecretEnvKey;
            }
            if (parsed.authExpectedEnvKey !== undefined) {
                authExpectedEnvKey = parsed.authExpectedEnvKey;
            }
            i = parsed.nextIndex - 1;
            continue;
        }`.trim();
}
