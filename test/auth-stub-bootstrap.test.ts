import { describe, expect, test } from 'vitest';
import { renderInvokeAuthPipeline } from '../src/codegen/auth-pipeline-render.js';
import {
    renderCheckToolAccessStubFileContent,
    renderPrepareToolCallHooksMap,
    renderPrepareToolCallStubFileContent
} from '../src/codegen/auth-stub-bootstrap.js';

const toolsModuleTsPath = '/project/generated/api2ai/tools/demo-tools.ts';
const prepareStubTsPath = '/project/src/hooks/api2ai/demo-tools/prepareToolCallForListItems.ts';
const checkStubTsPath = '/project/src/hooks/api2ai/demo-tools/checkToolAccessForListItems.ts';

describe('renderPrepareToolCallStubFileContent', () => {
    test('public prepare stub has no credential param', () => {
        const content = renderPrepareToolCallStubFileContent(
            'listItems',
            'public',
            prepareStubTsPath,
            toolsModuleTsPath
        );
        expect(content).not.toContain('ModuleCredentials');
        expect(content).toContain('export function prepareToolCallForListItems(options: InvokeOptions): InvokeOptions');
        expect(content).toContain('prepareToolCallForListItems.ts');
    });

    test('protected prepare stub requires credential param', () => {
        const content = renderPrepareToolCallStubFileContent(
            'listItems',
            'protected',
            prepareStubTsPath,
            toolsModuleTsPath
        );
        expect(content).not.toContain('ModuleCredentials');
        expect(content).toContain(
            'export function prepareToolCallForListItems(options: InvokeOptions, credential: string): InvokeOptions'
        );
    });
});

describe('renderCheckToolAccessStubFileContent', () => {
    test('names stub file after export function', () => {
        const content = renderCheckToolAccessStubFileContent('listItems', checkStubTsPath, toolsModuleTsPath);
        expect(content).toContain('export function checkToolAccessForListItems(credential: string): void');
        expect(content).toContain('checkToolAccessForListItems.ts');
        expect(content).not.toContain('InvokeOptions');
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
