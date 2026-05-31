/** Minimal contract for generated *-tools.js modules (no @core2ai/core). */
export type GeneratedHostAdapter = {
    configureFromArgv(argv: string[], envDirs: string[]): void;
    validateAtStartup(requiresAuth: boolean): void;
    resolveHostContext(): unknown;
};

export type GeneratedToolDescriptor = {
    toolName: string;
    title?: string;
    description: string;
};

export type GeneratedToolModule = {
    adapter: GeneratedHostAdapter;
    generatedTools: GeneratedToolDescriptor[];
    invokeTool: (toolName: string, args?: Record<string, unknown>, hostContext?: unknown) => Promise<unknown>;
    requiresAuth?: boolean;
};

function readAdapter(imported: Record<string, unknown>): GeneratedHostAdapter {
    const adapter = imported.mcpHostAdapter;
    if (!adapter || typeof adapter !== 'object') {
        throw new Error('Generated module must export "mcpHostAdapter". Regenerate tool code.');
    }
    const a = adapter as GeneratedHostAdapter;
    if (typeof a.configureFromArgv !== 'function') {
        throw new Error('mcpHostAdapter.configureFromArgv is required. Regenerate tool code.');
    }
    if (typeof a.validateAtStartup !== 'function') {
        throw new Error('mcpHostAdapter.validateAtStartup is required. Regenerate tool code.');
    }
    if (typeof a.resolveHostContext !== 'function') {
        throw new Error('mcpHostAdapter.resolveHostContext is required. Regenerate tool code.');
    }
    return a;
}

export function readGeneratedToolModule(imported: Record<string, unknown>): GeneratedToolModule {
    const generatedTools = imported.generatedTools;
    const invokeTool = imported.invokeTool;
    if (!Array.isArray(generatedTools)) {
        throw new Error('Generated module must export "generatedTools" array.');
    }
    if (typeof invokeTool !== 'function') {
        throw new Error('Generated module must export async "invokeTool" function.');
    }
    return {
        adapter: readAdapter(imported),
        generatedTools: generatedTools as GeneratedToolDescriptor[],
        invokeTool: invokeTool as GeneratedToolModule['invokeTool'],
        requiresAuth: imported.requiresAuth === true
    };
}
