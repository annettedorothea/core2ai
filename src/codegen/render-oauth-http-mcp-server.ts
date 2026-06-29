import { renderMcpHostSharedSource } from './render-mcp-host-shared.js';
import { requireBaseUrlEnvArgvCheck, type McpHostProduct } from './mcp-host-product-runtime.js';

/**
 * Static OAuth + stateful MCP Streamable HTTP host for generated `cli/oauth-http-mcp-server.ts`.
 */
export function renderOAuthHttpMcpServerSource(product: McpHostProduct = 'api2ai', loggingImport: string): string {
    const shared = renderMcpHostSharedSource('oauth-http', product);
    return `#!/usr/bin/env node
/**
 * Generated OAuth + stateful MCP Streamable HTTP host (static runtime — no @core2ai/core).
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, type ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { loggingAdapter } from '${loggingImport}';

${shared}

type SessionEntry = {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
    session: McpOAuthSession;
};

const sessionEntries = new Map<string, SessionEntry>();
const sessionStore = new Map<string, McpOAuthSession>();
const sessionHeaders = new Map<string, Record<string, string | string[] | undefined>>();

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
    const { name, version } = requireMcpServerIdentity(generated);
    const server = new McpServer({ name, version });
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
        // Transport already closed — see public/passthrough HTTP host (avoid server.close loop).
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
        const verified = await verifyCredentialForGate(generated, bearer);
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

async function runOAuthHttpMcpStandaloneFromArgv(argv: string[]): Promise<void> {
    const modulePath = argv[0];
    if (!modulePath) {
        throw new Error(
            'Usage: node oauth-http-mcp-server.js <path-to-*-tools.js> [--base-url-env ENV] --oauth-idp-url URL --port N [--oauth-scope SCOPE] [--host HOST] [--path /mcp]'
        );
    }
    const envDirs = [process.cwd(), path.dirname(path.resolve(modulePath))];
    loadLocalEnvFiles(envDirs);
    const imported = await import(pathToFileURL(path.resolve(modulePath)).href);
    if (!imported || typeof imported !== 'object') {
        throw new Error(\`Generated module "\${modulePath}" did not export an object.\`);
    }
    const generated = readGeneratedModule(imported as Record<string, unknown>);
    const httpHostConfig = parseOAuthHttpHostArgv(argv.slice(1), envDirs);
    ${requireBaseUrlEnvArgvCheck(product, 'httpHostConfig.baseUrlEnvKey')}
    await validateOAuthHttpHostAtStartup(httpHostConfig, generated);
    const resourceUrl =
        'http://' + httpHostConfig.listenHost + ':' + httpHostConfig.port + httpHostConfig.mcpPath;
    loggingAdapter.info('[mcp] oauth HTTP listening', {
        resourceUrl,
        authorizationServer: httpHostConfig.oauthIdpUrl,
        oauthOnInitialize: mcpRequiresBearerOnInitialize(generated)
            ? 'Bearer required (protected tools — Cursor login when enabling MCP' +
              (generatedHasPublicTool(generated) ? '; public tools after login' : '') +
              ')'
            : 'no Bearer required (only public tools)'
    });

    const httpServer = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
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
        httpServer.listen(httpHostConfig.port, httpHostConfig.listenHost, () => resolve());
    });
}

await runOAuthHttpMcpStandaloneFromArgv(process.argv.slice(2));
`;
}
