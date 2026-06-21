export function authorizeExportName(toolName: string): string {
    return `authorize${toolName.charAt(0).toUpperCase()}${toolName.slice(1)}`;
}

export function validateInputExportName(toolName: string): string {
    return `validate${toolName.charAt(0).toUpperCase()}${toolName.slice(1)}Input`;
}
