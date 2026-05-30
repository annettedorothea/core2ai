export function parameterCheckExportName(toolName: string): string {
    return `check${toolName.charAt(0).toUpperCase()}${toolName.slice(1)}Parameters`;
}
