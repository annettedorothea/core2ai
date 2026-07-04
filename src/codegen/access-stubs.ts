export function checkToolAccessExportName(toolName: string): string {
    return `checkToolAccessFor${toolName.charAt(0).toUpperCase()}${toolName.slice(1)}`;
}

export function prepareToolCallExportName(toolName: string): string {
    return `prepareToolCallFor${toolName.charAt(0).toUpperCase()}${toolName.slice(1)}`;
}
