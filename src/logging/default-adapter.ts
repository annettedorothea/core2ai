import type { LoggingAdapter } from './types.js';

const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

function servicePrefix(): string {
    const raw = process.env.LOG_SERVICE_PREFIX?.trim();
    return raw && raw.length > 0 ? '[' + raw + '] ' : '';
}

function formatLine(level: string, color: string, message: string, context?: object): string {
    const suffix = context !== undefined && Object.keys(context).length > 0 ? ' ' + JSON.stringify(context) : '';
    return color + '[' + level + '] ' + servicePrefix() + message + suffix + RESET;
}

/** Default stderr/ANSI adapter (`LOG_LEVEL=debug`, optional `LOG_SERVICE_PREFIX`). */
export class DefaultLoggingAdapter implements LoggingAdapter {
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

    banner(lines: string[]): void {
        for (const line of lines) {
            console.error(line);
        }
    }
}
