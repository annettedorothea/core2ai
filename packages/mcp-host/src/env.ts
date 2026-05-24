import * as fs from 'node:fs';
import * as path from 'node:path';

const LOCAL_ENV_FILES = ['.env', '.env.local'];

function stripOptionalQuotes(value: string): string {
    if (value.length < 2) {
        return value;
    }
    const first = value.at(0);
    const last = value.at(-1);
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
        return value.slice(1, -1);
    }
    return value;
}

function parseEnvLine(line: string): [string, string] | undefined {
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

    const value = stripOptionalQuotes(assignment.slice(separator + 1).trim());
    return [key, value];
}

function ancestorDirectories(startDir: string): string[] {
    const directories: string[] = [];
    let current = path.resolve(startDir);
    while (true) {
        directories.unshift(current);
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return directories;
}

export function loadLocalEnvFiles(startDirs: string[]): string[] {
    const protectedKeys = new Set(Object.keys(process.env));
    const loadedKeys = new Set<string>();
    const loadedFiles: string[] = [];
    const visitedFiles = new Set<string>();

    for (const startDir of startDirs) {
        for (const directory of ancestorDirectories(startDir)) {
            for (const fileName of LOCAL_ENV_FILES) {
                const filePath = path.join(directory, fileName);
                if (visitedFiles.has(filePath) || !fs.existsSync(filePath)) {
                    continue;
                }
                visitedFiles.add(filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                const overrideExisting = fileName === '.env.local';
                for (const line of content.split(/\r?\n/u)) {
                    const parsed = parseEnvLine(line);
                    if (!parsed) {
                        continue;
                    }
                    const [key, value] = parsed;
                    if (overrideExisting || !protectedKeys.has(key) || loadedKeys.has(key)) {
                        process.env[key] = value;
                        loadedKeys.add(key);
                    }
                }
                loadedFiles.push(filePath);
            }
        }
    }

    return loadedFiles;
}
