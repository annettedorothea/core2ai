import { renderMcpHostSharedSource, type HttpMcpHostProfile } from './render-mcp-host-shared.js';
import { requireBaseUrlEnvArgvCheck, type McpHostProduct } from './mcp-host-product-runtime.js';

const PROFILE_LOG_LABEL: Record<HttpMcpHostProfile, string> = {
    public: 'public HTTP',
    passthrough: 'passthrough HTTP'
};

const PROFILE_RUN_EXPORT: Record<HttpMcpHostProfile, string> = {
    public: 'runPublicHttpMcp',
    passthrough: 'runPassthroughHttpMcp'
};

function renderHttpMcpRuntimeSourceForProfile(
    profile: HttpMcpHostProfile,
    product: McpHostProduct = 'api2ai',
    loggingImport: string
): string {
    const mode = profile === 'public' ? 'public-http' : 'passthrough-http';
    const shared = renderMcpHostSharedSource(mode, product);
    const logLabel = PROFILE_LOG_LABEL[profile];
    const runExport = PROFILE_RUN_EXPORT[profile];
    return `/**
 * Generated ${logLabel} MCP Streamable HTTP runtime (static tools import).
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
import { loggingAdapter } from '${loggingImport}';

${shared}

type SessionEntry = {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
    sessionId: string;
};

const sessionEntries = new Map<string, SessionEntry>();
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

async function listenHttpMcp(
    generated: GeneratedHostModule,
    httpHostConfig: HttpMcpHostRuntimeConfig
): Promise<void> {
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
        httpServer.listen(httpHostConfig.port, httpHostConfig.listenHost, () => {
            printHttpMcpStartupBanner(generated, httpHostConfig);
            resolve();
        });
    });
}

export async function ${runExport}(
    toolsModule: Record<string, unknown>,
    argv: string[],
    envDirs: string[] = defaultMcpEnvDirs()
): Promise<void> {
    loadLocalEnvFiles(envDirs);
    const generated = readGeneratedModule(toolsModule);
    const httpHostConfig = parseHttpMcpHostArgv(argv, envDirs);
    ${requireBaseUrlEnvArgvCheck(product, 'httpHostConfig.baseUrlEnvKey')}
    validateHttpMcpHostAtStartup(httpHostConfig, generated);
    await listenHttpMcp(generated, httpHostConfig);
}
`;
}

export function renderPublicHttpMcpRuntimeSource(product: McpHostProduct = 'api2ai', loggingImport: string): string {
    return renderHttpMcpRuntimeSourceForProfile('public', product, loggingImport);
}

export function renderPassthroughHttpMcpRuntimeSource(
    product: McpHostProduct = 'api2ai',
    loggingImport: string
): string {
    return renderHttpMcpRuntimeSourceForProfile('passthrough', product, loggingImport);
}
