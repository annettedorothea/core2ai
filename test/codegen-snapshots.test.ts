import { describe, expect, test } from 'vitest';
import {
    renderOAuthHttpMcpServerSource,
    renderPassthroughHttpMcpServerSource,
    renderPublicHttpMcpServerSource,
    renderStdioMcpServerSource
} from '../src/codegen/index.js';

const products = ['api2ai', 'db2ai'] as const;
const LOGGING_IMPORT = '../../../src/utils/logging-adapter.js';

describe('codegen MCP host snapshots', () => {
    for (const product of products) {
        test(`renderStdioMcpServerSource (${product})`, () => {
            expect(renderStdioMcpServerSource(product, LOGGING_IMPORT)).toMatchSnapshot();
        });

        test(`renderPublicHttpMcpServerSource (${product})`, () => {
            expect(renderPublicHttpMcpServerSource(product, LOGGING_IMPORT)).toMatchSnapshot();
        });

        test(`renderPassthroughHttpMcpServerSource (${product})`, () => {
            expect(renderPassthroughHttpMcpServerSource(product, LOGGING_IMPORT)).toMatchSnapshot();
        });

        test(`renderOAuthHttpMcpServerSource (${product})`, () => {
            expect(renderOAuthHttpMcpServerSource(product, LOGGING_IMPORT)).toMatchSnapshot();
        });
    }
});
