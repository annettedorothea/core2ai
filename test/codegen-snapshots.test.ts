import { describe, expect, test } from 'vitest';
import {
    renderOAuthHttpMcpServerSource,
    renderPassthroughHttpMcpServerSource,
    renderPublicHttpMcpServerSource,
    renderStdioMcpServerSource
} from '../src/codegen/index.js';

const products = ['api2ai', 'db2ai'] as const;

describe('codegen MCP host snapshots', () => {
    for (const product of products) {
        test(`renderStdioMcpServerSource (${product})`, () => {
            expect(renderStdioMcpServerSource(product)).toMatchSnapshot();
        });

        test(`renderPublicHttpMcpServerSource (${product})`, () => {
            expect(renderPublicHttpMcpServerSource(product)).toMatchSnapshot();
        });

        test(`renderPassthroughHttpMcpServerSource (${product})`, () => {
            expect(renderPassthroughHttpMcpServerSource(product)).toMatchSnapshot();
        });

        test(`renderOAuthHttpMcpServerSource (${product})`, () => {
            expect(renderOAuthHttpMcpServerSource(product)).toMatchSnapshot();
        });
    }
});
