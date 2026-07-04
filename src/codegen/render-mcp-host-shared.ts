import { hostCredentialValidationRelaySource } from './mcp-host-credential-validation.js';
import {
    dbOnlyHelperFunctions,
    hostCoreTypes,
    readGeneratedModuleTail,
    resolveHostContextForCallFn,
    resolveHostContextForHttpCallFn,
    withDbConnectionHostContextFn,
    oauthHostContextBaseUrlFieldsFn,
    generatedModuleParam,
    validateHostAtStartupFn,
    validateOAuthHttpHostAtStartupFn,
    validateHttpMcpHostAtStartupFn,
    type McpHostProduct,
    type HttpMcpHostProfile
} from './mcp-host-product-runtime.js';

export type { McpHostProduct, HttpMcpHostProfile };

export type McpHostSharedMode = 'stdio' | 'public-http' | 'passthrough-http' | 'oauth-http';

function httpMcpProfileForMode(mode: McpHostSharedMode): HttpMcpHostProfile {
    if (mode === 'public-http') {
        return 'public';
    }
    return 'passthrough';
}

/**
 * Shared generated MCP host runtime (env loading, host config, tool registration).
 */
export function renderMcpHostSharedSource(mode: McpHostSharedMode, product: McpHostProduct = 'api2ai'): string {
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

${dbOnlyHelperFunctions(product)}

${mode === 'oauth-http' ? '' : hostCredentialValidationRelaySource()}

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

/** Log when the MCP client requests tools/list (wraps SDK handler set by registerTool). */
function attachListToolsDebugLogging(mcpServer: McpServer, generated: GeneratedHostModule): void {
    type ListToolsHandler = (request: unknown, extra: unknown) => Promise<ListToolsResult>;
    const handlers = (mcpServer.server as unknown as { _requestHandlers: Map<string, ListToolsHandler> })._requestHandlers;
    const previous = handlers.get('tools/list');
    if (!previous) {
        return;
    }
    mcpServer.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
        loggingAdapter.debug('listTools', {
            toolCount: generated.generatedTools.length,
            toolNames: generated.generatedTools.map((t) => t.toolName)
        });
        return previous(request, extra);
    });
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
    attachListToolsDebugLogging(server, generated);
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
    return {
        baseUrlEnvKey: baseUrlEnv,
        authEnvKey: authEnv,
        envDirs
    };
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

    const httpMcpProfile = httpMcpProfileForMode(mode === 'public-http' ? mode : 'passthrough-http');
    const httpExtras = `
type HttpMcpHostRuntimeConfig = {
    baseUrlEnvKey?: string;
    authEnvKey?: string;
    envDirs: string[];
    listenHost: string;
    port: number;
    mcpPath: string;
};

function parseHttpMcpHostArgv(argv: string[], envDirs: string[]): HttpMcpHostRuntimeConfig {
    let baseUrlEnv: string | undefined;
    let authEnv: string | undefined;
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
        if (arg === '--auth-env') {
            authEnv = argv[++i];
            if (!authEnv) {
                throw new Error('Missing value after --auth-env');
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
    return {
        baseUrlEnvKey: baseUrlEnv,
        authEnvKey: authEnv,
        envDirs,
        listenHost,
        port,
        mcpPath
    };
}

${
    httpMcpProfile === 'public'
        ? ''
        : `function readCredentialFromEnv(authEnvKey: string | undefined): string | undefined {
    const key = authEnvKey?.trim();
    if (!key) {
        return undefined;
    }
    const value = process.env[key]?.trim();
    return value && value.length > 0 ? value : undefined;
}

const DEFAULT_MCP_AUTH_HEADER = 'x-api-token';

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
`
}

${validateHttpMcpHostAtStartupFn(product)}

${resolveHostContextForHttpCallFn(product, httpMcpProfile)}
`.trim();

    const oauthExtras = `
type OAuthHttpHostRuntimeConfig = {
    baseUrlEnvKey?: string;
    envDirs: string[];
    listenHost: string;
    port: number;
    mcpPath: string;
    oauthIdpUrl: string;
    oauthScope: string;
};

type McpOAuthSession = {
    sessionId: string;
    credential?: string;
    verifiedAt?: number;
    createdAt: number;
};

function parseOAuthHttpHostArgv(argv: string[], envDirs: string[]): OAuthHttpHostRuntimeConfig {
    let baseUrlEnv: string | undefined;
    let listenHost = '127.0.0.1';
    let port: number | undefined;
    let mcpPath = '/mcp';
    let oauthIdpUrl: string | undefined;
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
    return {
        baseUrlEnvKey: baseUrlEnv,
        envDirs,
        listenHost,
        port,
        mcpPath,
        oauthIdpUrl: oauthIdpUrl.replace(/\\/$/, ''),
        oauthScope: oauthScope.trim()
    };
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

function generatedHasPublicTool(generated: GeneratedHostModule): boolean {
    return generated.generatedTools.some((t) => t.access === 'public');
}

function generatedHasProtectedTool(generated: GeneratedHostModule): boolean {
    return generated.generatedTools.some((t) => t.access === 'protected');
}

${validateOAuthHttpHostAtStartupFn(product)}

function resolveOAuthHostBaseUrl(httpHostConfig: OAuthHttpHostRuntimeConfig): string {
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on oauth-http-mcp-server.js and set the variable.');
    }
    return baseUrl;
}

${oauthHostContextBaseUrlFieldsFn(product)}

${withDbConnectionHostContextFn(product)}

async function verifyCredentialForGate(
    generated: GeneratedHostModule,
    bearer: string | undefined
): Promise<boolean> {
    const token = bearer?.trim();
    if (!token) {
        return false;
    }
    if (!generated.requiresAuth) {
        return true;
    }
    const verify = generated.verifyCredential;
    if (typeof verify !== 'function') {
        return true;
    }
    try {
        await verify(token);
        return true;
    } catch {
        return false;
    }
}

async function resolveHostContextForOAuthSession(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    ${generatedModuleParam(product)}: GeneratedHostModule,
    headers: Record<string, string | string[] | undefined>,
    sessionStore: Map<string, McpOAuthSession>,
    sessionId: string | undefined
): Promise<ApiLikeHostContext> {
    const apiFields = oauthHostContextBaseUrlFields(httpHostConfig, ${generatedModuleParam(product)});
    let session = sessionId ? sessionStore.get(sessionId) : undefined;
    if (sessionId && !session) {
        session = { sessionId, createdAt: Date.now() };
        sessionStore.set(sessionId, session);
    }

    if (session?.verifiedAt && session.credential) {
        return withDbConnectionHostContext(${generatedModuleParam(product)}, {
            ...apiFields,
            credential: session.credential
        });
    }

    const bearer = readBearerFromHeaders(headers);
    const inbound = bearer?.trim();
    if (!inbound) {
        if (session?.credential) {
            return withDbConnectionHostContext(${generatedModuleParam(product)}, {
                ...apiFields,
                credential: session.credential
            });
        }
        return withDbConnectionHostContext(${generatedModuleParam(product)}, { ...apiFields });
    }

    const verify = ${generatedModuleParam(product)}.verifyCredential;
    if (typeof verify === 'function') {
        await verify(inbound);
    }
    if (session) {
        session.credential = inbound;
        session.verifiedAt = Date.now();
    }

    return withDbConnectionHostContext(${generatedModuleParam(product)}, {
        ...apiFields,
        credential: inbound
    });
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

/** GET/DELETE without an established session — spec-allowed probe response (Open WebUI Verify Connection). */
function writeJsonRpcMethodNotAllowed(res: ServerResponse): void {
    writeJsonRpcError(res, 405, -32_000, 'Method not allowed.');
}
`.trim();

    const httpMcpModes: McpHostSharedMode[] = ['public-http', 'passthrough-http'];
    const modeExtras = mode === 'stdio' ? stdioExtras : httpMcpModes.includes(mode) ? httpExtras : oauthExtras;
    const usesHttpTransport = httpMcpModes.includes(mode) || mode === 'oauth-http';
    if (usesHttpTransport) {
        return `${core}\n\n${httpTransportExtras}\n\n${modeExtras}`;
    }
    return `${core}\n\n${modeExtras}`;
}
