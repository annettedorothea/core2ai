import { describe, expect, test } from 'vitest';
import { renderInvokeAuthPipeline } from '../src/codegen/auth-pipeline-render.js';
import {
    renderPreparersMap,
    renderToolHookStubFileContent,
    type ToolHookStubSpec
} from '../src/codegen/auth-stub-bootstrap.js';

const toolsModuleTsPath = '/project/generated/api2ai/tools/demo-tools.ts';
const hookStubTsPath = '/project/src/hooks/api2ai/demo-tools/listItems.ts';

function publicPrepareSpec(): ToolHookStubSpec {
    return { toolName: 'listItems', authorize: false, prepare: true, access: 'public' };
}

function protectedPrepareSpec(): ToolHookStubSpec {
    return { toolName: 'listItems', authorize: false, prepare: true, access: 'protected' };
}

describe('renderToolHookStubFileContent', () => {
    test('public prepare stub has no ModuleCredentials import or credentials param', () => {
        const content = renderToolHookStubFileContent(
            'listItems',
            publicPrepareSpec(),
            hookStubTsPath,
            toolsModuleTsPath
        );
        expect(content).not.toContain('ModuleCredentials');
        expect(content).toContain('export function prepareListItemsInput(options: InvokeOptions): InvokeOptions');
    });

    test('protected prepare stub imports ModuleCredentials and requires credentials param', () => {
        const content = renderToolHookStubFileContent(
            'listItems',
            protectedPrepareSpec(),
            hookStubTsPath,
            toolsModuleTsPath
        );
        expect(content).toContain("import type { ModuleCredentials } from './verifyDemoCredentials.js'");
        expect(content).toContain(
            'export function prepareListItemsInput(options: InvokeOptions, credentials?: ModuleCredentials): InvokeOptions'
        );
    });
});

describe('renderPreparersMap', () => {
    test('without credentials omits ModuleCredentials from type annotation', () => {
        const map = renderPreparersMap(['listItems'], { includeCredentials: false });
        expect(map).not.toContain('ModuleCredentials');
        expect(map).toContain('(options: InvokeOptions) => InvokeOptions');
    });

    test('with credentials includes ModuleCredentials in type annotation', () => {
        const map = renderPreparersMap(['listItems'], { includeCredentials: true });
        expect(map).toContain('credentials?: ModuleCredentials');
    });
});

describe('renderInvokeAuthPipeline', () => {
    test('public prepare calls prepare(optionsResolved) without credentials preamble', () => {
        const pipeline = renderInvokeAuthPipeline('api2ai', 'full', false, {
            authorizers: false,
            preparers: true
        });
        expect(pipeline).toContain('optionsResolved = await Promise.resolve(prepare(optionsResolved));');
        expect(pipeline).not.toContain('ModuleCredentials');
        expect(pipeline).not.toContain('toModuleCredentials');
    });

    test('protected prepare calls prepare(optionsResolved, credentialsForStubs)', () => {
        const pipeline = renderInvokeAuthPipeline('api2ai', 'full', true, {
            authorizers: false,
            preparers: true
        });
        expect(pipeline).toContain('prepare(optionsResolved, credentialsForStubs)');
        expect(pipeline).toContain('Prepare requires credentials');
    });
});
