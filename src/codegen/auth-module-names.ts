import * as path from 'node:path';
import { resolveHostProductFromGeneratedToolsPath } from './generated-layout.js';

export type ModuleCredentialNames = {
    pascalBase: string;
    className: string;
    toFunctionName: string;
    verifyFunctionName: string;
    fileBase: string;
};

function kebabSegmentToPascal(segment: string): string {
    if (segment.length === 0) {
        return '';
    }
    return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function kebabToPascal(kebab: string): string {
    return kebab.split('-').map(kebabSegmentToPascal).join('');
}

/** Derive per-module credential type/file names from `generated/{product}/tools/<module>-tools.ts`. */
export function resolveModuleCredentialNames(toolsModuleTsPath: string): ModuleCredentialNames {
    let base = path.parse(toolsModuleTsPath).name;
    if (base.endsWith('-tools')) {
        base = base.slice(0, -'-tools'.length);
    }
    const pascalBase = kebabToPascal(base);
    return {
        pascalBase,
        className: `${pascalBase}Credentials`,
        toFunctionName: `to${pascalBase}Credentials`,
        verifyFunctionName: `verify${pascalBase}Credentials`,
        fileBase: `verify${pascalBase}Credentials`
    };
}

export function resolveVerifyCredentialsStubFileName(toolsModuleTsPath: string): string {
    return `${resolveModuleCredentialNames(toolsModuleTsPath).fileBase}.ts`;
}

export function resolveVerifyCredentialsStubPath(projectRoot: string, toolsModuleTsPath: string): string {
    const hostProduct = resolveHostProductFromGeneratedToolsPath(toolsModuleTsPath);
    const mcpModuleName = path.parse(toolsModuleTsPath).name;
    return path.join(
        projectRoot,
        'src',
        'auth',
        hostProduct,
        mcpModuleName,
        resolveVerifyCredentialsStubFileName(toolsModuleTsPath)
    );
}
