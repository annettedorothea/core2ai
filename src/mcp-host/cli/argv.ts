import type { HostRuntimeConfig } from '../types.js';

export function parseHostArgv(argv: string[], envDirs: string[]): HostRuntimeConfig {
    let baseUrlEnv: string | undefined;
    let authEnv: string | undefined;
    let iconPath: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--base-url-env') {
            baseUrlEnv = argv[++i];
            if (!baseUrlEnv) {
                throw new Error('Missing value after --base-url-env');
            }
            continue;
        }
        if (arg === '--auth-env') {
            authEnv = argv[++i];
            if (!authEnv) {
                throw new Error('Missing value after --auth-env');
            }
            continue;
        }
        if (arg === '--icon') {
            iconPath = argv[++i];
            if (!iconPath) {
                throw new Error('Missing value after --icon');
            }
            continue;
        }
        if (arg.startsWith('-')) {
            throw new Error('Unknown option: ' + arg);
        }
        throw new Error('Unexpected positional argument: ' + arg);
    }
    return {
        baseUrlEnvKey: baseUrlEnv,
        authEnvKey: authEnv,
        iconPath,
        envDirs
    };
}

export function readCredentialFromEnv(authEnvKey: string | undefined): string | undefined {
    const key = authEnvKey?.trim();
    if (!key) {
        return undefined;
    }
    const value = process.env[key]?.trim();
    return value && value.length > 0 ? value : undefined;
}
