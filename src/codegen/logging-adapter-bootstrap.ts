import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveBootstrapProjectRootFromSource } from './project-bootstrap.js';

/** @deprecated Use relativeImportToLoggingAdapter — nested layout uses ../../../src/utils/logging-adapter.js */
export const LOGGING_ADAPTER_IMPORT_FROM_GENERATED = '../../../src/utils/logging-adapter.js';

export function resolveLoggingAdapterPath(projectRoot: string): string {
    return path.join(projectRoot, 'src', 'utils', 'logging-adapter.ts');
}

export function renderLoggingAdapterStubContent(): string {
    return `/**
 * Logging adapter (write-once — customize this file; re-generate does not overwrite).
 * Default: stderr with ANSI colors. debug() only when process.env.LOG_LEVEL === 'debug'.
 * Optional prefix: process.env.LOG_SERVICE_PREFIX (set by init / demo npm scripts).
 */
const GRAY = '\\x1b[90m';
const RESET = '\\x1b[0m';
const YELLOW = '\\x1b[33m';
const RED = '\\x1b[31m';

function servicePrefix(): string {
    const raw = process.env.LOG_SERVICE_PREFIX?.trim();
    return raw && raw.length > 0 ? '[' + raw + '] ' : '';
}

function formatLine(level: string, color: string, message: string, context?: object): string {
    const suffix =
        context !== undefined && Object.keys(context).length > 0 ? ' ' + JSON.stringify(context) : '';
    return color + '[' + level + '] ' + servicePrefix() + message + suffix + RESET;
}

export class LoggingAdapter {
    debug(message: string, context?: object): void {
        if (process.env.LOG_LEVEL !== 'debug') {
            return;
        }
        console.error(formatLine('debug', GRAY, message, context));
    }

    info(message: string, context?: object): void {
        console.error(formatLine('info', RESET, message, context));
    }

    warn(message: string, context?: object): void {
        console.error(formatLine('warn', YELLOW, message, context));
    }

    error(message: string, context?: object): void {
        console.error(formatLine('error', RED, message, context));
    }
}

export const loggingAdapter = new LoggingAdapter();
`;
}

export function ensureLoggingAdapterStubAtProjectRoot(projectRoot: string): string {
    const utilsDir = path.join(projectRoot, 'src', 'utils');
    const dest = resolveLoggingAdapterPath(projectRoot);
    if (!fs.existsSync(utilsDir)) {
        fs.mkdirSync(utilsDir, { recursive: true });
    }
    if (!fs.existsSync(dest)) {
        fs.writeFileSync(dest, renderLoggingAdapterStubContent(), 'utf-8');
    }
    return dest;
}

export function ensureLoggingAdapterStubFromSource(source: string): string {
    const projectRoot = resolveBootstrapProjectRootFromSource(source);
    return ensureLoggingAdapterStubAtProjectRoot(projectRoot);
}
