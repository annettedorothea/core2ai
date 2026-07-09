import {
    credentialRelaySnippet,
    envLoadingFunctionsSnippet,
    formatToolErrorSnippet,
    httpCorsSnippet,
    jsonRpcErrorsSnippet,
    localEnvFilesConstSnippet,
    oauthSessionCredentialSnippet,
    readGeneratedModulePrefixSnippet,
    registerMcpToolsSnippet,
    requireMcpServerIdentitySnippet,
    formatMcpDisplayVersionSnippet,
    sendOAuthUnauthorizedSnippet
} from '../snippets/index.js';
import {
    renderHttpMcpStartupBannerFn,
    renderMcpHostStartupBannerSource,
    renderOAuthHttpStartupBannerFn,
    renderStdioMcpStartupBannerFn
} from '../render-mcp-host-startup-banner.js';
import type { McpHostSharedFragmentSet } from './mcp-host-shared-fragments.js';

export type McpHostSharedMode = 'stdio' | 'public-http' | 'passthrough-http' | 'oauth-http';

type HttpMcpHostProfile = 'public' | 'passthrough';

function httpMcpProfileForMode(mode: McpHostSharedMode): HttpMcpHostProfile {
    if (mode === 'public-http') {
        return 'public';
    }
    return 'passthrough';
}

/** Shared generated MCP host runtime (env loading, host config, tool registration). */
export function renderMcpHostSharedTemplate(mode: McpHostSharedMode, fragments: McpHostSharedFragmentSet): string {
    const core = `
${localEnvFilesConstSnippet()}

${fragments.hostCoreTypes}

${envLoadingFunctionsSnippet()}${fragments.envLoadingToCredentialGap}
${mode === 'oauth-http' ? '' : credentialRelaySnippet()}

${formatToolErrorSnippet()}

${readGeneratedModulePrefixSnippet()}
    ${fragments.readGeneratedModuleTail}
}

${requireMcpServerIdentitySnippet()}

${formatMcpDisplayVersionSnippet()}

${registerMcpToolsSnippet()}

${renderMcpHostStartupBannerSource(fragments.describeUpstreamEnvField)}
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

${fragments.validateHostAtStartup}

${fragments.resolveHostContextForCall}

${renderStdioMcpStartupBannerFn(fragments.startupBannerConnectionEnvNotePrefix)}
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

${fragments.validateHttpMcpHostAtStartup}

${httpMcpProfile === 'public' ? fragments.resolveHostContextForHttpCallPublic : fragments.resolveHostContextForHttpCallPassthrough}

${renderHttpMcpStartupBannerFn(httpMcpProfile, fragments.startupBannerConnectionEnvNotePrefix)}
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
    sourceCredential?: string;
    verifiedAt?: number;
    exchangedAt?: number;
    createdAt: number;
};

/** IdP Bearer → portal/API credential (shared by gate + session resolver). */
const oauthCredentialByInbound = new Map<string, string>();

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

function generatedHasProtectedTool(generated: GeneratedHostModule): boolean {
    return generated.generatedTools.some((t) => t.access === 'protected');
}

${fragments.validateOAuthHttpHostAtStartup}

function resolveOAuthHostBaseUrl(httpHostConfig: OAuthHttpHostRuntimeConfig): string {
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on oauth-http-mcp-server.js and set the variable.');
    }
    return baseUrl;
}

${fragments.oauthHostContextBaseUrlFields}

${oauthSessionCredentialSnippet()}

${fragments.resolveHostContextForOAuthSession}

function oauthResourceMetadataDocument(httpHostConfig: OAuthHttpHostRuntimeConfig): Record<string, unknown> {
    const resource = 'http://' + httpHostConfig.listenHost + ':' + httpHostConfig.port + httpHostConfig.mcpPath;
    return {
        resource,
        authorization_servers: [httpHostConfig.oauthIdpUrl],
        bearer_methods_supported: ['header'],
        scopes_supported: [httpHostConfig.oauthScope]
    };
}

/** Browser clients discover OAuth metadata from the MCP host origin — endpoints must point at the real IdP. */
function oauthAuthorizationServerMetadataDocument(httpHostConfig: OAuthHttpHostRuntimeConfig): Record<string, unknown> {
    const idp = httpHostConfig.oauthIdpUrl;
    return {
        issuer: idp,
        authorization_endpoint: idp + '/authorize',
        token_endpoint: idp + '/token',
        jwks_uri: idp + '/jwks',
        registration_endpoint: idp + '/register',
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        scopes_supported: [httpHostConfig.oauthScope]
    };
}

${httpCorsSnippet()}

${sendOAuthUnauthorizedSnippet()}

${renderOAuthHttpStartupBannerFn(fragments.startupBannerConnectionEnvNotePrefix)}
`.trim();

    const httpTransportExtras = jsonRpcErrorsSnippet();
    const httpMcpModes: McpHostSharedMode[] = ['public-http', 'passthrough-http'];
    const modeExtras = mode === 'stdio' ? stdioExtras : httpMcpModes.includes(mode) ? httpExtras : oauthExtras;
    const usesHttpTransport = httpMcpModes.includes(mode) || mode === 'oauth-http';
    if (usesHttpTransport) {
        return `${core}\n\n${httpTransportExtras}\n\n${modeExtras}`;
    }
    return `${core}\n\n${modeExtras}`;
}
