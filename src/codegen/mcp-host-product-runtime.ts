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
type DatabaseDialect = 'postgres' | 'mysql';

type ApiLikeHostContext = {
    baseUrl?: string;
    connectionString?: string;
    databaseDialect?: DatabaseDialect;
    credential?: string;
    jwt?: Record<string, unknown>;
};

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
};`.trim();
    }
    return `
type ApiLikeHostContext = {
    baseUrl?: string;
    credential?: string;
    jwt?: Record<string, unknown>;
};

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
};`.trim();
}

export function dbOnlyHelperFunctions(product: McpHostProduct): string {
    if (product === 'api2ai') {
        return '';
    }
    return `
function parseDatabaseDialect(value: unknown): DatabaseDialect | undefined {
    return value === 'postgres' || value === 'mysql' ? value : undefined;
}

function isExpectedDatabaseUrl(connectionString: string, dialect: DatabaseDialect): boolean {
    if (dialect === 'mysql') {
        return connectionString.startsWith('mysql://');
    }
    return connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://');
}`.trim();
}

export function readGeneratedModuleTail(product: McpHostProduct): string {
    if (product === 'db2ai') {
        return `
    const connectionEnv = imported.connectionEnv;
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
        databaseDialect: parseDatabaseDialect(imported.databaseDialect)
    };`.trim();
    }
    return `
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
        requiresAuth: imported.requiresAuth === true
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

function dbConnectionResolveReturn(): string {
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
        }
        return { connectionString, databaseDialect: dialect, credential: c, jwt };`;
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
}`.trim();
}

export function resolveHostContextForCallFn(product: McpHostProduct): string {
    const dbBranch =
        product === 'db2ai'
            ? `if (generated.connectionEnv) {${dbConnectionResolveReturn()}
    }`
            : '';
    return `
function resolveHostContextForCall(hostConfig: HostRuntimeConfig, ${generatedModuleParam(product)}: GeneratedHostModule): ApiLikeHostContext {
    const credential = readCredentialFromEnv(hostConfig.authEnvKey);
    const { credential: c, jwt } = credentialWithOptionalJwt(credential);
    ${dbBranch}
    const baseUrlKey = hostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on stdio-mcp-server.js and set the variable.');
    }
    return { baseUrl, credential: c, jwt };
}`.trim();
}

export function validateStatelessHttpHostAtStartupFn(product: McpHostProduct): string {
    const dbBranch =
        product === 'db2ai'
            ? `if (generated.connectionEnv) {${dbConnectionStartupCheck()}
    } else {`
            : '';
    const closeDbBranch = product === 'db2ai' ? `}` : '';
    return `
function validateStatelessHttpHostAtStartup(
    httpHostConfig: StatelessHttpHostRuntimeConfig,
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
}`.trim();
}

export function resolveHostContextForHttpCallFn(product: McpHostProduct): string {
    const dbBranch =
        product === 'db2ai'
            ? `if (generated.connectionEnv) {${dbConnectionResolveReturn()}
    }`
            : '';
    return `
function resolveHostContextForHttpCall(
    httpHostConfig: StatelessHttpHostRuntimeConfig,
    ${generatedModuleParam(product)}: GeneratedHostModule,
    incomingHeaders: Record<string, string | string[] | undefined>
): ApiLikeHostContext {
    const headerName = readAuthHeaderNameFromEnv();
    const credential = readCredentialFromHttpHeaders(incomingHeaders, headerName);
    const { credential: c, jwt } = credentialWithOptionalJwt(credential);
    ${dbBranch}
    const baseUrlKey = httpHostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error(
            'Missing host base URL. Pass --base-url-env on stateless-http-mcp-server.js and set the variable.'
        );
    }
    return { baseUrl, credential: c, jwt };
}`.trim();
}

export function validateOAuthHttpHostAtStartupDbBranch(product: McpHostProduct): string {
    if (product === 'api2ai') {
        return '';
    }
    return `if (generated.connectionEnv) {${dbConnectionStartupCheck()}
    } else {`;
}

export function validateOAuthHttpHostAtStartupDbBranchClose(product: McpHostProduct): string {
    return product === 'db2ai' ? `}` : '';
}

export function resolveHostContextForOAuthSessionDbBranch(product: McpHostProduct): string {
    if (product === 'api2ai') {
        return '';
    }
    return `if (generated.connectionEnv) {${dbConnectionResolveReturn()}
    }`;
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
