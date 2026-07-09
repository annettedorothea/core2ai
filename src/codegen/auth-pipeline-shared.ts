export type AuthPipelineTier = 'none' | 'credential' | 'full';

export type HookStubMaps = { checkToolAccess: boolean; prepareToolCall: boolean };

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
