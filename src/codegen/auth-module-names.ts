import * as path from 'node:path';

export type ModuleVerifyCredentialNames = {
    pascalBase: string;
    verifyFunctionName: string;
    fileBase: string;
};

/** @deprecated Use `ModuleVerifyCredentialNames`. */
export type ModuleCredentialNames = ModuleVerifyCredentialNames;

function kebabSegmentToPascal(segment: string): string {
    if (segment.length === 0) {
        return '';
    }
    return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function kebabToPascal(kebab: string): string {
    return kebab.split('-').map(kebabSegmentToPascal).join('');
}

/** Derive per-module verify stub names from `generated/{product}/tools/<module>-tools.ts`. */
export function resolveModuleCredentialNames(toolsModuleTsPath: string): ModuleVerifyCredentialNames {
    let base = path.parse(toolsModuleTsPath).name;
    if (base.endsWith('-tools')) {
        base = base.slice(0, -'-tools'.length);
    }
    const pascalBase = kebabToPascal(base);
    const verifyFunctionName = `verify${pascalBase}Credential`;
    return {
        pascalBase,
        verifyFunctionName,
        fileBase: verifyFunctionName
    };
}

export function resolveVerifyCredentialStubFileName(toolsModuleTsPath: string): string {
    return `${resolveModuleCredentialNames(toolsModuleTsPath).fileBase}.ts`;
}

export type ModuleTokenExchangeNames = {
    pascalBase: string;
    tokenExchangeFunctionName: string;
    fileBase: string;
};

/** Derive per-module tokenExchange stub names from `generated/{product}/tools/<module>-tools.ts`. */
export function resolveModuleTokenExchangeNames(toolsModuleTsPath: string): ModuleTokenExchangeNames {
    const { pascalBase } = resolveModuleCredentialNames(toolsModuleTsPath);
    const tokenExchangeFunctionName = `tokenExchange${pascalBase}Credential`;
    return {
        pascalBase,
        tokenExchangeFunctionName,
        fileBase: tokenExchangeFunctionName
    };
}

export function resolveTokenExchangeStubFileName(toolsModuleTsPath: string): string {
    return `${resolveModuleTokenExchangeNames(toolsModuleTsPath).fileBase}.ts`;
}

/** @deprecated Use `resolveVerifyCredentialStubFileName`. */
export const resolveVerifyCredentialsStubFileName = resolveVerifyCredentialStubFileName;
