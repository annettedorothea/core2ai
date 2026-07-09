/** Browser CORS for oauth HTTP host. */
export function httpCorsSnippet(): string {
    return `
/**
 * Browser CORS for oauth HTTP host. Set MCP_HTTP_CORS_ORIGIN for a fixed origin; otherwise reflect Origin when present.
 */
function applyMcpHttpCors(req: IncomingMessage, res: ServerResponse, env: NodeJS.ProcessEnv = process.env): void {
    const configured = env.MCP_HTTP_CORS_ORIGIN?.trim();
    if (configured) {
        res.setHeader('Access-Control-Allow-Origin', configured);
    } else {
        const origin = req.headers.origin;
        if (typeof origin === 'string' && origin.length > 0) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, mcp-session-id');
}`.trim();
}

export function sendOAuthUnauthorizedSnippet(): string {
    return `
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
}`.trim();
}
