/**
 * Shared generated MCP host runtime (env loading, host config, tool registration).
 * Included by stdio-mcp-server.ts (and http-mcp-server.ts in Phase 2).
 */
export function renderMcpHostSharedSource(): string {
    return `
const LOCAL_ENV_FILES = ['.env', '.env.local'];

type HostRuntimeConfig = {
    baseUrlEnvKey?: string;
    authEnvKey?: string;
    envDirs: string[];
};

type DatabaseDialect = 'postgres' | 'mysql';

type ApiLikeHostContext = {
    baseUrl?: string;
    connectionString?: string;
    databaseDialect?: DatabaseDialect;
    credential?: string;
    jwt?: Record<string, unknown>;
};

type GeneratedHostModule = {
    generatedTools: Array<{ toolName: string; title?: string; description: string }>;
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
};

function parseDatabaseDialect(value: unknown): DatabaseDialect | undefined {
    return value === 'postgres' || value === 'mysql' ? value : undefined;
}

function stripOptionalQuotes(value: string): string {
    if (value.length < 2) {
        return value;
    }
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return value.slice(1, -1);
    }
    return value;
}

function parseEnvLine(line: string): [string, string] | undefined {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
        return undefined;
    }
    const assignment = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const separator = assignment.indexOf('=');
    if (separator <= 0) {
        return undefined;
    }
    const key = assignment.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        return undefined;
    }
    const value = stripOptionalQuotes(assignment.slice(separator + 1).trim());
    return [key, value];
}

function ancestorDirectories(startDir: string): string[] {
    const directories: string[] = [];
    let current = path.resolve(startDir);
    while (true) {
        directories.unshift(current);
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return directories;
}

function loadLocalEnvFiles(startDirs: string[], options?: { refresh?: boolean }): string[] {
    const refresh = options?.refresh === true;
    const protectedKeys = refresh ? new Set<string>() : new Set(Object.keys(process.env));
    const loadedKeys = new Set<string>();
    const loadedFiles: string[] = [];
    const visitedFiles = new Set<string>();
    for (const startDir of startDirs) {
        for (const directory of ancestorDirectories(startDir)) {
            for (const fileName of LOCAL_ENV_FILES) {
                const filePath = path.join(directory, fileName);
                if (visitedFiles.has(filePath) || !fs.existsSync(filePath)) {
                    continue;
                }
                visitedFiles.add(filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                const overrideExisting = fileName === '.env.local';
                for (const line of content.split(/\\r?\\n/u)) {
                    const parsed = parseEnvLine(line);
                    if (!parsed) {
                        continue;
                    }
                    const [key, value] = parsed;
                    if (overrideExisting || !protectedKeys.has(key) || loadedKeys.has(key)) {
                        process.env[key] = value;
                        loadedKeys.add(key);
                    }
                }
                loadedFiles.push(filePath);
            }
        }
    }
    return loadedFiles;
}

function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> {
    const parts = String(token).trim().split('.');
    if (parts.length !== 3) {
        throw new Error('credential is not a JWT (expected three dot-separated segments).');
    }
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
        b64 += '=';
    }
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
}

function credentialWithOptionalJwt(credential: string | undefined): {
    credential?: string;
    jwt?: Record<string, unknown>;
} {
    if (!credential?.trim()) {
        return {};
    }
    const trimmed = credential.trim();
    const segments = trimmed.split('.');
    if (segments.length !== 3) {
        return { credential: trimmed };
    }
    try {
        return { credential: trimmed, jwt: decodeJwtPayloadUnsafe(trimmed) };
    } catch {
        return { credential: trimmed };
    }
}

function readCredentialFromEnv(authEnvKey: string | undefined): string | undefined {
    const key = authEnvKey?.trim();
    if (!key) {
        return undefined;
    }
    const value = process.env[key]?.trim();
    return value && value.length > 0 ? value : undefined;
}

function isExpectedDatabaseUrl(connectionString: string, dialect: DatabaseDialect): boolean {
    if (dialect === 'mysql') {
        return connectionString.startsWith('mysql://');
    }
    return connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://');
}

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
    return { baseUrlEnvKey: baseUrlEnv, authEnvKey: authEnv, envDirs };
}

function validateHostAtStartup(hostConfig: HostRuntimeConfig, generated: GeneratedHostModule): void {
    if (generated.connectionEnv) {
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
        }
    } else {
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
    }
    if (generated.requiresAuth && !hostConfig.authEnvKey?.trim()) {
        throw new Error('Generated tools require auth; pass --auth-env <ENV_VAR_NAME> on the MCP host.');
    }
}

function resolveHostContextForCall(hostConfig: HostRuntimeConfig, generated: GeneratedHostModule): ApiLikeHostContext {
    const credential = readCredentialFromEnv(hostConfig.authEnvKey);
    const { credential: c, jwt } = credentialWithOptionalJwt(credential);
    if (generated.connectionEnv) {
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
        return { connectionString, databaseDialect: dialect, credential: c, jwt };
    }
    const baseUrlKey = hostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on stdio-mcp-server.js and set the variable.');
    }
    return { baseUrl, credential: c, jwt };
}

function formatToolError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

function readGeneratedModule(imported: Record<string, unknown>): GeneratedHostModule {
    const generatedTools = imported.generatedTools;
    const invokeTool = imported.invokeTool;
    if (!Array.isArray(generatedTools)) {
        throw new Error('Generated module must export "generatedTools" array.');
    }
    if (typeof invokeTool !== 'function') {
        throw new Error('Generated module must export async "invokeTool" function.');
    }
    const inputZodByTool = imported.inputZodByTool;
    const mcpServerName = imported.mcpServerName;
    const mcpServerVersion = imported.mcpServerVersion;
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
    };
}

function requireMcpServerIdentity(generated: GeneratedHostModule): { name: string; version: string } {
    const name = generated.mcpServerName?.trim();
    const version = generated.mcpServerVersion?.trim();
    if (!name) {
        throw new Error('Generated module must export "mcpServerName". Regenerate tool code.');
    }
    if (!version) {
        throw new Error('Generated module must export "mcpServerVersion". Regenerate tool code.');
    }
    return { name, version };
}

function requireInputZodSchema(inputZodByTool: Record<string, unknown> | undefined, toolName: string): z.ZodTypeAny {
    if (!inputZodByTool) {
        throw new Error('Generated module must export "inputZodByTool". Regenerate tool code.');
    }
    const schema = inputZodByTool[toolName];
    if (!schema || typeof schema !== 'object') {
        throw new Error(\`Generated module inputZodByTool has no schema for tool "\${toolName}". Regenerate tool code.\`);
    }
    return schema as z.ZodTypeAny;
}

async function registerMcpTools(
    server: McpServer,
    generated: GeneratedHostModule,
    hostConfig: HostRuntimeConfig
): Promise<void> {
    for (const tool of generated.generatedTools) {
        const inputSchema = requireInputZodSchema(generated.inputZodByTool, tool.toolName);
        server.registerTool(
            tool.toolName,
            {
                title: typeof tool.title === 'string' && tool.title.length > 0 ? tool.title : undefined,
                description: tool.description,
                inputSchema
            },
            async (args) => {
                loadLocalEnvFiles(hostConfig.envDirs, { refresh: true });
                const hostContext = resolveHostContextForCall(hostConfig, generated);
                try {
                    const result = await generated.invokeTool(
                        tool.toolName,
                        (args ?? {}) as Record<string, unknown>,
                        hostContext
                    );
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    };
                } catch (err) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: 'text',
                                text: formatToolError(err)
                            }
                        ]
                    };
                }
            }
        );
    }
}
`.trim();
}
