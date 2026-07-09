import { describe, expect, test } from 'vitest';
import {
    listCheckToolAccessToolNamesFromSpecs,
    listPrepareToolCallHookEntriesFromSpecs,
    listPrepareToolCallToolNamesFromSpecs,
    renderCheckToolAccessStubFileContent,
    renderPrepareToolCallHooksMap,
    renderPrepareToolCallStubFileContent,
    type ToolHookStubSpec
} from '../src/codegen/auth-stub-bootstrap.js';
import {
    formatCodegenBuildTimestamp,
    renderMcpBuildGeneratedAtModuleSource,
    renderMcpBuildGeneratedAtReExport,
    resolveCodegenBuildTimestamp,
    resolveMcpBuildGeneratedAtTsPathFromToolsModule
} from '../src/codegen/project-bootstrap.js';

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

describe('tool hook spec helpers', () => {
    const specs: ToolHookStubSpec[] = [
        { toolName: 'alpha', checkToolAccess: true, prepareToolCall: false, access: 'protected' },
        { toolName: 'beta', checkToolAccess: false, prepareToolCall: true, access: 'public' }
    ];

    test('listCheckToolAccessToolNamesFromSpecs', () => {
        expect(listCheckToolAccessToolNamesFromSpecs(specs)).toEqual(['alpha']);
    });

    test('listPrepareToolCallToolNamesFromSpecs', () => {
        expect(listPrepareToolCallToolNamesFromSpecs(specs)).toEqual(['beta']);
    });

    test('listPrepareToolCallHookEntriesFromSpecs', () => {
        expect(listPrepareToolCallHookEntriesFromSpecs(specs)).toEqual([{ toolName: 'beta', access: 'public' }]);
    });
});

describe('formatCodegenBuildTimestamp', () => {
    test('formats local readable stamp with whole-hour offset', () => {
        const stamp = formatCodegenBuildTimestamp(new Date('2026-07-09T04:43:00.000Z'));
        expect(stamp).toMatch(/^2026-07-09 \d{2}:43 \(UTC[+-]\d+\)$/);
    });

    test('resolveCodegenBuildTimestamp prefers TF_BUILD_GENERATED_AT', () => {
        const previous = process.env.TF_BUILD_GENERATED_AT;
        process.env.TF_BUILD_GENERATED_AT = '2026-07-09 06:43 (UTC+2)';
        try {
            expect(resolveCodegenBuildTimestamp()).toBe('2026-07-09 06:43 (UTC+2)');
        } finally {
            if (previous === undefined) {
                delete process.env.TF_BUILD_GENERATED_AT;
            } else {
                process.env.TF_BUILD_GENERATED_AT = previous;
            }
        }
    });
});

describe('mcp build stamp module', () => {
    test('resolveMcpBuildGeneratedAtTsPathFromToolsModule sits beside tools/', () => {
        const toolsPath = '/proj/generated/api2ai/tools/open-meteo-tools.ts';
        expect(resolveMcpBuildGeneratedAtTsPathFromToolsModule(toolsPath)).toBe(
            '/proj/generated/api2ai/mcp-build-generated-at.ts'
        );
    });

    test('renderMcpBuildGeneratedAtReExport uses posix .js import', () => {
        const toolsPath = '/proj/generated/api2ai/tools/open-meteo-tools.ts';
        expect(renderMcpBuildGeneratedAtReExport(toolsPath)).toBe(
            "export { mcpBuildGeneratedAt } from '../mcp-build-generated-at.js';"
        );
    });

    test('renderMcpBuildGeneratedAtModuleSource uses single quotes (Prettier singleQuote)', () => {
        expect(renderMcpBuildGeneratedAtModuleSource('2026-07-09 06:43 (UTC+2)')).toBe(
            `/** Written by codegen — gitignored in demo workspaces. Do not edit. */
export const mcpBuildGeneratedAt = '2026-07-09 06:43 (UTC+2)';
`
        );
    });
});
