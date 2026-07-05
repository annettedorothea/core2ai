import { describe, expect, test } from 'vitest';
import { renderModuleMcpServerSource } from '../src/codegen/mcp-module-host.js';
import {
    renderOAuthHttpMcpRuntimeSource,
    renderPassthroughHttpMcpRuntimeSource,
    renderPublicHttpMcpRuntimeSource,
    renderStdioMcpRuntimeSource
} from '../src/codegen/index.js';

const products = ['api2ai', 'db2ai'] as const;
const LOGGING_IMPORT = '../../../src/utils/logging-adapter.js';

describe('codegen MCP host snapshots', () => {
    for (const product of products) {
        test(`renderStdioMcpRuntimeSource (${product})`, () => {
            expect(renderStdioMcpRuntimeSource(product, LOGGING_IMPORT)).toMatchSnapshot();
        });

        test(`renderPublicHttpMcpRuntimeSource (${product})`, () => {
            expect(renderPublicHttpMcpRuntimeSource(product, LOGGING_IMPORT)).toMatchSnapshot();
        });

        test(`renderPassthroughHttpMcpRuntimeSource (${product})`, () => {
            expect(renderPassthroughHttpMcpRuntimeSource(product, LOGGING_IMPORT)).toMatchSnapshot();
        });

        test(`renderOAuthHttpMcpRuntimeSource (${product})`, () => {
            expect(renderOAuthHttpMcpRuntimeSource(product, LOGGING_IMPORT)).toMatchSnapshot();
        });
    }

    test('renderModuleMcpServerSource (passthrough-http)', () => {
        const toolsPath = '/proj/generated/api2ai/tools/github-tools.ts';
        const serverPath = '/proj/generated/api2ai/servers/github-passthrough-http-mcp-server.ts';
        expect(renderModuleMcpServerSource('passthrough-http', toolsPath, serverPath)).toMatchSnapshot();
    });
});
