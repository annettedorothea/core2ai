import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Options, Plugin } from 'prettier';

const DEFAULT_GENERATED_CODE_PRETTIER_OPTIONS: Options = {
    singleQuote: true,
    trailingComma: 'none',
    printWidth: 120,
    tabWidth: 4
};

const PRETTIER_CONFIG_FILE_NAMES = ['.prettierrc', '.prettierrc.json', 'prettier.config.json', 'package.json'];

function escapeRegExp(value: string): string {
    return value.replace(/[\\^$+?.()|[\]{}]/g, '\\$&');
}

function normalizeIgnorePath(value: string): string {
    return value.split(path.sep).join('/');
}

function findClosestFile(startPath: string, fileName: string): string | undefined {
    let currentDir = fs.statSync(startPath).isDirectory()
        ? path.resolve(startPath)
        : path.dirname(path.resolve(startPath));

    while (true) {
        const candidate = path.join(currentDir, fileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return undefined;
        }
        currentDir = parentDir;
    }
}

function globPatternToRegExp(rawPattern: string): RegExp {
    let pattern = rawPattern.trim().replace(/\\/g, '/');
    if (pattern.startsWith('/')) {
        pattern = pattern.slice(1);
    }
    const directoryOnly = pattern.endsWith('/');
    if (directoryOnly) {
        pattern = pattern.slice(0, -1);
    }

    let source = '';
    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        const nextChar = pattern[i + 1];
        if (char === '*' && nextChar === '*') {
            source += '.*';
            i++;
        } else if (char === '*') {
            source += '[^/]*';
        } else {
            source += escapeRegExp(char);
        }
    }

    const hasSlash = pattern.includes('/');
    const prefix = hasSlash ? '^' : '(^|.*/)';
    const suffix = directoryOnly ? '(/.*)?$' : '$';
    return new RegExp(`${prefix}${source}${suffix}`);
}

function isIgnoredByPrettierIgnore(filePath: string): boolean {
    const prettierIgnorePath = findClosestFile(filePath, '.prettierignore');
    if (!prettierIgnorePath) {
        return false;
    }

    const relativePath = normalizeIgnorePath(path.relative(path.dirname(prettierIgnorePath), filePath));
    let ignored = false;
    for (const rawLine of fs.readFileSync(prettierIgnorePath, 'utf-8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const negated = line.startsWith('!');
        const pattern = negated ? line.slice(1) : line;
        if (globPatternToRegExp(pattern).test(relativePath)) {
            ignored = !negated;
        }
    }
    return ignored;
}

function readPrettierOptions(configPath: string): Options | undefined {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as unknown;
    if (path.basename(configPath) === 'package.json') {
        const prettierOptions = (parsed as { prettier?: unknown }).prettier;
        return prettierOptions && typeof prettierOptions === 'object' ? (prettierOptions as Options) : undefined;
    }
    return parsed && typeof parsed === 'object' ? (parsed as Options) : undefined;
}

function resolvePrettierOptions(startPath: string): Options | undefined {
    let currentDir = fs.statSync(startPath).isDirectory()
        ? path.resolve(startPath)
        : path.dirname(path.resolve(startPath));

    while (true) {
        for (const fileName of PRETTIER_CONFIG_FILE_NAMES) {
            const candidate = path.join(currentDir, fileName);
            if (fs.existsSync(candidate)) {
                const options = readPrettierOptions(candidate);
                if (options) {
                    return options;
                }
            }
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return undefined;
        }
        currentDir = parentDir;
    }
}

function resolvePrettierPlugin(module: unknown): Plugin {
    return ((module as { default?: unknown }).default ?? module) as Plugin;
}

async function loadBundledPrettierPlugins(): Promise<Plugin[]> {
    const [babelPlugin, estreePlugin, typescriptPlugin] = await Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
        import('prettier/plugins/typescript')
    ]);
    return [
        resolvePrettierPlugin(babelPlugin),
        resolvePrettierPlugin(estreePlugin),
        resolvePrettierPlugin(typescriptPlugin)
    ];
}

function inferParser(filePath: string): 'babel' | 'typescript' | undefined {
    const ext = path.extname(filePath);
    if (ext === '.ts' || ext === '.tsx') {
        return 'typescript';
    }
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
        return 'babel';
    }
    return undefined;
}

export async function formatGeneratedFileWithPrettier(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        return;
    }

    if (isIgnoredByPrettierIgnore(absolutePath)) {
        return;
    }

    const parser = inferParser(absolutePath);
    if (!parser) {
        return;
    }

    const prettier = await import('prettier/standalone');
    const plugins = await loadBundledPrettierPlugins();
    const source = fs.readFileSync(absolutePath, 'utf-8');
    const resolvedOptions = resolvePrettierOptions(absolutePath);
    const formatted = await prettier.format(source, {
        ...DEFAULT_GENERATED_CODE_PRETTIER_OPTIONS,
        ...(resolvedOptions ?? {}),
        filepath: absolutePath,
        parser,
        plugins
    });

    if (formatted !== source) {
        fs.writeFileSync(absolutePath, formatted);
    }
}

export async function formatGeneratedFilesWithPrettier(filePaths: readonly string[]): Promise<void> {
    for (const filePath of filePaths) {
        try {
            await formatGeneratedFileWithPrettier(filePath);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const wrappedError = new Error(`Failed to format generated file with Prettier (${filePath}): ${message}`);
            (wrappedError as Error & { cause?: unknown }).cause = error;
            throw wrappedError;
        }
    }
}
