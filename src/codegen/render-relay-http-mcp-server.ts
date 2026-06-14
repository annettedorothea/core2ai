import { LOGGING_ADAPTER_IMPORT_FROM_GENERATED } from './logging-adapter-bootstrap.js';
import { renderMcpHostSharedSource, type RelayHttpHostProfile } from './render-mcp-host-shared.js';
import { requireBaseUrlEnvArgvCheck, type McpHostProduct } from './mcp-host-product-runtime.js';

const PROFILE_LOG_LABEL: Record<RelayHttpHostProfile, string> = {
    public: 'public HTTP',
    passthrough: 'passthrough HTTP'
};

const PROFILE_FILE: Record<RelayHttpHostProfile, string> = {
    public: 'public-http-mcp-server',
    passthrough: 'passthrough-http-mcp-server'
};

function renderRelayHttpMcpServerSourceForProfile(
    profile: RelayHttpHostProfile,
    product: McpHostProduct = 'api2ai'
): string {
    const mode = profile === 'public' ? 'public-http' : 'passthrough-http';
    const shared = renderMcpHostSharedSource(mode, product);
    const fileBase = PROFILE_FILE[profile];
    const logLabel = PROFILE_LOG_LABEL[profile];
    return `#!/usr/bin/env node
/**
 * Generated ${logLabel} MCP Streamable HTTP host (static runtime — no @core2ai/core).
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, type ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { loggingAdapter } from '${LOGGING_ADAPTER_IMPORT_FROM_GENERATED}';

type RelayHttpHostProfile = 'public' | 'passthrough';

const RELAY_HTTP_HOST_PROFILE: RelayHttpHostProfile = '${profile}';

${shared}

async function handleRelayHttpMcpPost(
    req: IncomingMessage,
    res: ServerResponse,
    generated: GeneratedHostModule,
    httpHostConfig: RelayHttpHostRuntimeConfig
): Promise<void> {
    const incomingHeaders = req.headers as Record<string, string | string[] | undefined>;
    const { name, version } = requireMcpServerIdentity(generated);
    const server = new McpServer({ name, version });
    await registerMcpTools(server, generated, {
        envDirs: httpHostConfig.envDirs,
        resolveContext: () => resolveHostContextForHttpCall(httpHostConfig, generated, incomingHeaders)
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
        await server.connect(transport);
        const parsedBody = await readMcpHttpJsonBody(req);
        res.on('close', () => {
            void transport.close();
            void server.close();
        });
        await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
        console.error('[mcp] ${logLabel} request failed:', err);
        if (!res.headersSent) {
            writeJsonRpcInternalError(res);
        }
    }
}

async function runRelayHttpMcpStandaloneFromArgv(argv: string[]): Promise<void> {
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
    const httpHostConfig = parseRelayHttpHostArgv(argv.slice(1), envDirs);
    ${requireBaseUrlEnvArgvCheck(product, 'httpHostConfig.baseUrlEnvKey')}
    validateRelayHttpHostAtStartup(httpHostConfig, generated);
    loggingAdapter.info('[mcp] ${logLabel} listening', {
        url:
            'http://' +
            httpHostConfig.listenHost +
            ':' +
            httpHostConfig.port +
            httpHostConfig.mcpPath,
        profile: RELAY_HTTP_HOST_PROFILE,
        credentialHeader:
            RELAY_HTTP_HOST_PROFILE === 'public' ? undefined : readAuthHeaderNameFromEnv()
    });

    const httpServer = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
        if (url.pathname !== httpHostConfig.mcpPath) {
            res.writeHead(404).end('Not found');
            return;
        }
        if (req.method === 'POST') {
            await handleRelayHttpMcpPost(req, res, generated, httpHostConfig);
            return;
        }
        if (req.method === 'GET' || req.method === 'DELETE') {
            writeJsonRpcMethodNotAllowed(res);
            return;
        }
        res.writeHead(405).end('Method not allowed');
    });

    await new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(httpHostConfig.port, httpHostConfig.listenHost, () => resolve());
    });
}

await runRelayHttpMcpStandaloneFromArgv(process.argv.slice(2));
`;
}

export function renderPublicHttpMcpServerSource(product: McpHostProduct = 'api2ai'): string {
    return renderRelayHttpMcpServerSourceForProfile('public', product);
}

export function renderPassthroughHttpMcpServerSource(product: McpHostProduct = 'api2ai'): string {
    return renderRelayHttpMcpServerSourceForProfile('passthrough', product);
}
