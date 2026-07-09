/** JSON-RPC and HTTP body helpers for generated MCP HTTP hosts. */
export function jsonRpcErrorsSnippet(): string {
    return `
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

/** GET/DELETE without an established session — spec-allowed probe response (HTTP clients verifying connection). */
function writeJsonRpcMethodNotAllowed(res: ServerResponse): void {
    writeJsonRpcError(res, 405, -32_000, 'Method not allowed.');
}`.trim();
}
