/** DSL-agnostic contract: host bootstrap and runtime context come from generated `mcpHostAdapter`. */
export interface McpHostAdapter {
    /** Parse host-specific argv (after module path) and write process.env. */
    configureFromArgv(argv: string[], envDirs: string[]): void;
    /** Fail-fast before MCP stdio connects. */
    validateAtStartup(requiresAuth: boolean): void;
    /** Re-read env on every tool call (e.g. rotated tokens). */
    resolveHostContext(): unknown;
    /** Directories for optional .env reload between tool calls. */
    envDirsForReload(): string[];
}

/** Minimal metadata the generic MCP host needs. Generated modules may include DSL-specific fields too. */
export type McpToolDescriptor = {
    toolName: string;
    title?: string;
    description: string;
};

/** Exports the MCP host expects from a generated *-tools module. */
export type GeneratedMcpModule = {
    adapter: McpHostAdapter;
    generatedTools: McpToolDescriptor[];
    invokeTool: (toolName: string, args?: Record<string, unknown>, hostContext?: unknown) => Promise<unknown>;
    inputZodByTool?: Record<string, unknown>;
    mcpServerName?: string;
    mcpServerVersion?: string;
    requiresAuth?: boolean;
};

function readMcpHostAdapter(imported: Record<string, unknown>): McpHostAdapter {
    const adapter = imported.mcpHostAdapter;
    if (!adapter || typeof adapter !== 'object') {
        throw new Error('Generated module must export "mcpHostAdapter". Regenerate tool code.');
    }
    const a = adapter as McpHostAdapter;
    if (typeof a.configureFromArgv !== 'function') {
        throw new Error('mcpHostAdapter.configureFromArgv is required. Regenerate tool code.');
    }
    if (typeof a.validateAtStartup !== 'function') {
        throw new Error('mcpHostAdapter.validateAtStartup is required. Regenerate tool code.');
    }
    if (typeof a.resolveHostContext !== 'function') {
        throw new Error('mcpHostAdapter.resolveHostContext is required. Regenerate tool code.');
    }
    if (typeof a.envDirsForReload !== 'function') {
        throw new Error('mcpHostAdapter.envDirsForReload is required. Regenerate tool code.');
    }
    return a;
}

export function readGeneratedModule(imported: Record<string, unknown>): GeneratedMcpModule {
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
    return {
        adapter: readMcpHostAdapter(imported),
        generatedTools: generatedTools as McpToolDescriptor[],
        invokeTool: invokeTool as GeneratedMcpModule['invokeTool'],
        inputZodByTool:
            inputZodByTool && typeof inputZodByTool === 'object' && !Array.isArray(inputZodByTool)
                ? (inputZodByTool as Record<string, unknown>)
                : undefined,
        mcpServerName: typeof mcpServerName === 'string' ? mcpServerName : undefined,
        mcpServerVersion: typeof mcpServerVersion === 'string' ? mcpServerVersion : undefined,
        requiresAuth: imported.requiresAuth === true
    };
}
