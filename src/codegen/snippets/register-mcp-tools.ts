/** Product-neutral MCP tool error formatting. */
export function formatToolErrorSnippet(): string {
    return `
function formatToolError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}`.trim();
}

/** Product-neutral MCP tool registration helpers. */
export function registerMcpToolsSnippet(): string {
    return `
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

function formatMcpToolDescription(generated: GeneratedHostModule, toolDescription: string): string {
    const buildLine = formatMcpBuildLine(generated);
    if (!buildLine) {
        return toolDescription;
    }
    return 'MCP build: ' + buildLine + '\\n\\n---\\n\\n' + toolDescription;
}

/** Log when the MCP client requests tools/list (wraps SDK handler set by registerTool). */
function attachListToolsDebugLogging(mcpServer: McpServer, generated: GeneratedHostModule): void {
    type ListToolsHandler = (request: unknown, extra: unknown) => Promise<ListToolsResult>;
    const handlers = (mcpServer.server as unknown as { _requestHandlers: Map<string, ListToolsHandler> })._requestHandlers;
    const previous = handlers.get('tools/list');
    if (!previous) {
        return;
    }
    mcpServer.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
        loggingAdapter.debug('listTools', {
            toolCount: generated.generatedTools.length,
            toolNames: generated.generatedTools.map((t) => t.toolName)
        });
        return previous(request, extra);
    });
}

async function registerMcpTools(
    server: McpServer,
    generated: GeneratedHostModule,
    options: { envDirs: string[]; resolveContext: () => ApiLikeHostContext | Promise<ApiLikeHostContext> }
): Promise<void> {
    for (const tool of generated.generatedTools) {
        const inputSchema = requireInputZodSchema(generated.inputZodByTool, tool.toolName);
        server.registerTool(
            tool.toolName,
            {
                title: typeof tool.title === 'string' && tool.title.length > 0 ? tool.title : undefined,
                description: formatMcpToolDescription(generated, tool.description),
                inputSchema
            },
            async (args) => {
                loadLocalEnvFiles(options.envDirs, { refresh: true });
                const hostContext = await Promise.resolve(options.resolveContext());
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
    attachListToolsDebugLogging(server, generated);
}`.trim();
}
