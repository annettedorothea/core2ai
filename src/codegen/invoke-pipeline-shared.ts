export type InvokePipelineTier = 'none' | 'credential' | 'full';

export type HookStubMaps = {
    checkToolAccess: boolean;
    prepareToolCall: boolean;
    afterToolCall: boolean;
};

export function resolveInvokePipelineTier(
    hasInvokePipeline: boolean,
    checkToolAccessToolNames: readonly string[],
    prepareToolCallToolNames: readonly string[],
    afterToolCallToolNames: readonly string[]
): InvokePipelineTier {
    if (!hasInvokePipeline) {
        return 'none';
    }
    if (
        checkToolAccessToolNames.length > 0 ||
        prepareToolCallToolNames.length > 0 ||
        afterToolCallToolNames.length > 0
    ) {
        return 'full';
    }
    return 'credential';
}
