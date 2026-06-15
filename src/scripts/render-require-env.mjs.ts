import { GENERATED_SCRIPTS_BANNER } from './generated-scripts-banner.js';

export function renderRequireEnvMjsSource(): string {
    return `${GENERATED_SCRIPTS_BANNER}/**
 * Require non-empty env vars (fail-fast).
 */

/**
 * @param {string} name
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function requireEnv(name, env = process.env) {
    const value = env[name]?.trim();
    if (!value) {
        console.error(\`[env] Missing required variable: \${name}\`);
        process.exit(1);
    }
    return value;
}

/**
 * @param {string} name
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function requireEnvInt(name, env = process.env) {
    const raw = requireEnv(name, env);
    const port = Number.parseInt(raw, 10);
    if (!Number.isFinite(port) || port <= 0) {
        console.error(\`[env] Invalid \${name}: \${raw}\`);
        process.exit(1);
    }
    return port;
}
`;
}
