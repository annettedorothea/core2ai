import { renderMcpHostSharedSource, type HttpMcpHostProfile } from './render-mcp-host-shared.js';
import { requireBaseUrlEnvArgvCheck, type McpHostProduct } from './mcp-host-product-runtime.js';

const PROFILE_LOG_LABEL: Record<HttpMcpHostProfile, string> = {
    public: 'public HTTP',
    passthrough: 'passthrough HTTP'
};

const PROFILE_FILE: Record<HttpMcpHostProfile, string> = {
    public: 'public-http-mcp-server',
    passthrough: 'passthrough-http-mcp-server'
};

function renderHttpMcpServerSourceForProfile(
    profile: HttpMcpHostProfile,
    product: McpHostProduct = 'api2ai',
    loggingImport: string
): string {
    const mode = profile === 'public' ? 'public-http' : 'passthrough-http';
    const shared = renderMcpHostSharedSource(mode, product);
    const fileBase = PROFILE_FILE[profile];
    const logLabel = PROFILE_LOG_LABEL[profile];
    const credentialHeaderExpr = profile === 'public' ? 'undefined' : 'readAuthHeaderNameFromEnv()';
    return `#!/usr/bin/env node
/**
 * Generated ${logLabel} MCP Streamable HTTP host (static runtime — no @core2ai/core).
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
    sessionId: string;
};

const sessionEntries = new Map<string, SessionEntry>();
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

function readSessionId(req: IncomingMessage): string | undefined {
    const raw = req.headers['mcp-session-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function createMcpServerForSession(
    generated: GeneratedHostModule,
    httpHostConfig: HttpMcpHostRuntimeConfig,
    sessionId: string,
    headers: Record<string, string | string[] | undefined>
): Promise<SessionEntry> {
    const { name, version } = requireMcpServerIdentity(generated);
    const server = new McpServer({ name, version });
    sessionHeaders.set(sessionId, headers);
    await registerMcpTools(server, generated, {
        envDirs: httpHostConfig.envDirs,
        resolveContext: () =>
            resolveHostContextForHttpCall(
                httpHostConfig,
                generated,
                sessionHeaders.get(sessionId) ?? headers
            )
    });
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId
    });
    transport.onclose = () => {
        sessionEntries.delete(sessionId);
        sessionHeaders.delete(sessionId);
        // Transport already closed (onclose runs from transport.close). Do not call server.close()
        // here — that re-enters transport.close() and overflows the stack.
    };
    await server.connect(transport);
    return { transport, server, sessionId };
}

async function handleHttpMcpRequest(
    req: IncomingMessage,
    res: ServerResponse,
    generated: GeneratedHostModule,
    httpHostConfig: HttpMcpHostRuntimeConfig
): Promise<void> {
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const sessionIdHeader = readSessionId(req);
    const parsedBody = req.method === 'POST' ? await readMcpHttpJsonBody(req) : undefined;

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

    sessionHeaders.set(entry.sessionId, headers);

    try {
        await entry.transport.handleRequest(req, res, parsedBody);
    } catch (err) {
        loggingAdapter.error('[mcp] ${logLabel} request failed', {
            error: err instanceof Error ? err.message : String(err)
        });
        if (!res.headersSent) {
            writeJsonRpcInternalError(res);
        }
    }
}

async function runHttpMcpStandaloneFromArgv(argv: string[]): Promise<void> {
    const modulePath = argv[0];
    if (!modulePath) {
        throw new Error(
            'Usage: node ${fileBase}.js <path-to-*-tools.js> [--base-url-env ENV] --port N [--host HOST] [--path /mcp]'
        );
    }
    const envDirs = [process.cwd(), path.dirname(path.resolve(modulePath))];
    loadLocalEnvFiles(envDirs);
    const imported = await import(pathToFileURL(path.resolve(modulePath)).href);
    if (!imported || typeof imported !== 'object') {
        throw new Error(\`Generated module "\${modulePath}" did not export an object.\`);
    }
    const generated = readGeneratedModule(imported as Record<string, unknown>);
    const httpHostConfig = parseHttpMcpHostArgv(argv.slice(1), envDirs);
    ${requireBaseUrlEnvArgvCheck(product, 'httpHostConfig.baseUrlEnvKey')}
    validateHttpMcpHostAtStartup(httpHostConfig, generated);
    loggingAdapter.info('[mcp] ${logLabel} listening', {
        url:
            'http://' +
            httpHostConfig.listenHost +
            ':' +
            httpHostConfig.port +
            httpHostConfig.mcpPath,
        profile: '${profile}',
        credentialHeader: ${credentialHeaderExpr}
    });

    const httpServer = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
        if (url.pathname !== httpHostConfig.mcpPath) {
            res.writeHead(404).end('Not found');
            return;
        }
        if (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE') {
            await handleHttpMcpRequest(req, res, generated, httpHostConfig);
            return;
        }
        res.writeHead(405).end('Method not allowed');
    });

    await new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(httpHostConfig.port, httpHostConfig.listenHost, () => resolve());
    });
}

await runHttpMcpStandaloneFromArgv(process.argv.slice(2));
`;
}

export function renderPublicHttpMcpServerSource(product: McpHostProduct = 'api2ai', loggingImport: string): string {
    return renderHttpMcpServerSourceForProfile('public', product, loggingImport);
}

export function renderPassthroughHttpMcpServerSource(
    product: McpHostProduct = 'api2ai',
    loggingImport: string
): string {
    return renderHttpMcpServerSourceForProfile('passthrough', product, loggingImport);
}
