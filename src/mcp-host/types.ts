export type DatabaseDialect = 'postgres' | 'mysql' | 'mariadb' | 'sqlserver' | 'oracle';

/** Host context passed into invokeTool. Wider than product-specific ApiHostContext / DbHostContext. */
export type ApiLikeHostContext = {
    baseUrl?: string;
    connectionString?: string;
    databaseDialect?: DatabaseDialect;
    credential?: string;
};

export type VerifyCredentialFn = (credential: string) => void | Promise<void>;

export type TokenExchangeFn = (idpCredential: string) => Promise<string>;

export type GeneratedHostTool = {
    toolName: string;
    title?: string;
    description: string;
    access?: string;
};

export type GeneratedHostModule = {
    generatedTools: GeneratedHostTool[];
    invokeTool: (toolName: string, args?: Record<string, unknown>, hostContext?: unknown) => Promise<unknown>;
    inputZodByTool?: Record<string, unknown>;
    mcpServerName?: string;
    mcpServerVersion?: string;
    mcpBuildGeneratedAt?: string;
    requiresAuth: boolean;
    /** Env var name for a database URL when the tools module uses connection-string upstream (not HTTP baseUrl). */
    connectionEnv?: string;
    databaseDialect?: DatabaseDialect;
    verifyCredential?: VerifyCredentialFn;
    tokenExchange?: TokenExchangeFn;
};

export type HostRuntimeConfig = {
    baseUrlEnvKey?: string;
    authEnvKey?: string;
    iconPath?: string;
    envDirs: string[];
};
