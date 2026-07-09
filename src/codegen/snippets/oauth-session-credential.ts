/** OAuth session credential resolution (product-neutral duck-typing for tokenExchange/verifyCredential). */
export function oauthSessionCredentialSnippet(): string {
    return `
async function resolveOAuthSessionCredential(
    generated: GeneratedHostModule,
    inboundIdpToken: string,
    session: McpOAuthSession | undefined
): Promise<string> {
    const inbound = inboundIdpToken.trim();
    if (
        session?.exchangedAt &&
        session.credential &&
        session.sourceCredential === inbound
    ) {
        return session.credential;
    }

    const cached = oauthCredentialByInbound.get(inbound);
    if (cached) {
        if (session) {
            session.credential = cached;
            session.sourceCredential = inbound;
            session.exchangedAt = Date.now();
            session.verifiedAt = Date.now();
        }
        return cached;
    }

    let credential = inbound;
    const exchange = generated.tokenExchange;
    if (typeof exchange === 'function') {
        credential = String(await exchange(inbound)).trim();
        if (!credential) {
            throw new Error('tokenExchange returned an empty credential.');
        }
    }

    const verify = generated.verifyCredential;
    if (typeof verify === 'function') {
        await verify(credential);
    }

    oauthCredentialByInbound.set(inbound, credential);

    if (session) {
        session.credential = credential;
        session.sourceCredential = inbound;
        session.exchangedAt = Date.now();
        session.verifiedAt = Date.now();
    }

    return credential;
}

async function verifyCredentialForGate(
    generated: GeneratedHostModule,
    bearer: string | undefined,
    session?: McpOAuthSession
): Promise<boolean> {
    const token = bearer?.trim();
    if (!token) {
        return false;
    }
    if (!generated.requiresAuth) {
        return true;
    }
    const verify = generated.verifyCredential;
    const exchange = generated.tokenExchange;
    if (typeof verify !== 'function' && typeof exchange !== 'function') {
        return true;
    }
    try {
        await resolveOAuthSessionCredential(generated, token, session);
        return true;
    } catch {
        return false;
    }
}`.trim();
}
