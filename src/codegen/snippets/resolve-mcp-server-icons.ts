import { MCP_FALLBACK_ICON_PNG_BASE64 } from '../assets/mcp-fallback-icon-b64.js';

/** Max on-disk size for `--icon` files (keeps initialize payloads small). */
const MCP_ICON_MAX_BYTES = 200 * 1024;

/** Emitted into generated MCP host runtimes: `--icon` file or Tool Factory fallback. */
export function resolveMcpServerIconsSnippet(): string {
    return `
type McpServerIcon = { src: string; mimeType: string };

/** Tool Factory brand icon when --icon is omitted (compact PNG). */
const DEFAULT_MCP_SERVER_ICONS: McpServerIcon[] = [
    {
        src: 'data:image/png;base64,${MCP_FALLBACK_ICON_PNG_BASE64}',
        mimeType: 'image/png'
    }
];

const MCP_ICON_MAX_BYTES = ${MCP_ICON_MAX_BYTES};

function mimeTypeForIconPath(iconPath: string): string {
    const lower = iconPath.toLowerCase();
    if (lower.endsWith('.svg')) {
        throw new Error('MCP icon must be a raster image (PNG/JPEG/WebP); SVG is not supported: ' + iconPath);
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    if (lower.endsWith('.webp')) {
        return 'image/webp';
    }
    if (lower.endsWith('.png')) {
        return 'image/png';
    }
    throw new Error('MCP icon must be .png, .jpg, .jpeg, or .webp: ' + iconPath);
}

function resolveMcpServerIcons(iconPath: string | undefined): McpServerIcon[] {
    const trimmed = iconPath?.trim();
    if (!trimmed) {
        return DEFAULT_MCP_SERVER_ICONS;
    }
    if (!fs.existsSync(trimmed)) {
        throw new Error('MCP icon file not found: ' + trimmed);
    }
    const bytes = fs.readFileSync(trimmed);
    if (bytes.byteLength > MCP_ICON_MAX_BYTES) {
        throw new Error(
            'MCP icon exceeds ' +
                MCP_ICON_MAX_BYTES +
                ' bytes (' +
                bytes.byteLength +
                '): ' +
                trimmed
        );
    }
    const mimeType = mimeTypeForIconPath(trimmed);
    return [
        {
            src: 'data:' + mimeType + ';base64,' + bytes.toString('base64'),
            mimeType
        }
    ];
}`.trim();
}
