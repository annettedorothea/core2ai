import type { HookStubMaps } from '../invoke-pipeline-shared.js';

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

/** Runs on the successful invoke result (after HTTP/SQL), before return to MCP. */
export function renderAfterToolCallBlock(stubMaps: HookStubMaps, toolRef: string, resultVar = 'result'): string {
    if (!stubMaps.afterToolCall) {
        return '';
    }
    return `
    if (${toolRef}.hasAfterToolCall) {
        const afterToolCall = afterToolCallHooks[toolName];
        if (typeof afterToolCall !== 'function') {
            throw new Error('No afterToolCall hook for tool: ' + toolName);
        }
        if (${toolRef}.access === 'protected') {
            if (credential === undefined) {
                throw new Error('afterToolCall requires credential for protected tools.');
            }
            ${resultVar} = await Promise.resolve(afterToolCall(${resultVar}, credential));
        } else {
            ${resultVar} = await Promise.resolve(afterToolCall(${resultVar}));
        }
    }`;
}
