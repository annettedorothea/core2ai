import {
    dbOnlyHelperFunctions,
    hostCoreTypes,
    readGeneratedModuleTail,
    resolveHostContextForCallFn,
    resolveHostContextForHttpCallFn,
    resolveHostContextForOAuthSessionDbBranch,
    generatedModuleParam,
    validateHostAtStartupFn,
    validateOAuthHttpHostAtStartupDbBranch,
    validateOAuthHttpHostAtStartupDbBranchClose,
    validateStatelessHttpHostAtStartupFn,
    type McpHostProduct
} from './mcp-host-product-runtime.js';

export type { McpHostProduct };

/**
 * Shared generated MCP host runtime (env loading, host config, tool registration).
 * Included by stdio-mcp-server.ts, stateless-http-mcp-server.ts, and oauth-http-mcp-server.ts.
 */
export function renderMcpHostSharedSource(
    mode: 'stdio' | 'stateless-http' | 'oauth-http',
    product: McpHostProduct = 'api2ai'
): string {
    const core = `
const LOCAL_ENV_FILES = ['.env', '.env.local'];

${hostCoreTypes(product)}

function stripOptionalQuotes(value: string): string {
    if (value.length < 2) {
        return value;
    }
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return value.slice(1, -1);
    }
    return value;
}

function parseEnvLine(line: string): [string, string] | undefined {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
        return undefined;
    }
    const assignment = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const separator = assignment.indexOf('=');
    if (separator <= 0) {
        return undefined;
    }
    const key = assignment.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        return undefined;
    }
    const value = stripOptionalQuotes(assignment.slice(separator + 1).trim());
    return [key, value];
}

function ancestorDirectories(startDir: string): string[] {
    const directories: string[] = [];
    let current = path.resolve(startDir);
    while (true) {
        directories.unshift(current);
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return directories;
}

function loadLocalEnvFiles(startDirs: string[], options?: { refresh?: boolean }): string[] {
    const refresh = options?.refresh === true;
    const protectedKeys = refresh ? new Set<string>() : new Set(Object.keys(process.env));
    const loadedKeys = new Set<string>();
    const loadedFiles: string[] = [];
    const visitedFiles = new Set<string>();
    for (const startDir of startDirs) {
        for (const directory of ancestorDirectories(startDir)) {
            for (const fileName of LOCAL_ENV_FILES) {
                const filePath = path.join(directory, fileName);
                if (visitedFiles.has(filePath) || !fs.existsSync(filePath)) {
                    continue;
                }
                visitedFiles.add(filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                const overrideExisting = fileName === '.env.local';
                for (const line of content.split(/\\r?\\n/u)) {
                    const parsed = parseEnvLine(line);
                    if (!parsed) {
                        continue;
                    }
                    const [key, value] = parsed;
                    if (overrideExisting || !protectedKeys.has(key) || loadedKeys.has(key)) {
                        process.env[key] = value;
                        loadedKeys.add(key);
                    }
                }
                loadedFiles.push(filePath);
            }
        }
    }
    return loadedFiles;
}

function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> {
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

function credentialWithOptionalJwt(credential: string | undefined): {
    credential?: string;
    jwt?: Record<string, unknown>;
} {
    if (!credential?.trim()) {
        return {};
    }
    const trimmed = credential.trim();
    const segments = trimmed.split('.');
    if (segments.length !== 3) {
        return { credential: trimmed };
    }
    try {
        return { credential: trimmed, jwt: decodeJwtPayloadUnsafe(trimmed) };
    } catch {
        return { credential: trimmed };
    }
}

${dbOnlyHelperFunctions(product)}

function formatToolError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

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
    ${readGeneratedModuleTail(product)}
}

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
}

function requireInputZodSchema(inputZodByTool: Record<string, unknown> | undefined, toolName: string): z.ZodTypeAny {
    if (!inputZodByTool) {
        throw new Error('Generated module must export "inputZodByTool". Regenerate tool code.');
    }
    const schema = inputZodByTool[toolName];
    if (!schema || typeof schema !== 'object') {
        throw new Error(\`Generated module inputZodByTool has no schema for tool "\${toolName}". Regenerate tool code.\`);
    }
    return schema as z.ZodTypeAny;
}

async function registerMcpTools(
    server: McpServer,
    generated: GeneratedHostModule,
    options: { envDirs: string[]; resolveContext: () => ApiLikeHostContext | Promise<ApiLikeHostContext> }
): Promise<void> {
    for (const tool of generated.generatedTools) {
        const inputSchema = requireInputZodSchema(generated.inputZodByTool, tool.toolName);
        server.registerTool(
            tool.toolName,
            {
                title: typeof tool.title === 'string' && tool.title.length > 0 ? tool.title : undefined,
                description: tool.description,
                inputSchema
            },
            async (args) => {
                loadLocalEnvFiles(options.envDirs, { refresh: true });
                const hostContext = await Promise.resolve(options.resolveContext());
                try {
                    const result = await generated.invokeTool(
                        tool.toolName,
                        (args ?? {}) as Record<string, unknown>,
                        hostContext
                    );
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    };
                } catch (err) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: 'text',
                                text: formatToolError(err)
                            }
                        ]
                    };
                }
            }
        );
    }
}
`.trim();

    const stdioExtras = `
type HostRuntimeConfig = {
    baseUrlEnvKey?: string;
    authEnvKey?: string;
    envDirs: string[];
};

function parseHostArgv(argv: string[], envDirs: string[]): HostRuntimeConfig {
    let baseUrlEnv: string | undefined;
    let authEnv: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--base-url-env') {
            baseUrlEnv = argv[++i];
            if (!baseUrlEnv) {
                throw new Error('Missing value after --base-url-env');
            }
            continue;
        }
        if (arg === '--auth-env') {
            authEnv = argv[++i];
            if (!authEnv) {
                throw new Error('Missing value after --auth-env');
            }
            continue;
        }
        if (arg.startsWith('-')) {
            throw new Error('Unknown option: ' + arg);
        }
        throw new Error('Unexpected positional argument: ' + arg);
    }
    return { baseUrlEnvKey: baseUrlEnv, authEnvKey: authEnv, envDirs };
}

function readCredentialFromEnv(authEnvKey: string | undefined): string | undefined {
    const key = authEnvKey?.trim();
    if (!key) {
        return undefined;
    }
    const value = process.env[key]?.trim();
    return value && value.length > 0 ? value : undefined;
}

${validateHostAtStartupFn(product)}

${resolveHostContextForCallFn(product)}
`.trim();

    const httpExtras = `
type StatelessHttpHostRuntimeConfig = {
    baseUrlEnvKey?: string;
    envDirs: string[];
    listenHost: string;
    port: number;
    mcpPath: string;
};

const DEFAULT_MCP_AUTH_HEADER = 'x-api-token';

function parseStatelessHttpHostArgv(argv: string[], envDirs: string[]): StatelessHttpHostRuntimeConfig {
    let baseUrlEnv: string | undefined;
    let listenHost = '127.0.0.1';
    let port: number | undefined;
    let mcpPath = '/mcp';
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--base-url-env') {
            baseUrlEnv = argv[++i];
            if (!baseUrlEnv) {
                throw new Error('Missing value after --base-url-env');
            }
            continue;
        }
        if (arg === '--host') {
            listenHost = argv[++i];
            if (!listenHost) {
                throw new Error('Missing value after --host');
            }
            continue;
        }
        if (arg === '--port') {
            const raw = argv[++i];
            if (!raw) {
                throw new Error('Missing value after --port');
            }
            port = Number.parseInt(raw, 10);
            if (!Number.isFinite(port) || port <= 0) {
                throw new Error('Invalid --port value: ' + raw);
            }
            continue;
        }
        if (arg === '--path') {
            mcpPath = argv[++i];
            if (!mcpPath) {
                throw new Error('Missing value after --path');
            }
            if (!mcpPath.startsWith('/')) {
                mcpPath = '/' + mcpPath;
            }
            continue;
        }
        if (arg.startsWith('-')) {
            throw new Error('Unknown option: ' + arg);
        }
        throw new Error('Unexpected positional argument: ' + arg);
    }
    if (port === undefined) {
        throw new Error('Required: --port <number>');
    }
    return { baseUrlEnvKey: baseUrlEnv, envDirs, listenHost, port, mcpPath };
}

function readAuthHeaderNameFromEnv(): string {
    const configured = process.env.MCP_AUTH_HEADER?.trim();
    return configured && configured.length > 0 ? configured : DEFAULT_MCP_AUTH_HEADER;
}

function readCredentialFromHttpHeaders(
    headers: Record<string, string | string[] | undefined>,
    headerName: string
): string | undefined {
    const normalized = headerName.trim().toLowerCase();
    const raw = headers[normalized];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : undefined;
}

${validateStatelessHttpHostAtStartupFn(product)}

${resolveHostContextForHttpCallFn(product)}
`.trim();

    const oauthExtras = `
type OAuthTokenValidationMode = 'hs256' | 'oidc';

type OAuthHttpHostRuntimeConfig = {
    baseUrlEnvKey?: string;
    envDirs: string[];
    listenHost: string;
    port: number;
    mcpPath: string;
    oauthIdpUrl: string;
    oauthScope: string;
    tokenValidation: OAuthTokenValidationMode;
    jwtSecretEnvKey?: string;
    oauthIssuer: string;
    oauthAudience?: string;
    jwtClaimCustomerId: string;
    jwtClaimRole: string;
};

type McpOAuthSession = {
    sessionId: string;
    upstreamCredential?: string;
    createdAt: number;
};

let oidcJwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let oidcJwksIssuer = '';

function parseOAuthHttpHostArgv(argv: string[], envDirs: string[]): OAuthHttpHostRuntimeConfig {
    let baseUrlEnv: string | undefined;
    let listenHost = '127.0.0.1';
    let port: number | undefined;
    let mcpPath = '/mcp';
    let oauthIdpUrl: string | undefined;
    let jwtSecretEnvKey: string | undefined;
    let tokenValidation: OAuthTokenValidationMode = 'hs256';
    let oauthIssuer: string | undefined;
    let oauthAudience: string | undefined;
    let jwtClaimCustomerId = 'customerId';
    let jwtClaimRole = 'role';
    let oauthScope = 'mcp';
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--base-url-env') {
            baseUrlEnv = argv[++i];
            if (!baseUrlEnv) {
                throw new Error('Missing value after --base-url-env');
            }
            continue;
        }
        if (arg === '--oauth-idp-url') {
            oauthIdpUrl = argv[++i];
            if (!oauthIdpUrl) {
                throw new Error('Missing value after --oauth-idp-url');
            }
            continue;
        }
        if (arg === '--oauth-scope') {
            oauthScope = argv[++i];
            if (!oauthScope?.trim()) {
                throw new Error('Missing value after --oauth-scope');
            }
            continue;
        }
        if (arg === '--oauth-token-validation') {
            const raw = argv[++i];
            if (raw !== 'hs256' && raw !== 'oidc') {
                throw new Error('Invalid --oauth-token-validation (expected hs256 or oidc): ' + raw);
            }
            tokenValidation = raw;
            continue;
        }
        if (arg === '--jwt-secret-env') {
            jwtSecretEnvKey = argv[++i];
            if (!jwtSecretEnvKey) {
                throw new Error('Missing value after --jwt-secret-env');
            }
            continue;
        }
        if (arg === '--oauth-issuer') {
            oauthIssuer = argv[++i];
            if (!oauthIssuer) {
                throw new Error('Missing value after --oauth-issuer');
            }
            continue;
        }
        if (arg === '--oauth-audience') {
            oauthAudience = argv[++i];
            if (!oauthAudience) {
                throw new Error('Missing value after --oauth-audience');
            }
            continue;
        }
        if (arg === '--jwt-claim-customer-id') {
            jwtClaimCustomerId = argv[++i];
            if (!jwtClaimCustomerId) {
                throw new Error('Missing value after --jwt-claim-customer-id');
            }
            continue;
        }
        if (arg === '--jwt-claim-role') {
            jwtClaimRole = argv[++i];
            if (!jwtClaimRole) {
                throw new Error('Missing value after --jwt-claim-role');
            }
            continue;
        }
        if (arg === '--host') {
            listenHost = argv[++i];
            if (!listenHost) {
                throw new Error('Missing value after --host');
            }
            continue;
        }
        if (arg === '--port') {
            const raw = argv[++i];
            if (!raw) {
                throw new Error('Missing value after --port');
            }
            port = Number.parseInt(raw, 10);
            if (!Number.isFinite(port) || port <= 0) {
                throw new Error('Invalid --port value: ' + raw);
            }
            continue;
        }
        if (arg === '--path') {
            mcpPath = argv[++i];
            if (!mcpPath) {
                throw new Error('Missing value after --path');
            }
            if (!mcpPath.startsWith('/')) {
                mcpPath = '/' + mcpPath;
            }
            continue;
        }
        if (arg.startsWith('-')) {
            throw new Error('Unknown option: ' + arg);
        }
        throw new Error('Unexpected positional argument: ' + arg);
    }
    if (port === undefined) {
        throw new Error('Required: --port <number>');
    }
    if (!oauthIdpUrl?.trim()) {
        throw new Error('Required: --oauth-idp-url <url>');
    }
    const idpUrl = oauthIdpUrl.replace(/\\/$/, '');
    const issuer = (oauthIssuer ?? idpUrl).replace(/\\/$/, '');
    if (tokenValidation === 'hs256' && !jwtSecretEnvKey?.trim()) {
        throw new Error('Required for hs256: --jwt-secret-env <ENV_VAR_NAME>');
    }
    return {
        baseUrlEnvKey: baseUrlEnv,
        envDirs,
        listenHost,
        port,
        mcpPath,
        oauthIdpUrl: idpUrl,
        oauthScope: oauthScope.trim(),
        tokenValidation,
        jwtSecretEnvKey: jwtSecretEnvKey?.trim(),
        oauthIssuer: issuer,
        oauthAudience: oauthAudience?.trim(),
        jwtClaimCustomerId: jwtClaimCustomerId.trim(),
        jwtClaimRole: jwtClaimRole.trim()
    };
}

function readJwtSecretFromEnv(jwtSecretEnvKey: string): string {
    const value = process.env[jwtSecretEnvKey]?.trim();
    if (!value) {
        throw new Error('Environment variable "' + jwtSecretEnvKey + '" is missing or empty.');
    }
    return value;
}

function readBearerFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
    const raw = headers.authorization ?? headers.Authorization;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') {
        return undefined;
    }
    const match = /^Bearer\\s+(.+)$/i.exec(value.trim());
    return match?.[1]?.trim() || undefined;
}

function verifyAccessTokenJwt(token: string, secret: string): { ok: true; payload: Record<string, unknown> } | { ok: false } {
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
    if (actual.length !== expected.length || !actual.equals(expected)) {
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
}

async function ensureOidcJwks(issuer: string): Promise<ReturnType<typeof createRemoteJWKSet>> {
    const normalized = issuer.replace(/\\/$/, '');
    if (oidcJwks && oidcJwksIssuer === normalized) {
        return oidcJwks;
    }
    const discoveryUrl = normalized + '/.well-known/openid-configuration';
    const response = await fetch(discoveryUrl);
    if (!response.ok) {
        throw new Error('OIDC discovery failed (' + response.status + '): ' + discoveryUrl);
    }
    const document = (await response.json()) as { jwks_uri?: string };
    const jwksUri = document.jwks_uri;
    if (typeof jwksUri !== 'string' || jwksUri.trim().length === 0) {
        throw new Error('OIDC discovery document missing jwks_uri: ' + discoveryUrl);
    }
    oidcJwks = createRemoteJWKSet(new URL(jwksUri));
    oidcJwksIssuer = normalized;
    return oidcJwks;
}

function normalizeHostJwtClaims(
    payload: Record<string, unknown>,
    httpHostConfig: OAuthHttpHostRuntimeConfig
): Record<string, unknown> {
    const customerRaw = payload[httpHostConfig.jwtClaimCustomerId];
    const roleRaw = payload[httpHostConfig.jwtClaimRole];
    const customerId =
        customerRaw !== undefined && customerRaw !== null ? String(customerRaw).trim() : '';
    const role = roleRaw !== undefined && roleRaw !== null ? String(roleRaw).trim() : '';
    const normalized: Record<string, unknown> = { ...payload };
    if (customerId.length > 0) {
        normalized.customerId = customerId;
    }
    if (role.length > 0) {
        normalized.role = role;
    }
    return normalized;
}

async function verifyOAuthBearerToken(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    token: string
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false }> {
    if (httpHostConfig.tokenValidation === 'hs256') {
        const secret = readJwtSecretFromEnv(httpHostConfig.jwtSecretEnvKey!);
        return verifyAccessTokenJwt(token, secret);
    }
    try {
        const jwks = await ensureOidcJwks(httpHostConfig.oauthIssuer);
        const verifyOptions: { issuer: string; audience?: string } = { issuer: httpHostConfig.oauthIssuer };
        if (httpHostConfig.oauthAudience) {
            verifyOptions.audience = httpHostConfig.oauthAudience;
        }
        const { payload } = await jwtVerify(token, jwks, verifyOptions);
        return { ok: true, payload: payload as Record<string, unknown> };
    } catch {
        return { ok: false };
    }
}

function hostContextFromOAuthCredential(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    credential: string | undefined,
    verifiedPayload: Record<string, unknown> | undefined
): { credential?: string; jwt?: Record<string, unknown> } {
    if (!credential?.trim()) {
        return {};
    }
    const trimmed = credential.trim();
    if (verifiedPayload) {
        return { credential: trimmed, jwt: normalizeHostJwtClaims(verifiedPayload, httpHostConfig) };
    }
    return credentialWithOptionalJwt(trimmed);
}

function generatedHasPublicTool(generated: GeneratedHostModule): boolean {
    return generated.generatedTools.some((t) => t.access === 'public');
}

function generatedHasProtectedOrCheckedTool(generated: GeneratedHostModule): boolean {
    return generated.generatedTools.some((t) => t.access === 'protected' || t.access === 'checked');
}

async function validateOAuthHttpHostAtStartup(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    ${generatedModuleParam(product)}: GeneratedHostModule
): Promise<void> {
    if (httpHostConfig.tokenValidation === 'hs256') {
        readJwtSecretFromEnv(httpHostConfig.jwtSecretEnvKey!);
    } else {
        await ensureOidcJwks(httpHostConfig.oauthIssuer);
    }
    ${validateOAuthHttpHostAtStartupDbBranch(product)}
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    if (!baseUrlKey) {
        throw new Error('Required: --base-url-env <ENV_VAR_NAME>');
    }
    const baseUrl = process.env[baseUrlKey]?.trim();
    if (!baseUrl) {
        throw new Error(
            'Environment variable "' + baseUrlKey + '" is missing or empty (required by --base-url-env).'
        );
    }
    ${validateOAuthHttpHostAtStartupDbBranchClose(product)}
}

async function resolveHostContextForOAuthSession(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    ${generatedModuleParam(product)}: GeneratedHostModule,
    headers: Record<string, string | string[] | undefined>,
    sessionStore: Map<string, McpOAuthSession>,
    sessionId: string | undefined
): Promise<ApiLikeHostContext> {
    let credential: string | undefined;
    let verifiedPayload: Record<string, unknown> | undefined;
    const bearer = readBearerFromHeaders(headers);
    if (bearer) {
        const verified = await verifyOAuthBearerToken(httpHostConfig, bearer);
        if (verified.ok) {
            credential = bearer;
            verifiedPayload = verified.payload;
            if (sessionId) {
                const existing = sessionStore.get(sessionId);
                if (existing) {
                    existing.upstreamCredential = bearer;
                } else {
                    sessionStore.set(sessionId, {
                        sessionId,
                        upstreamCredential: bearer,
                        createdAt: Date.now()
                    });
                }
            }
        }
    }
    if (!credential && sessionId) {
        credential = sessionStore.get(sessionId)?.upstreamCredential;
        if (credential) {
            const cached = await verifyOAuthBearerToken(httpHostConfig, credential);
            if (cached.ok) {
                verifiedPayload = cached.payload;
            } else {
                credential = undefined;
            }
        }
    }
    const { credential: c, jwt } = hostContextFromOAuthCredential(httpHostConfig, credential, verifiedPayload);
    ${resolveHostContextForOAuthSessionDbBranch(product)}
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on oauth-http-mcp-server.js and set the variable.');
    }
    return { baseUrl, credential: c, jwt };
}

function oauthResourceMetadataDocument(httpHostConfig: OAuthHttpHostRuntimeConfig): Record<string, unknown> {
    const resource = 'http://' + httpHostConfig.listenHost + ':' + httpHostConfig.port + httpHostConfig.mcpPath;
    return {
        resource,
        authorization_servers: [httpHostConfig.oauthIdpUrl],
        bearer_methods_supported: ['header'],
        scopes_supported: [httpHostConfig.oauthScope]
    };
}

function sendOAuthUnauthorized(res: ServerResponse, httpHostConfig: OAuthHttpHostRuntimeConfig): void {
    const resource = 'http://' + httpHostConfig.listenHost + ':' + httpHostConfig.port + httpHostConfig.mcpPath;
    const metadataUrl =
        'http://' + httpHostConfig.listenHost + ':' + httpHostConfig.port + '/.well-known/oauth-protected-resource';
    res.writeHead(401, {
        'content-type': 'application/json',
        'www-authenticate':
            'Bearer error="invalid_token", realm="mcp", resource_metadata="' +
            metadataUrl +
            '", resource="' +
            resource +
            '", scope="' +
            httpHostConfig.oauthScope +
            '"'
    });
    res.end(
        JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32_001, message: 'Unauthorized' },
            id: null
        })
    );
}
`.trim();

    const httpTransportExtras = `
async function readMcpHttpJsonBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length === 0) {
        return undefined;
    }
    const text = Buffer.concat(chunks).toString('utf-8');
    if (text.trim().length === 0) {
        return undefined;
    }
    return JSON.parse(text) as unknown;
}

function writeJsonRpcError(res: ServerResponse, status: number, code: number, message: string): void {
    if (res.headersSent) {
        return;
    }
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(
        JSON.stringify({
            jsonrpc: '2.0',
            error: { code, message },
            id: null
        })
    );
}

function writeJsonRpcInternalError(res: ServerResponse): void {
    writeJsonRpcError(res, 500, -32_603, 'Internal server error');
}
`.trim();

    const httpTransportStatelessOnly =
        mode === 'stateless-http'
            ? `
function writeJsonRpcMethodNotAllowed(res: ServerResponse): void {
    writeJsonRpcError(res, 405, -32_000, 'Method not allowed.');
}
`.trim()
            : '';

    const modeExtras = mode === 'stdio' ? stdioExtras : mode === 'stateless-http' ? httpExtras : oauthExtras;
    const usesHttpTransport = mode === 'stateless-http' || mode === 'oauth-http';
    if (usesHttpTransport) {
        const httpBlock = httpTransportStatelessOnly
            ? `${httpTransportExtras}\n\n${httpTransportStatelessOnly}`
            : httpTransportExtras;
        return `${core}\n\n${httpBlock}\n\n${modeExtras}`;
    }
    return `${core}\n\n${modeExtras}`;
}
