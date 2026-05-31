import { GENERATED_TEST_SUPPORT_BANNER } from './generated-banner.js';

export function renderTestSupportIndexSource(): string {
    const body = [
        "export { readGeneratedToolModule, type GeneratedHostAdapter, type GeneratedToolDescriptor, type GeneratedToolModule } from './generated-module.js';",
        "export { compileGeneratedForSmoke } from './compile-generated-fixture.js';",
        "export { connectMcpStdio, withMcpStdioSession, type McpStdioConnectOptions, type McpStdioSession } from './mcp-stdio-smoke.js';",
        "export { asRecord, restoreEnv } from './env-helpers.js';"
    ].join('\n');
    return GENERATED_TEST_SUPPORT_BANNER + body;
}
