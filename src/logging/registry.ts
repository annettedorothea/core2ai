import { DefaultLoggingAdapter } from './default-adapter.js';
import type { LoggingAdapter } from './types.js';

let active: LoggingAdapter = new DefaultLoggingAdapter();

/** Replace the process-wide logging adapter (call before host start). */
export function registerLogging(adapter: LoggingAdapter): void {
    active = adapter;
}

export function getLoggingAdapter(): LoggingAdapter {
    return active;
}

/**
 * Stable export used by generated code and hosts.
 * Delegates to the adapter from {@link registerLogging} (or the default).
 */
export const loggingAdapter: LoggingAdapter = {
    debug(message, context) {
        getLoggingAdapter().debug(message, context);
    },
    info(message, context) {
        getLoggingAdapter().info(message, context);
    },
    warn(message, context) {
        getLoggingAdapter().warn(message, context);
    },
    error(message, context) {
        getLoggingAdapter().error(message, context);
    },
    banner(lines) {
        getLoggingAdapter().banner(lines);
    }
};
