/** Product-specific TS fragments injected into {@link renderMcpHostSharedTemplate}. */
export type McpHostSharedFragmentSet = {
    hostCoreTypes: string;
    /** Whitespace + optional db-only helpers between env loading and credential relay. */
    envLoadingToCredentialGap: string;
    readGeneratedModuleTail: string;
    validateHostAtStartup: string;
    resolveHostContextForCall: string;
    validateHttpMcpHostAtStartup: string;
    resolveHostContextForHttpCallPublic: string;
    resolveHostContextForHttpCallPassthrough: string;
    validateOAuthHttpHostAtStartup: string;
    oauthHostContextBaseUrlFields: string;
    resolveHostContextForOAuthSession: string;
    describeUpstreamEnvField: string;
    /** Inside collectMissingEnvNote([...]); db2ai: `generated.connectionEnv, ` — api2ai: empty. */
    startupBannerConnectionEnvNotePrefix: string;
};
