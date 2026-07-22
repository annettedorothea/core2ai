import { compose } from '../compose.js';

const MCP_SERVER_HTTP_SKELETON = `#!/usr/bin/env node
/**
 * Generated MCP <<hostKind>> host for <<moduleBasename>> (static tools import).
 */
import * as tools from '<<toolsImport>>';
import { <<runExport>> } from '<<runtimeImport>>';

await <<runExport>>(tools, process.argv.slice(2));
`;

const MCP_SERVER_STDIO_SKELETON = `#!/usr/bin/env node
/**
 * Generated MCP stdio host for <<moduleBasename>> (static tools import).
 */
import * as tools from '<<toolsImport>>';
import { defaultMcpEnvDirsFromMetaUrl, runStdioMcp } from '@toolfactory.dev/core/mcp-host';

await runStdioMcp(tools, process.argv.slice(2), defaultMcpEnvDirsFromMetaUrl(import.meta.url));
`;

export type McpServerTemplateKind = 'stdio' | 'public-http' | 'passthrough-http' | 'oauth-http';

const RUN_EXPORT_BY_KIND: Record<Exclude<McpServerTemplateKind, 'stdio'>, string> = {
    'public-http': 'runPublicHttpMcp',
    'passthrough-http': 'runPassthroughHttpMcp',
    'oauth-http': 'runOAuthHttpMcp'
};

export function renderMcpServerTemplate(options: {
    hostKind: McpServerTemplateKind;
    moduleBasename: string;
    toolsImport: string;
    /** Unused for stdio (imports core directly). */
    runtimeImport: string;
}): string {
    if (options.hostKind === 'stdio') {
        return compose(MCP_SERVER_STDIO_SKELETON, {
            moduleBasename: options.moduleBasename,
            toolsImport: options.toolsImport
        });
    }
    return compose(MCP_SERVER_HTTP_SKELETON, {
        hostKind: options.hostKind,
        moduleBasename: options.moduleBasename,
        toolsImport: options.toolsImport,
        runtimeImport: options.runtimeImport,
        runExport: RUN_EXPORT_BY_KIND[options.hostKind]
    });
}
