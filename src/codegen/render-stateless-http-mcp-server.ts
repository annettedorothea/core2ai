import { renderMcpHostSharedSource } from './render-mcp-host-shared.js';
import { requireBaseUrlEnvArgvCheck, type McpHostProduct } from './mcp-host-product-runtime.js';

/**
 * Static stateless MCP Streamable HTTP host for generated `cli/stateless-http-mcp-server.ts`.
 */
export function renderStatelessHttpMcpServerSource(product: McpHostProduct = 'api2ai'): string {
    const shared = renderMcpHostSharedSource('stateless-http', product);
    return `#!/usr/bin/env node
/**
 * Generated stateless MCP Streamable HTTP host (static runtime — no @core2ai/core).
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as z from 'zod/v4';

${shared}

async function handleStatelessMcpPost(
    req: IncomingMessage,
    res: ServerResponse,
    generated: GeneratedHostModule,
    httpHostConfig: StatelessHttpHostRuntimeConfig
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
        console.error('[mcp] stateless HTTP request failed:', err);
        if (!res.headersSent) {
            writeJsonRpcInternalError(res);
        }
    }
}

async function runStatelessHttpMcpStandaloneFromArgv(argv: string[]): Promise<void> {
    const modulePath = argv[0];
    if (!modulePath) {
        throw new Error(
            'Usage: node stateless-http-mcp-server.js <path-to-*-tools.js> [--base-url-env ENV] --port N [--host HOST] [--path /mcp]'
        );
    }
    const envDirs = [process.cwd(), path.dirname(path.resolve(modulePath))];
    loadLocalEnvFiles(envDirs);
    const imported = await import(pathToFileURL(path.resolve(modulePath)).href);
    if (!imported || typeof imported !== 'object') {
        throw new Error(\`Generated module "\${modulePath}" did not export an object.\`);
    }
    const generated = readGeneratedModule(imported as Record<string, unknown>);
    const httpHostConfig = parseStatelessHttpHostArgv(argv.slice(1), envDirs);
    ${requireBaseUrlEnvArgvCheck(product, 'httpHostConfig.baseUrlEnvKey')}
    validateStatelessHttpHostAtStartup(httpHostConfig, generated);
    const authHeaderName = readAuthHeaderNameFromEnv();
    console.error(
        '[mcp] stateless HTTP on http://' +
            httpHostConfig.listenHost +
            ':' +
            httpHostConfig.port +
            httpHostConfig.mcpPath +
            ' (credential header: ' +
            authHeaderName +
            ')'
    );

    const httpServer = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
        if (url.pathname !== httpHostConfig.mcpPath) {
            res.writeHead(404).end('Not found');
            return;
        }
        if (req.method === 'POST') {
            await handleStatelessMcpPost(req, res, generated, httpHostConfig);
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

await runStatelessHttpMcpStandaloneFromArgv(process.argv.slice(2));
`;
}
