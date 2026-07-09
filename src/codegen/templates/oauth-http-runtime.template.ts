import { compose } from '../compose.js';

const OAUTH_HTTP_RUNTIME_SKELETON = `/**
 * Generated OAuth + stateful MCP Streamable HTTP runtime (static tools import).
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, type ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { loggingAdapter } from '<<loggingImport>>';

<<sharedHost>>

type SessionEntry = {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
    session: McpOAuthSession;
};

const sessionEntries = new Map<string, SessionEntry>();
const sessionStore = new Map<string, McpOAuthSession>();
const sessionHeaders = new Map<string, Record<string, string | string[] | undefined>>();

function defaultMcpEnvDirs(): string[] {
    const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
    return [process.cwd(), path.join(runtimeDir, '..', 'tools')];
}

function isInitializeRequestBody(body: unknown): boolean {
    if (Array.isArray(body)) {
        return body.some((item) => isInitializeRequestBody(item));
    }
    if (!body || typeof body !== 'object') {
        return false;
    }
    const record = body as Record<string, unknown>;
    return record.jsonrpc === '2.0' && record.method === 'initialize';
}

function mcpRequiresBearerOnInitialize(generated: GeneratedHostModule): boolean {
    return generated.requiresAuth && generatedHasProtectedTool(generated);
}

function readSessionId(req: IncomingMessage): string | undefined {
    const raw = req.headers['mcp-session-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function createMcpServerForSession(
    generated: GeneratedHostModule,
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    sessionId: string,
    headers: Record<string, string | string[] | undefined>
): Promise<SessionEntry> {
    const { name } = requireMcpServerIdentity(generated);
    const server = new McpServer({ name, version: formatMcpDisplayVersion(generated) });
    const session: McpOAuthSession = {
        sessionId,
        createdAt: Date.now()
    };
    sessionStore.set(sessionId, session);
    await registerMcpTools(server, generated, {
        envDirs: httpHostConfig.envDirs,
        resolveContext: async () => {
            const hdr = sessionHeaders.get(sessionId) ?? headers;
            return await resolveHostContextForOAuthSession(httpHostConfig, generated, hdr, sessionStore, sessionId);
        }
    });
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
        onsessioninitialized: (sid) => {
            session.sessionId = sid;
        }
    });
    transport.onclose = () => {
        sessionEntries.delete(sessionId);
        sessionStore.delete(sessionId);
        sessionHeaders.delete(sessionId);
    };
    await server.connect(transport);
    return { transport, server, session };
}

async function handleOAuthMcpRequest(
    req: IncomingMessage,
    res: ServerResponse,
    generated: GeneratedHostModule,
    httpHostConfig: OAuthHttpHostRuntimeConfig
): Promise<void> {
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const sessionIdHeader = readSessionId(req);
    const parsedBody = req.method === 'POST' ? await readMcpHttpJsonBody(req) : undefined;

    if (mcpRequiresBearerOnInitialize(generated)) {
        const bearer = readBearerFromHeaders(headers);
        const sessionForGate = sessionIdHeader ? sessionStore.get(sessionIdHeader) : undefined;
        const verified = await verifyCredentialForGate(generated, bearer, sessionForGate);
        if (!verified) {
            if (!sessionIdHeader && isInitializeRequestBody(parsedBody)) {
                sendOAuthUnauthorized(res, httpHostConfig);
                return;
            }
            if (sessionIdHeader && !sessionEntries.has(sessionIdHeader)) {
                sendOAuthUnauthorized(res, httpHostConfig);
                return;
            }
        }
    }

    let entry: SessionEntry | undefined;
    if (sessionIdHeader && sessionEntries.has(sessionIdHeader)) {
        entry = sessionEntries.get(sessionIdHeader);
    } else if (req.method === 'POST' && isInitializeRequestBody(parsedBody)) {
        const newSessionId = randomUUID();
        entry = await createMcpServerForSession(generated, httpHostConfig, newSessionId, headers);
        sessionEntries.set(newSessionId, entry);
    } else if (sessionIdHeader) {
        writeJsonRpcError(res, 404, -32_001, 'Session not found');
        return;
    } else if (req.method === 'POST') {
        writeJsonRpcError(res, 400, -32_000, 'Bad Request: Session ID required');
        return;
    } else {
        writeJsonRpcMethodNotAllowed(res);
        return;
    }

    if (!entry) {
        writeJsonRpcInternalError(res);
        return;
    }

    const activeSessionId = entry.session.sessionId;
    sessionHeaders.set(activeSessionId, headers);

    try {
        await entry.transport.handleRequest(req, res, parsedBody);
    } catch (err) {
        loggingAdapter.error('[mcp] oauth HTTP request failed', {
            error: err instanceof Error ? err.message : String(err)
        });
        if (!res.headersSent) {
            writeJsonRpcInternalError(res);
        }
    }
}

async function listenOAuthHttpMcp(
    generated: GeneratedHostModule,
    httpHostConfig: OAuthHttpHostRuntimeConfig
): Promise<void> {
    const httpServer = http.createServer(async (req, res) => {
        applyMcpHttpCors(req, res);
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
        if (
            (url.pathname === '/.well-known/oauth-authorization-server' ||
                url.pathname === '/.well-known/openid-configuration') &&
            req.method === 'GET'
        ) {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(oauthAuthorizationServerMetadataDocument(httpHostConfig)));
            return;
        }
        if (url.pathname === '/.well-known/oauth-protected-resource') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(oauthResourceMetadataDocument(httpHostConfig)));
            return;
        }
        if (url.pathname === '/oauth/login') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            res.end(
                '<!doctype html><html><body><h1>MCP OAuth</h1><p>Use Cursor MCP &quot;Needs login&quot; for PKCE OAuth, or open the IDP authorize URL from MCP logs.</p><p>IDP: ' +
                    httpHostConfig.oauthIdpUrl +
                    '/authorize</p></body></html>'
            );
            return;
        }
        if (url.pathname !== httpHostConfig.mcpPath) {
            res.writeHead(404).end('Not found');
            return;
        }
        if (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE') {
            await handleOAuthMcpRequest(req, res, generated, httpHostConfig);
            return;
        }
        res.writeHead(405).end('Method not allowed');
    });

    await new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(httpHostConfig.port, httpHostConfig.listenHost, () => {
            printOAuthHttpStartupBanner(generated, httpHostConfig);
            resolve();
        });
    });
}

export async function runOAuthHttpMcp(
    toolsModule: Record<string, unknown>,
    argv: string[],
    envDirs: string[] = defaultMcpEnvDirs()
): Promise<void> {
    loadLocalEnvFiles(envDirs);
    const generated = readGeneratedModule(toolsModule);
    const httpHostConfig = parseOAuthHttpHostArgv(argv, envDirs);
    <<requireBaseUrlEnvArgvCheck>>
    await validateOAuthHttpHostAtStartup(httpHostConfig, generated);
    await listenOAuthHttpMcp(generated, httpHostConfig);
}
`;

export type OAuthHttpRuntimeTemplateSlots = {
    loggingImport: string;
    sharedHost: string;
    requireBaseUrlEnvArgvCheck: string;
};

export function renderOAuthHttpRuntimeTemplate(slots: OAuthHttpRuntimeTemplateSlots): string {
    return compose(OAUTH_HTTP_RUNTIME_SKELETON, slots);
}
