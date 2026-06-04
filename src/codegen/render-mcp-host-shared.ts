/**
 * Shared generated MCP host runtime (env loading, host config, tool registration).
 * Included by stdio-mcp-server.ts, stateless-http-mcp-server.ts, and oauth-http-mcp-server.ts.
 */
export function renderMcpHostSharedSource(mode: 'stdio' | 'stateless-http' | 'oauth-http'): string {
    const core = `
const LOCAL_ENV_FILES = ['.env', '.env.local'];

type DatabaseDialect = 'postgres' | 'mysql';

type ApiLikeHostContext = {
    baseUrl?: string;
    connectionString?: string;
    databaseDialect?: DatabaseDialect;
    credential?: string;
    jwt?: Record<string, unknown>;
};

type GeneratedHostModule = {
    generatedTools: Array<{ toolName: string; title?: string; description: string; access?: string }>;
    invokeTool: (
        toolName: string,
        args?: Record<string, unknown>,
        hostContext?: unknown
    ) => Promise<unknown>;
    inputZodByTool?: Record<string, unknown>;
    mcpServerName?: string;
    mcpServerVersion?: string;
    requiresAuth: boolean;
    connectionEnv?: string;
    databaseDialect?: DatabaseDialect;
};

function parseDatabaseDialect(value: unknown): DatabaseDialect | undefined {
    return value === 'postgres' || value === 'mysql' ? value : undefined;
}

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

function isExpectedDatabaseUrl(connectionString: string, dialect: DatabaseDialect): boolean {
    if (dialect === 'mysql') {
        return connectionString.startsWith('mysql://');
    }
    return connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://');
}

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
    const connectionEnv = imported.connectionEnv;
    return {
        generatedTools: generatedTools as Array<{ toolName: string; title?: string; description: string }>,
        invokeTool: invokeTool as (
            toolName: string,
            args?: Record<string, unknown>,
            hostContext?: unknown
        ) => Promise<unknown>,
        inputZodByTool:
            inputZodByTool && typeof inputZodByTool === 'object' && !Array.isArray(inputZodByTool)
                ? (inputZodByTool as Record<string, unknown>)
                : undefined,
        mcpServerName: typeof mcpServerName === 'string' ? mcpServerName : undefined,
        mcpServerVersion: typeof mcpServerVersion === 'string' ? mcpServerVersion : undefined,
        requiresAuth: imported.requiresAuth === true,
        connectionEnv: typeof connectionEnv === 'string' ? connectionEnv : undefined,
        databaseDialect: parseDatabaseDialect(imported.databaseDialect)
    };
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
    options: { envDirs: string[]; resolveContext: () => ApiLikeHostContext }
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
                const hostContext = options.resolveContext();
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

function validateHostAtStartup(hostConfig: HostRuntimeConfig, generated: GeneratedHostModule): void {
    if (generated.connectionEnv) {
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Environment variable "' + generated.connectionEnv + '" is missing or empty (database env from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Environment variable "' +
                    generated.connectionEnv +
                    '" does not match generated database dialect "' +
                    dialect +
                    '".'
            );
        }
    } else {
        const baseUrlKey = hostConfig.baseUrlEnvKey?.trim();
        if (!baseUrlKey) {
            throw new Error('Required: --base-url-env <ENV_VAR_NAME>');
        }
        const baseUrl = process.env[baseUrlKey]?.trim();
        if (!baseUrl) {
            throw new Error(
                'Environment variable "' + baseUrlKey + '" is missing or empty (required by --base-url-env).'
            );
        }
    }
    if (generated.requiresAuth && !hostConfig.authEnvKey?.trim()) {
        throw new Error('Generated tools require auth; pass --auth-env <ENV_VAR_NAME> on the MCP host.');
    }
}

function resolveHostContextForCall(hostConfig: HostRuntimeConfig, generated: GeneratedHostModule): ApiLikeHostContext {
    const credential = readCredentialFromEnv(hostConfig.authEnvKey);
    const { credential: c, jwt } = credentialWithOptionalJwt(credential);
    if (generated.connectionEnv) {
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Missing database URL. Set environment variable "' + generated.connectionEnv + '" (from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Database URL from "' + generated.connectionEnv + '" does not match dialect "' + dialect + '".'
            );
        }
        return { connectionString, databaseDialect: dialect, credential: c, jwt };
    }
    const baseUrlKey = hostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on stdio-mcp-server.js and set the variable.');
    }
    return { baseUrl, credential: c, jwt };
}
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

function validateStatelessHttpHostAtStartup(
    httpHostConfig: StatelessHttpHostRuntimeConfig,
    generated: GeneratedHostModule
): void {
    if (generated.connectionEnv) {
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Environment variable "' + generated.connectionEnv + '" is missing or empty (database env from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Environment variable "' +
                    generated.connectionEnv +
                    '" does not match generated database dialect "' +
                    dialect +
                    '".'
            );
        }
    } else {
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
    }
}

function resolveHostContextForHttpCall(
    httpHostConfig: StatelessHttpHostRuntimeConfig,
    generated: GeneratedHostModule,
    incomingHeaders: Record<string, string | string[] | undefined>
): ApiLikeHostContext {
    const headerName = readAuthHeaderNameFromEnv();
    const credential = readCredentialFromHttpHeaders(incomingHeaders, headerName);
    const { credential: c, jwt } = credentialWithOptionalJwt(credential);
    if (generated.connectionEnv) {
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Missing database URL. Set environment variable "' + generated.connectionEnv + '" (from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Database URL from "' + generated.connectionEnv + '" does not match dialect "' + dialect + '".'
            );
        }
        return { connectionString, databaseDialect: dialect, credential: c, jwt };
    }
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error(
            'Missing host base URL. Pass --base-url-env on stateless-http-mcp-server.js and set the variable.'
        );
    }
    return { baseUrl, credential: c, jwt };
}
`.trim();

    const oauthExtras = `
type OAuthHttpHostRuntimeConfig = {
    baseUrlEnvKey?: string;
    envDirs: string[];
    listenHost: string;
    port: number;
    mcpPath: string;
    oauthIdpUrl: string;
    jwtSecretEnvKey: string;
};

type McpOAuthSession = {
    sessionId: string;
    upstreamCredential?: string;
    createdAt: number;
};

function parseOAuthHttpHostArgv(argv: string[], envDirs: string[]): OAuthHttpHostRuntimeConfig {
    let baseUrlEnv: string | undefined;
    let listenHost = '127.0.0.1';
    let port: number | undefined;
    let mcpPath = '/mcp';
    let oauthIdpUrl: string | undefined;
    let jwtSecretEnvKey: string | undefined;
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
        if (arg === '--jwt-secret-env') {
            jwtSecretEnvKey = argv[++i];
            if (!jwtSecretEnvKey) {
                throw new Error('Missing value after --jwt-secret-env');
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
    if (!jwtSecretEnvKey?.trim()) {
        throw new Error('Required: --jwt-secret-env <ENV_VAR_NAME>');
    }
    return {
        baseUrlEnvKey: baseUrlEnv,
        envDirs,
        listenHost,
        port,
        mcpPath,
        oauthIdpUrl: oauthIdpUrl.replace(/\\/$/, ''),
        jwtSecretEnvKey: jwtSecretEnvKey.trim()
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

function generatedHasPublicTool(generated: GeneratedHostModule): boolean {
    return generated.generatedTools.some((t) => t.access === 'public');
}

function generatedHasProtectedOrCheckedTool(generated: GeneratedHostModule): boolean {
    return generated.generatedTools.some((t) => t.access === 'protected' || t.access === 'checked');
}

function validateOAuthHttpHostAtStartup(httpHostConfig: OAuthHttpHostRuntimeConfig, generated: GeneratedHostModule): void {
    readJwtSecretFromEnv(httpHostConfig.jwtSecretEnvKey);
    if (generated.connectionEnv) {
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Environment variable "' + generated.connectionEnv + '" is missing or empty (database env from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Environment variable "' +
                    generated.connectionEnv +
                    '" does not match generated database dialect "' +
                    dialect +
                    '".'
            );
        }
    } else {
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
    }
}

function resolveHostContextForOAuthSession(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    generated: GeneratedHostModule,
    headers: Record<string, string | string[] | undefined>,
    sessionStore: Map<string, McpOAuthSession>,
    sessionId: string | undefined
): ApiLikeHostContext {
    const secret = readJwtSecretFromEnv(httpHostConfig.jwtSecretEnvKey);
    let credential: string | undefined;
    const bearer = readBearerFromHeaders(headers);
    if (bearer) {
        const verified = verifyAccessTokenJwt(bearer, secret);
        if (verified.ok) {
            credential = bearer;
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
    }
    const { credential: c, jwt } = credentialWithOptionalJwt(credential);
    if (generated.connectionEnv) {
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Missing database URL. Set environment variable "' + generated.connectionEnv + '" (from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Database URL from "' + generated.connectionEnv + '" does not match dialect "' + dialect + '".'
            );
        }
        return { connectionString, databaseDialect: dialect, credential: c, jwt };
    }
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on oauth-http-mcp-server.js and set the variable.');
    }
    return { baseUrl, credential: c, jwt };
}

const MCP_OAUTH_SCOPE = 'mock-api';

function oauthResourceMetadataDocument(httpHostConfig: OAuthHttpHostRuntimeConfig): Record<string, unknown> {
    const resource = 'http://' + httpHostConfig.listenHost + ':' + httpHostConfig.port + httpHostConfig.mcpPath;
    return {
        resource,
        authorization_servers: [httpHostConfig.oauthIdpUrl],
        bearer_methods_supported: ['header'],
        scopes_supported: [MCP_OAUTH_SCOPE]
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
            MCP_OAUTH_SCOPE +
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

    const modeExtras = mode === 'stdio' ? stdioExtras : mode === 'stateless-http' ? httpExtras : oauthExtras;
    return `${core}\n\n${modeExtras}`;
}
