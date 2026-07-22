import { parseDatabaseDialect } from './database.js';
import type { GeneratedHostModule, TokenExchangeFn, VerifyCredentialFn } from './types.js';

/** Validate and normalize a generated tools module import for MCP hosts. */
export function readGeneratedModule(imported: Record<string, unknown>): GeneratedHostModule {
    const generatedTools = imported.generatedTools;
    const invokeTool = imported.invokeTool;
    if (!Array.isArray(generatedTools)) {
        throw new Error('Generated module must export "generatedTools" array.');
    }
    if (typeof invokeTool !== 'function') {
        throw new Error('Generated module must export async "invokeTool" function.');
    }
    const inputZodByTool = imported.inputZodByTool;
    const mcpServerName = imported.mcpServerName;
    const mcpServerVersion = imported.mcpServerVersion;
    const mcpBuildGeneratedAt = imported.mcpBuildGeneratedAt;
    const connectionEnv = imported.connectionEnv;
    const verifyCredential = imported.verifyCredential;
    const verifyCredentialFn =
        typeof verifyCredential === 'function' ? (verifyCredential as VerifyCredentialFn) : undefined;
    const tokenExchange = imported.tokenExchange;
    const tokenExchangeFn = typeof tokenExchange === 'function' ? (tokenExchange as TokenExchangeFn) : undefined;
    return {
        generatedTools: generatedTools as GeneratedHostModule['generatedTools'],
        invokeTool: invokeTool as GeneratedHostModule['invokeTool'],
        inputZodByTool:
            inputZodByTool && typeof inputZodByTool === 'object' && !Array.isArray(inputZodByTool)
                ? (inputZodByTool as Record<string, unknown>)
                : undefined,
        mcpServerName: typeof mcpServerName === 'string' ? mcpServerName : undefined,
        mcpServerVersion: typeof mcpServerVersion === 'string' ? mcpServerVersion : undefined,
        mcpBuildGeneratedAt: typeof mcpBuildGeneratedAt === 'string' ? mcpBuildGeneratedAt : undefined,
        requiresAuth: imported.requiresAuth === true,
        connectionEnv: typeof connectionEnv === 'string' ? connectionEnv : undefined,
        databaseDialect: parseDatabaseDialect(imported.databaseDialect),
        verifyCredential: verifyCredentialFn,
        tokenExchange: tokenExchangeFn
    };
}
