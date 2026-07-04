export type AuthPipelineTier = 'none' | 'credential' | 'full';

export type HookStubMaps = { checkToolAccess: boolean; prepareToolCall: boolean };

export type AuthPipelineProfile = 'api2ai' | 'db2ai';

const MISSING_CREDENTIAL_ERROR = `
            throw new Error(
                'Missing host credential. stdio: set env for --auth-env on stdio-mcp-server; passthrough HTTP: MCP auth header (e.g. x-api-token); OAuth HTTP: complete MCP login (Authorization Bearer from Cursor).'
            );`;

function renderUrlAndHeadersPreamble(): string {
    return `
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const pathParams = { ...(optionsResolved.pathParams ?? {}) };
    let resolvedPath = tool.path;
    for (const [key, value] of Object.entries(pathParams)) {
        resolvedPath = resolvedPath.split('{' + key + '}').join(encodeURIComponent(String(value)));
    }

    const url = new URL(normalizedBaseUrl + resolvedPath);
    appendSerializedQueryParams(url.searchParams, tool.toolName, optionsResolved.query);
    const requestHeaders: Record<string, string> = {
        'content-type': 'application/json',
        ...(optionsResolved.headers ?? {})
    };`;
}

function renderInvokeCredentialPipeline(profile: AuthPipelineProfile, hasVerifyCredential: boolean): string {
    if (profile === 'api2ai') {
        const verifyBlock = hasVerifyCredential
            ? `
        await verifyCredential(credential);`
            : '';

        return `
    let authCredential: string | undefined = host.credential?.trim()
        ? String(host.credential).trim()
        : undefined;

    if (tool.access === 'protected') {
        const inbound = host.credential;
        if (!inbound || !String(inbound).trim()) {${MISSING_CREDENTIAL_ERROR}
        }
        const credential = String(inbound).trim();${verifyBlock}
        authCredential = credential;
    }${renderUrlAndHeadersPreamble()}`;
    }

    const verifyBlock = hasVerifyCredential
        ? `
        await verifyCredential(String(inbound).trim());`
        : '';

    return `
    if (toolMeta.access === 'protected') {
        const inbound = host.credential;
        if (!inbound || !String(inbound).trim()) {${MISSING_CREDENTIAL_ERROR}
        }${verifyBlock}
    }`;
}

export function resolveAuthPipelineTier(
    hasAuthPipeline: boolean,
    checkToolAccessToolNames: readonly string[],
    prepareToolCallToolNames: readonly string[]
): AuthPipelineTier {
    if (!hasAuthPipeline) {
        return 'none';
    }
    if (checkToolAccessToolNames.length > 0 || prepareToolCallToolNames.length > 0) {
        return 'full';
    }
    return 'credential';
}

export function renderInvokeAuthPipeline(
    profile: AuthPipelineProfile,
    tier: AuthPipelineTier,
    hasVerifyCredential: boolean,
    stubMaps: HookStubMaps,
    includeAuthCredential = true
): string {
    if (tier === 'credential') {
        return renderInvokeCredentialPipeline(profile, hasVerifyCredential);
    }
    if (tier !== 'full') {
        throw new Error('renderInvokeAuthPipeline: tier must be credential or full');
    }

    const toolRef = profile === 'api2ai' ? 'tool' : 'toolMeta';
    const flagCheckToolAccess = profile === 'api2ai' ? 'hasCheckToolAccess' : 'hasCheckToolAccess';
    const flagPrepareToolCall = profile === 'api2ai' ? 'hasPrepareToolCall' : 'hasPrepareToolCall';

    const verifyBlock =
        profile === 'api2ai'
            ? hasVerifyCredential
                ? `
        await verifyCredential(credential);`
                : ''
            : hasVerifyCredential
              ? `
        await verifyCredential(credential);`
              : '';

    const checkToolAccessBlock = stubMaps.checkToolAccess
        ? `
        if (${toolRef}.${flagCheckToolAccess}) {
            const checkToolAccess = checkToolAccessHooks[toolName];
            if (typeof checkToolAccess !== 'function') {
                throw new Error('No checkToolAccess hook for tool: ' + toolName);
            }
            await Promise.resolve(checkToolAccess(credential));
        }`
        : '';

    const prepareBlock = stubMaps.prepareToolCall
        ? `
    if (${toolRef}.${flagPrepareToolCall}) {
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
    }`
        : '';

    const authCredentialDecl = includeAuthCredential
        ? `\n    let authCredential: string | undefined = credential;`
        : '';
    const authCredentialAssign = includeAuthCredential ? `\n        authCredential = credential;` : '';

    const api2aiPreamble = `
    let credential: string | undefined = host.credential?.trim()
        ? String(host.credential).trim()
        : undefined;${authCredentialDecl}

    if (tool.access === 'protected') {
        const inbound = host.credential;
        if (!inbound || !String(inbound).trim()) {${MISSING_CREDENTIAL_ERROR}
        }
        credential = String(inbound).trim();${verifyBlock}${checkToolAccessBlock}${authCredentialAssign}
    }${prepareBlock}${renderUrlAndHeadersPreamble()}`;

    const db2aiPreamble = `
    let credential: string | undefined = host.credential?.trim()
        ? String(host.credential).trim()
        : undefined;

    if (toolMeta.access === 'protected') {
        const inbound = host.credential;
        if (!inbound || !String(inbound).trim()) {${MISSING_CREDENTIAL_ERROR}
        }
        credential = String(inbound).trim();${verifyBlock}${checkToolAccessBlock}
    }${prepareBlock}`;

    return profile === 'api2ai' ? api2aiPreamble : db2aiPreamble;
}
