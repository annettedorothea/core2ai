import { GENERATED_SCRIPTS_BANNER } from './generated-scripts-banner.js';

export function renderLoadEnvLocalMjsSource(): string {
    return `${GENERATED_SCRIPTS_BANNER}/**
 * Load \`.env\` then \`.env.local\` into process.env.
 * Does not override keys already set in the shell; \`.env.local\` overrides \`.env\`.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function stripOptionalQuotes(value) {
    if (value.length < 2) {
        return value;
    }
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return value.slice(1, -1);
    }
    return value;
}

function parseEnvLine(line) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
        return undefined;
    }
    const assignment = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const separator = assignment.indexOf('=');
    if (separator <= 0) {
        return undefined;
    }
    const key = assignment.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        return undefined;
    }
    return [key, stripOptionalQuotes(assignment.slice(separator + 1).trim())];
}

function loadEnvFile(filePath, options) {
    const overrideExisting = options?.overrideExisting === true;
    if (!existsSync(filePath)) {
        return false;
    }
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split(/\\r?\\n/u)) {
        const parsed = parseEnvLine(line);
        if (!parsed) {
            continue;
        }
        const [key, value] = parsed;
        if (overrideExisting || process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
    return true;
}

/** @param {string} [root] defaults to project root (parent of scripts/) */
export function loadProjectEnvLocal(root = defaultRoot) {
    loadEnvFile(path.join(root, '.env'));
    loadEnvFile(path.join(root, '.env.local'), { overrideExisting: true });
}
`;
}
