import { describe, expect, test } from 'vitest';
import { renderInvokeAuthPipeline } from '../src/codegen/auth-pipeline-render.js';
import {
    renderPrepareToolCallHooksMap,
    renderToolHookStubFileContent,
    type ToolHookStubSpec
} from '../src/codegen/auth-stub-bootstrap.js';

const toolsModuleTsPath = '/project/generated/api2ai/tools/demo-tools.ts';
const hookStubTsPath = '/project/src/hooks/api2ai/demo-tools/listItems.ts';

function publicPrepareSpec(): ToolHookStubSpec {
    return { toolName: 'listItems', checkToolAccess: false, prepareToolCall: true, access: 'public' };
}

function protectedPrepareSpec(): ToolHookStubSpec {
    return { toolName: 'listItems', checkToolAccess: false, prepareToolCall: true, access: 'protected' };
}

describe('renderToolHookStubFileContent', () => {
    test('public prepare stub has no credential param', () => {
        const content = renderToolHookStubFileContent(
            'listItems',
            publicPrepareSpec(),
            hookStubTsPath,
            toolsModuleTsPath
        );
        expect(content).not.toContain('ModuleCredentials');
        expect(content).toContain('export function prepareToolCallForListItems(options: InvokeOptions): InvokeOptions');
    });

    test('protected prepare stub requires credential param', () => {
        const content = renderToolHookStubFileContent(
            'listItems',
            protectedPrepareSpec(),
            hookStubTsPath,
            toolsModuleTsPath
        );
        expect(content).not.toContain('ModuleCredentials');
        expect(content).toContain(
            'export function prepareToolCallForListItems(options: InvokeOptions, credential: string): InvokeOptions'
        );
    });
});

describe('renderPrepareToolCallHooksMap', () => {
    test('uses optional credential in type annotation', () => {
        const map = renderPrepareToolCallHooksMap([{ toolName: 'listItems', access: 'public' }]);
        expect(map).toContain('credential?: string');
    });

    test('wraps protected hooks so required credential params type-check', () => {
        const map = renderPrepareToolCallHooksMap([{ toolName: 'listItems', access: 'protected' }]);
        expect(map).toContain(
            '"listItems": (options, credential) => prepareToolCallForListItems(options, credential!)'
        );
    });
});

describe('renderInvokeAuthPipeline', () => {
    test('public prepare calls prepareToolCall(optionsResolved) without credential preamble', () => {
        const pipeline = renderInvokeAuthPipeline('api2ai', 'full', false, {
            checkToolAccess: false,
            prepareToolCall: true
        });
        expect(pipeline).toContain('prepareToolCall(optionsResolved));');
        expect(pipeline).not.toContain('ModuleCredentials');
        expect(pipeline).not.toContain('toModuleCredentials');
    });

    test('protected prepare calls prepareToolCall(optionsResolved, credential)', () => {
        const pipeline = renderInvokeAuthPipeline('api2ai', 'full', true, {
            checkToolAccess: false,
            prepareToolCall: true
        });
        expect(pipeline).toContain('prepareToolCall(optionsResolved, credential)');
        expect(pipeline).toContain('prepareToolCall requires credential');
    });

    test('hooks-only module omits authCredential when auth is disabled', () => {
        const pipeline = renderInvokeAuthPipeline(
            'api2ai',
            'full',
            false,
            { checkToolAccess: false, prepareToolCall: true },
            false
        );
        expect(pipeline).not.toContain('authCredential');
    });
});
