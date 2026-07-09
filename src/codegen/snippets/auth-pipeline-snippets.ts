import type { HookStubMaps } from '../auth-pipeline-shared.js';

export function missingCredentialErrorSnippet(): string {
    return `
            throw new Error(
                'Missing host credential. stdio: set env for --auth-env on the MCP host; passthrough HTTP: MCP auth header (e.g. x-api-token); OAuth HTTP: complete MCP login (Authorization Bearer from Cursor).'
            );`;
}

export function renderVerifyCredentialBlock(hasVerifyCredential: boolean, credentialExpr: string): string {
    if (!hasVerifyCredential) {
        return '';
    }
    return `
        await verifyCredential(${credentialExpr});`;
}

export function renderCheckToolAccessBlock(stubMaps: HookStubMaps, toolRef: string): string {
    if (!stubMaps.checkToolAccess) {
        return '';
    }
    return `
        if (${toolRef}.hasCheckToolAccess) {
            const checkToolAccess = checkToolAccessHooks[toolName];
            if (typeof checkToolAccess !== 'function') {
                throw new Error('No checkToolAccess hook for tool: ' + toolName);
            }
            await Promise.resolve(checkToolAccess(credential));
        }`;
}

export function renderPrepareToolCallBlock(stubMaps: HookStubMaps, toolRef: string): string {
    if (!stubMaps.prepareToolCall) {
        return '';
    }
    return `
    if (${toolRef}.hasPrepareToolCall) {
        const prepareToolCall = prepareToolCallHooks[toolName];
        if (typeof prepareToolCall !== 'function') {
            throw new Error('No prepareToolCall hook for tool: ' + toolName);
        }
        if (${toolRef}.access === 'protected') {
            if (credential === undefined) {
                throw new Error('prepareToolCall requires credential for protected tools.');
            }
            optionsResolved = await Promise.resolve(prepareToolCall(optionsResolved, credential));
        } else {
            optionsResolved = await Promise.resolve(prepareToolCall(optionsResolved));
        }
    }`;
}
