import { readCredentialFromEnv } from './argv.js';
import { resolveRelayHostCredential } from './credential-relay.js';
import { isExpectedDatabaseUrl } from './database.js';
import type { ApiLikeHostContext, DatabaseDialect, GeneratedHostModule, HostRuntimeConfig } from './types.js';

/**
 * Require `--base-url-env` unless the module exports `connectionEnv` (db2ai).
 * Matches former product argv-check fragments (api short / db connectionEnv skip).
 */
export function requireBaseUrlEnvArgvCheck(generated: GeneratedHostModule, baseUrlEnvKey: string | undefined): void {
    if (!generated.connectionEnv && !baseUrlEnvKey) {
        throw new Error('Required: --base-url-env <ENV_VAR_NAME>');
    }
}

export function validateHostAtStartup(hostConfig: HostRuntimeConfig, generated: GeneratedHostModule): void {
    if (generated.connectionEnv) {
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Environment variable "' + generated.connectionEnv + '" is missing or empty (database env from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Environment variable "' +
                    generated.connectionEnv +
                    '" does not match generated database dialect "' +
                    dialect +
                    '".'
            );
        }
    } else {
        const baseUrlKey = hostConfig.baseUrlEnvKey?.trim();
        if (!baseUrlKey) {
            throw new Error('Required: --base-url-env <ENV_VAR_NAME>');
        }
        const baseUrl = process.env[baseUrlKey]?.trim();
        if (!baseUrl) {
            throw new Error(
                'Environment variable "' + baseUrlKey + '" is missing or empty (required by --base-url-env).'
            );
        }
    }
    if (generated.requiresAuth && !hostConfig.authEnvKey?.trim()) {
        throw new Error('Generated tools require auth; pass --auth-env <ENV_VAR_NAME> on the MCP host.');
    }
}

export async function resolveHostContextForCall(
    hostConfig: HostRuntimeConfig,
    generated: GeneratedHostModule
): Promise<ApiLikeHostContext> {
    const credential = readCredentialFromEnv(hostConfig.authEnvKey);
    const { credential: c } = resolveRelayHostCredential(credential);
    if (generated.connectionEnv) {
        const connectionString = process.env[generated.connectionEnv]?.trim();
        if (!connectionString) {
            throw new Error(
                'Missing database URL. Set environment variable "' + generated.connectionEnv + '" (from .db2ai).'
            );
        }
        const dialect: DatabaseDialect = generated.databaseDialect ?? 'postgres';
        if (!isExpectedDatabaseUrl(connectionString, dialect)) {
            throw new Error(
                'Database URL from "' + generated.connectionEnv + '" does not match dialect "' + dialect + '".'
            );
        }
        return { connectionString, databaseDialect: dialect, credential: c };
    }
    const baseUrlKey = hostConfig.baseUrlEnvKey?.trim();
    const baseUrl = baseUrlKey ? process.env[baseUrlKey]?.trim() : undefined;
    if (!baseUrl) {
        throw new Error('Missing host base URL. Pass --base-url-env on the MCP host and set the variable.');
    }
    return { baseUrl, credential: c };
}

export function describeUpstreamEnvField(
    generated: GeneratedHostModule,
    hostConfig: { baseUrlEnvKey?: string }
): { label: string; value: string } | undefined {
    if (generated.connectionEnv) {
        const key = generated.connectionEnv;
        const set = Boolean(process.env[key]?.trim());
        return { label: 'Database:', value: key + (set ? '' : ' (unset)') };
    }
    const key = hostConfig.baseUrlEnvKey?.trim();
    if (!key) {
        return undefined;
    }
    const set = Boolean(process.env[key]?.trim());
    return { label: 'Upstream:', value: key + (set ? '' : ' (unset)') };
}
