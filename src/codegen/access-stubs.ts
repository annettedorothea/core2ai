export function authorizeExportName(toolName: string): string {
    return `authorize${toolName.charAt(0).toUpperCase()}${toolName.slice(1)}`;
}

export function prepareInputExportName(toolName: string): string {
    return `prepare${toolName.charAt(0).toUpperCase()}${toolName.slice(1)}Input`;
}
