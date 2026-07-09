import { compose } from '../compose.js';

const MCP_SERVER_SKELETON = `#!/usr/bin/env node
/**
 * Generated MCP <<hostKind>> host for <<moduleBasename>> (static tools import).
 */
import * as tools from '<<toolsImport>>';
import { <<runExport>> } from '<<runtimeImport>>';

await <<runExport>>(tools, process.argv.slice(2));
`;

export type McpServerTemplateKind = 'stdio' | 'public-http' | 'passthrough-http' | 'oauth-http';

const RUN_EXPORT_BY_KIND: Record<McpServerTemplateKind, string> = {
    stdio: 'runStdioMcp',
    'public-http': 'runPublicHttpMcp',
    'passthrough-http': 'runPassthroughHttpMcp',
    'oauth-http': 'runOAuthHttpMcp'
};

export function renderMcpServerTemplate(options: {
    hostKind: McpServerTemplateKind;
    moduleBasename: string;
    toolsImport: string;
    runtimeImport: string;
}): string {
    return compose(MCP_SERVER_SKELETON, {
        hostKind: options.hostKind,
        moduleBasename: options.moduleBasename,
        toolsImport: options.toolsImport,
        runtimeImport: options.runtimeImport,
        runExport: RUN_EXPORT_BY_KIND[options.hostKind]
    });
}
