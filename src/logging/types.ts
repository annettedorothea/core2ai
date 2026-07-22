/** Pluggable logging used by MCP hosts and generated tool modules. */
export type LoggingAdapter = {
    debug(message: string, context?: object): void;
    info(message: string, context?: object): void;
    warn(message: string, context?: object): void;
    error(message: string, context?: object): void;
    /** Multi-line operator output (startup cards). No level prefix or JSON. */
    banner(lines: string[]): void;
};
