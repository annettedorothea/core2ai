/**
 * Product-specific fragments for generated MCP host runtimes (api2ai vs db2ai).
 */
export type McpHostProduct = 'api2ai' | 'db2ai';

/** Parameter name when GeneratedHostModule is required only for db2ai branches (api2ai → eslint _ prefix). */
export function generatedModuleParam(product: McpHostProduct): string {
    return product === 'api2ai' ? '_generated' : 'generated';
}

export function hostCoreTypes(product: McpHostProduct): string {
    if (product === 'db2ai') {
        return `
type DatabaseDialect = 'postgres' | 'mysql' | 'mariadb' | 'sqlserver' | 'oracle';

type ApiLikeHostContext = {
    baseUrl?: string;
    connectionString?: string;
    databaseDialect?: DatabaseDialect;
    credential?: string;
    sessionClaims?: Record<string, unknown>;
};

type VerifyCredentialInput = {
    inboundCredential: string;
};

type VerifyCredentialResult = {
    upstreamCredential: string;
    sessionClaims?: Record<string, unknown>;
};

type VerifyCredentialFn = (input: VerifyCredentialInput) => Promise<VerifyCredentialResult>;

type GeneratedHostModule = {
    generatedTools: Array<{ toolName: string; title?: string; description: string; access?: string }>;
    invokeTool: (
        toolName: string,
        args?: Record<string, unknown>,
        hostContext?: unknown
    ) => Promise<unknown>;
    inputZodByTool?: Record<string, unknown>;
    mcpServerName?: string;
    mcpServerVersion?: string;
    requiresAuth: boolean;
    connectionEnv?: string;
    databaseDialect?: DatabaseDialect;
    verifyCredential?: VerifyCredentialFn;
};`.trim();
    }
    return `
type ApiLikeHostContext = {
    baseUrl?: string;
    credential?: string;
    sessionClaims?: Record<string, unknown>;
};

type VerifyCredentialInput = {
    inboundCredential: string;
};

type VerifyCredentialResult = {
    upstreamCredential: string;
    sessionClaims?: Record<string, unknown>;
};

type VerifyCredentialFn = (input: VerifyCredentialInput) => Promise<VerifyCredentialResult>;

type GeneratedHostModule = {
    generatedTools: Array<{ toolName: string; title?: string; description: string; access?: string }>;
    invokeTool: (
        toolName: string,
        args?: Record<string, unknown>,
        hostContext?: unknown
    ) => Promise<unknown>;
    inputZodByTool?: Record<string, unknown>;
    mcpServerName?: string;
    mcpServerVersion?: string;
    requiresAuth: boolean;
    verifyCredential?: VerifyCredentialFn;
};`.trim();
}

export function dbOnlyHelperFunctions(product: McpHostProduct): string {
    if (product === 'api2ai') {
        return '';
    }
    return `
function parseDatabaseDialect(value: unknown): DatabaseDialect | undefined {
    return value === 'postgres' || value === 'mysql' || value === 'mariadb' || value === 'sqlserver' || value === 'oracle'
        ? value
        : undefined;
}

function isExpectedDatabaseUrl(connectionString: string, dialect: DatabaseDialect): boolean {
    if (dialect === 'mysql') {
        return connectionString.startsWith('mysql://');
    }
    if (dialect === 'mariadb') {
        return connectionString.startsWith('mariadb://');
    }
    if (dialect === 'sqlserver') {
        return (
            connectionString.startsWith('sqlserver://') ||
            connectionString.startsWith('mssql://') ||
            /^Server=/i.test(connectionString)
        );
    }
    if (dialect === 'oracle') {
        return connectionString.startsWith('oracle://');
    }
    return connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://');
}`.trim();
}

function readVerifyCredentialExports(): string {
    return `
    const verifyCredential = imported.verifyCredential;
    const verifyCredentialFn =
        typeof verifyCredential === 'function' ? (verifyCredential as VerifyCredentialFn) : undefined;`.trim();
}

export function readGeneratedModuleTail(product: McpHostProduct): string {
    if (product === 'db2ai') {
        return `
    const connectionEnv = imported.connectionEnv;
    ${readVerifyCredentialExports()}
    return {
        generatedTools: generatedTools as Array<{ toolName: string; title?: string; description: string }>,
        invokeTool: invokeTool as (
            toolName: string,
            args?: Record<string, unknown>,
            hostContext?: unknown
        ) => Promise<unknown>,
        inputZodByTool:
            inputZodByTool && typeof inputZodByTool === 'object' && !Array.isArray(inputZodByTool)
                ? (inputZodByTool as Record<string, unknown>)
                : undefined,
        mcpServerName: typeof mcpServerName === 'string' ? mcpServerName : undefined,
        mcpServerVersion: typeof mcpServerVersion === 'string' ? mcpServerVersion : undefined,
        requiresAuth: imported.requiresAuth === true,
        connectionEnv: typeof connectionEnv === 'string' ? connectionEnv : undefined,
        databaseDialect: parseDatabaseDialect(imported.databaseDialect),
        verifyCredential: verifyCredentialFn
    };`.trim();
    }
    return `
    ${readVerifyCredentialExports()}
    return {
        generatedTools: generatedTools as Array<{ toolName: string; title?: string; description: string }>,
        invokeTool: invokeTool as (
            toolName: string,
            args?: Record<string, unknown>,
            hostContext?: unknown
        ) => Promise<unknown>,
        inputZodByTool:
            inputZodByTool && typeof inputZodByTool === 'object' && !Array.isArray(inputZodByTool)
                ? (inputZodByTool as Record<string, unknown>)
                : undefined,
        mcpServerName: typeof mcpServerName === 'string' ? mcpServerName : undefined,
        mcpServerVersion: typeof mcpServerVersion === 'string' ? mcpServerVersion : undefined,
        requiresAuth: imported.requiresAuth === true,
        verifyCredential: verifyCredentialFn
    };`.trim();
}

function dbConnectionStartupCheck(): string {
    return `
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Environment variable "' + generated.connectionEnv + '" is missing or empty (database env from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Environment variable "' +
                    generated.connectionEnv +
                    '" does not match generated database dialect "' +
                    dialect +
                    '".'
            );
        }`;
}

function dbConnectionEnvValidationBlock(): string {
    return `
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Missing database URL. Set environment variable "' + generated.connectionEnv + '" (from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Database URL from "' + generated.connectionEnv + '" does not match dialect "' + dialect + '".'
            );
        }`;
}

function dbConnectionResolveReturn(): string {
    return `${dbConnectionEnvValidationBlock()}
        return { connectionString, databaseDialect: dialect, credential: c };`;
}

function dbConnectionResolveReturnForOAuth(): string {
    return `${dbConnectionEnvValidationBlock()}
        return { connectionString, databaseDialect: dialect, credential: upstreamCredential, sessionClaims };`;
}

export function withDbConnectionHostContextFn(product: McpHostProduct): string {
    if (product !== 'db2ai') {
        return `
function withDbConnectionHostContext(
    _generated: GeneratedHostModule,
    context: ApiLikeHostContext
): ApiLikeHostContext {
    return context;
}`.trim();
    }
    return `
function withDbConnectionHostContext(
    generated: GeneratedHostModule,
    context: ApiLikeHostContext
): ApiLikeHostContext {
    if (!generated.connectionEnv) {
        return context;
    }${dbConnectionEnvValidationBlock()}
    return { ...context, connectionString, databaseDialect: dialect };
}`.trim();
}

export function validateHostAtStartupFn(product: McpHostProduct): string {
    const dbBranch =
        product === 'db2ai'
            ? `if (generated.connectionEnv) {${dbConnectionStartupCheck()}
    } else {`
            : '';
    const closeDbBranch = product === 'db2ai' ? `}` : '';
    return `
function validateHostAtStartup(hostConfig: HostRuntimeConfig, generated: GeneratedHostModule): void {
    ${dbBranch}
    const baseUrlKey = hostConfig.baseUrlEnvKey?.trim();
    if (!baseUrlKey) {
        throw new Error('Required: --base-url-env <ENV_VAR_NAME>');
    }
    const baseUrl = process.env[baseUrlKey]?.trim();
    if (!baseUrl) {
        throw new Error(
            'Environment variable "' + baseUrlKey + '" is missing or empty (required by --base-url-env).'
        );
    }
    ${closeDbBranch}
    if (generated.requiresAuth && !hostConfig.authEnvKey?.trim()) {
        throw new Error('Generated tools require auth; pass --auth-env <ENV_VAR_NAME> on the MCP host.');
    }
    if (generated.requiresAuth && typeof generated.verifyCredential !== 'function') {
        throw new Error(
            'Generated tools require auth; implement verifyCredential in src/auth/${product}/<module>/verifyCredential.ts and re-export from generated tools.'
        );
    }
}`.trim();
}

export function resolveHostContextForCallFn(product: McpHostProduct): string {
    const dbBranch =
        product === 'db2ai'
            ? `if (generated.connectionEnv) {
        ${dbConnectionResolveReturn()}
    }`
            : '';
    return `
async function resolveHostContextForCall(
    hostConfig: HostRuntimeConfig,
    ${generatedModuleParam(product)}: GeneratedHostModule
): Promise<ApiLikeHostContext> {
    const credential = readCredentialFromEnv(hostConfig.authEnvKey);
    const { credential: c } = resolveRelayHostCredential(credential);
    ${dbBranch}
    const baseUrlKey = hostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on stdio-mcp-server.js and set the variable.');
    }
    return { baseUrl, credential: c };
}`.trim();
}

export function validateHttpMcpHostAtStartupFn(product: McpHostProduct): string {
    const dbBranch =
        product === 'db2ai'
            ? `if (generated.connectionEnv) {${dbConnectionStartupCheck()}
    } else {`
            : '';
    const closeDbBranch = product === 'db2ai' ? `}` : '';
    return `
function validateHttpMcpHostAtStartup(
    httpHostConfig: HttpMcpHostRuntimeConfig,
    ${generatedModuleParam(product)}: GeneratedHostModule
): void {
    ${dbBranch}
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    if (!baseUrlKey) {
        throw new Error('Required: --base-url-env <ENV_VAR_NAME>');
    }
    const baseUrl = process.env[baseUrlKey]?.trim();
    if (!baseUrl) {
        throw new Error(
            'Environment variable "' + baseUrlKey + '" is missing or empty (required by --base-url-env).'
        );
    }
    ${closeDbBranch}
    if (${generatedModuleParam(product)}.requiresAuth && typeof ${generatedModuleParam(product)}.verifyCredential !== 'function') {
        throw new Error(
            'Generated tools require auth; implement verifyCredential in src/auth/${product}/<module>/verifyCredential.ts and re-export from generated tools.'
        );
    }
}`.trim();
}

export function resolveHostContextForHttpCallFn(product: McpHostProduct, httpMcpProfile: HttpMcpHostProfile): string {
    const readCredential =
        httpMcpProfile === 'public'
            ? `const credential = undefined;`
            : `const headerName = readAuthHeaderNameFromEnv();
    const credential = readCredentialFromHttpHeaders(incomingHeaders, headerName);`;
    const dbBranch =
        product === 'db2ai'
            ? `if (generated.connectionEnv) {
        ${dbConnectionResolveReturn()}
    }`
            : '';
    return `
async function resolveHostContextForHttpCall(
    httpHostConfig: HttpMcpHostRuntimeConfig,
    ${generatedModuleParam(product)}: GeneratedHostModule,
    ${httpMcpProfile === 'public' ? '_incomingHeaders' : 'incomingHeaders'}: Record<string, string | string[] | undefined>
): Promise<ApiLikeHostContext> {
    ${readCredential}
    const { credential: c } = resolveRelayHostCredential(credential);
    ${dbBranch}
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error(
            'Missing host base URL. Pass --base-url-env on HTTP MCP host and set the variable.'
        );
    }
    return { baseUrl, credential: c };
}`.trim();
}

export type HttpMcpHostProfile = 'public' | 'passthrough';

export function validateOAuthHttpHostAtStartupFn(product: McpHostProduct): string {
    const dbBranch =
        product === 'db2ai'
            ? `if (generated.connectionEnv) {${dbConnectionStartupCheck()}
    } else {`
            : '';
    const closeDbBranch = product === 'db2ai' ? `}` : '';
    return `
async function validateOAuthHttpHostAtStartup(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    ${generatedModuleParam(product)}: GeneratedHostModule
): Promise<void> {
    if (${generatedModuleParam(product)}.requiresAuth && typeof ${generatedModuleParam(product)}.verifyCredential !== 'function') {
        throw new Error(
            'Generated tools require auth; implement verifyCredential in src/auth/${product}/<module>/verifyCredential.ts and re-export from generated tools.'
        );
    }
    ${dbBranch}
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    if (!baseUrlKey) {
        throw new Error('Required: --base-url-env <ENV_VAR_NAME>');
    }
    const baseUrl = process.env[baseUrlKey]?.trim();
    if (!baseUrl) {
        throw new Error(
            'Environment variable "' + baseUrlKey + '" is missing or empty (required by --base-url-env).'
        );
    }
    ${closeDbBranch}
}`.trim();
}

export function resolveHostContextForOAuthSessionDbBranch(product: McpHostProduct): string {
    if (product === 'api2ai') {
        return '';
    }
    return `if (generated.connectionEnv) {${dbConnectionResolveReturnForOAuth()}
    }`;
}

/** Skip baseUrl for db2ai modules that export connectionEnv (.db2ai SQL tools). */
export function oauthHostContextBaseUrlFieldsFn(product: McpHostProduct): string {
    const generatedParam = generatedModuleParam(product);
    if (product === 'db2ai') {
        return `
function oauthHostContextBaseUrlFields(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    ${generatedParam}: GeneratedHostModule
): Pick<ApiLikeHostContext, 'baseUrl'> {
    if (${generatedParam}.connectionEnv) {
        return {};
    }
    return { baseUrl: resolveOAuthHostBaseUrl(httpHostConfig) };
}`.trim();
    }
    return `
function oauthHostContextBaseUrlFields(
    httpHostConfig: OAuthHttpHostRuntimeConfig,
    _generated: GeneratedHostModule
): Pick<ApiLikeHostContext, 'baseUrl'> {
    return { baseUrl: resolveOAuthHostBaseUrl(httpHostConfig) };
}`.trim();
}

export function requireBaseUrlEnvArgvCheck(product: McpHostProduct, hostConfigExpr: string): string {
    if (product === 'db2ai') {
        return `if (!generated.connectionEnv && !${hostConfigExpr}) {
        throw new Error(
            'Required: --base-url-env <ENV_VAR_NAME> for HTTP/OpenAPI tools, or export connectionEnv from a .db2ai module.'
        );
    }`;
    }
    return `if (!${hostConfigExpr}) {
        throw new Error('Required: --base-url-env <ENV_VAR_NAME>');
    }`;
}

/** @deprecated use validateHttpMcpHostAtStartupFn */
export function validateStatelessHttpHostAtStartupFn(product: McpHostProduct): string {
    return validateHttpMcpHostAtStartupFn(product);
}
