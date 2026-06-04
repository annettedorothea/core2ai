import { GENERATED_TEST_SUPPORT_BANNER } from './generated-banner.js';

export function renderGeneratedModuleSource(): string {
    const body = [
        '/** Minimal contract for generated *-tools.js modules (no @core2ai/core). */',
        'export type GeneratedToolDescriptor = {',
        '    toolName: string;',
        '    title?: string;',
        '    description: string;',
        '};',
        '',
        'export type GeneratedToolModule = {',
        '    generatedTools: GeneratedToolDescriptor[];',
        '    invokeTool: (toolName: string, args?: Record<string, unknown>, hostContext?: unknown) => Promise<unknown>;',
        '    requiresAuth?: boolean;',
        '};',
        '',
        'export function readGeneratedToolModule(imported: Record<string, unknown>): GeneratedToolModule {',
        '    const generatedTools = imported.generatedTools;',
        '    const invokeTool = imported.invokeTool;',
        '    if (!Array.isArray(generatedTools)) {',
        '        throw new Error(\'Generated module must export "generatedTools" array.\');',
        '    }',
        '    if (typeof invokeTool !== "function") {',
        '        throw new Error(\'Generated module must export async "invokeTool" function.\');',
        '    }',
        '    return {',
        '        generatedTools: generatedTools as GeneratedToolDescriptor[],',
        '        invokeTool: invokeTool as GeneratedToolModule["invokeTool"],',
        '        requiresAuth: imported.requiresAuth === true',
        '    };',
        '}'
    ].join('\n');
    return GENERATED_TEST_SUPPORT_BANNER + body;
}
