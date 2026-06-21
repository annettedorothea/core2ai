export type AuthPipelineTier = 'none' | 'credential' | 'full';

export type AuthStubMaps = { authorizers: boolean; validators: boolean };

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
        if (upstreamCredential === undefined) {
            const verified = await verifyCredential({ inboundCredential: String(inbound).trim() });
            upstreamCredential = verified.upstreamCredential;
        }`
            : '';

        return `
    let upstreamCredential = host.upstreamCredential;
    const optionsResolved = options;
    let authCredential = host.credential;

    if (tool.access === 'protected') {
        const inbound = host.credential;
        if (!inbound || !String(inbound).trim()) {${MISSING_CREDENTIAL_ERROR}
        }${verifyBlock}
        authCredential = upstreamCredential ?? String(inbound).trim();
    }${renderUrlAndHeadersPreamble()}`;
    }

    const verifyBlock = hasVerifyCredential
        ? `
        await verifyCredential({ inboundCredential: String(inbound).trim() });`
        : '';

    return `
    const optionsResolved = options;

    if (toolMeta.access === 'protected') {
        const inbound = host.credential;
        if (!inbound || !String(inbound).trim()) {${MISSING_CREDENTIAL_ERROR}
        }${verifyBlock}
    }`;
}

export function resolveAuthPipelineTier(
    hasAuthPipeline: boolean,
    authorizeToolNames: readonly string[],
    validateToolNames: readonly string[]
): AuthPipelineTier {
    if (!hasAuthPipeline) {
        return 'none';
    }
    if (authorizeToolNames.length > 0 || validateToolNames.length > 0) {
        return 'full';
    }
    return 'credential';
}

export function renderInvokeAuthPipeline(
    profile: AuthPipelineProfile,
    tier: AuthPipelineTier,
    hasVerifyCredential: boolean,
    stubMaps: AuthStubMaps
): string {
    if (tier === 'credential') {
        return renderInvokeCredentialPipeline(profile, hasVerifyCredential);
    }
    if (tier !== 'full') {
        throw new Error('renderInvokeAuthPipeline: tier must be credential or full');
    }

    const toolRef = profile === 'api2ai' ? 'tool' : 'toolMeta';

    const verifyBlock =
        profile === 'api2ai'
            ? hasVerifyCredential
                ? `
        if (credentialsForStubs === undefined || upstreamCredential === undefined) {
            const verified = await verifyCredential({ inboundCredential: String(inbound).trim() });
            upstreamCredential = verified.upstreamCredential;
            credentialsForStubs = verified.credentials;
        }`
                : ''
            : hasVerifyCredential
              ? `
        if (credentialsForStubs === undefined) {
            const verified = await verifyCredential({ inboundCredential: String(inbound).trim() });
            credentialsForStubs = verified.credentials;
        }`
              : '';

    const authorizeBlock = stubMaps.authorizers
        ? `
        if (${toolRef}.hasAuthorize) {
            const authorize = authorizers[toolName];
            if (typeof authorize !== 'function') {
                throw new Error('No authorizer for tool: ' + toolName);
            }
            await Promise.resolve(authorize(credentialsForStubs!));
        }`
        : '';

    const publicValidateCredentialsBlock = stubMaps.validators
        ? ` else if (${toolRef}.hasValidate && credentialsForStubs === undefined && credentialsPlain != null) {
        credentialsForStubs = toModuleCredentials(credentialsPlain as Record<string, unknown>);
    }`
        : '';

    const validateBlock = stubMaps.validators
        ? `
    if (${toolRef}.hasValidate) {
        const validate = validators[toolName];
        if (typeof validate !== 'function') {
            throw new Error('No validator for tool: ' + toolName);
        }
        if (credentialsForStubs === undefined) {
            if (${toolRef}.access === 'protected') {
                throw new Error('Validate requires credentials; verify credential or pass host.credentials.');
            }
            credentialsForStubs = toModuleCredentials({});
        }
        optionsResolved = await Promise.resolve(validate(options, credentialsForStubs));
    }`
        : '';

    const api2aiPreamble =
        profile === 'api2ai'
            ? `
    let upstreamCredential = host.upstreamCredential;
    const credentialsPlain = host.credentials;
    let credentialsForStubs: ModuleCredentials | undefined =
        credentialsPlain != null
            ? toModuleCredentials(credentialsPlain as Record<string, unknown>)
            : undefined;
    let optionsResolved = options;
    let authCredential = host.credential;

    if (tool.access === 'protected') {
        const inbound = host.credential;
        if (!inbound || !String(inbound).trim()) {${MISSING_CREDENTIAL_ERROR}
        }${verifyBlock}
        authCredential = upstreamCredential ?? String(inbound).trim();${authorizeBlock}
    }${publicValidateCredentialsBlock}${validateBlock}${renderUrlAndHeadersPreamble()}`
            : `
    const credentialsPlain = host.credentials;
    let credentialsForStubs: ModuleCredentials | undefined =
        credentialsPlain != null
            ? toModuleCredentials(credentialsPlain as Record<string, unknown>)
            : undefined;
    let optionsResolved = options;

    if (toolMeta.access === 'protected') {
        const inbound = host.credential;
        if (!inbound || !String(inbound).trim()) {${MISSING_CREDENTIAL_ERROR}
        }${verifyBlock}${authorizeBlock}
    }${publicValidateCredentialsBlock}${validateBlock}`;

    return api2aiPreamble;
}
