#!/usr/bin/env node
/**
 * Run DSL generate from packages/extension/demos (api2ai / db2ai).
 *
 * Usage: node demos-generate.mjs <demos-generate.config.json> <file.dsl> <generated/tools/out.ts>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

function loadConfig(configPath) {
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const required = [
        'productName',
        'extensionIdPrefix',
        'embedDirName',
        'cliEnvVar',
        'embedHomeEnvVar',
        'dslExtension'
    ];
    for (const key of required) {
        if (typeof config[key] !== 'string' || config[key].trim().length === 0) {
            throw new Error(`[demos-generate] ${path.basename(configPath)} missing "${key}"`);
        }
    }
    return config;
}

function resolveEmbedHome(cliPath, embedDirName) {
    const parent = path.dirname(cliPath);
    if (path.basename(parent) === embedDirName) {
        return parent;
    }
    return undefined;
}

function findInstalledExtensionCli(config) {
    const home = os.homedir();
    const roots = [
        path.join(home, '.cursor', 'extensions'),
        path.join(home, '.vscode', 'extensions'),
        path.join(home, '.vscode-insiders', 'extensions')
    ];
    const candidates = [];
    for (const root of roots) {
        if (!existsSync(root)) {
            continue;
        }
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || !entry.name.startsWith(config.extensionIdPrefix)) {
                continue;
            }
            candidates.push(path.join(root, entry.name, 'out', config.embedDirName, 'cli.cjs'));
        }
    }
    candidates.sort();
    return candidates.filter((candidate) => existsSync(candidate)).at(-1);
}

function resolveCliSpawn(config, demosRoot) {
    const envCli = process.env[config.cliEnvVar];
    if (envCli && existsSync(envCli)) {
        return { scriptPath: envCli, embedHome: resolveEmbedHome(envCli, config.embedDirName) };
    }

    const monorepoCli = path.resolve(demosRoot, '../../cli/bin/cli.js');
    if (existsSync(monorepoCli)) {
        return { scriptPath: monorepoCli };
    }

    const installedCli = findInstalledExtensionCli(config);
    if (installedCli) {
        return {
            scriptPath: installedCli,
            embedHome: resolveEmbedHome(installedCli, config.embedDirName)
        };
    }

    throw new Error(
        [
            `${config.productName} CLI not found.`,
            `• Install the ${config.productName} VS Code/Cursor extension (VSIX), or`,
            `• Run from the monorepo with packages/extension/demos as cwd, or`,
            `• Set ${config.cliEnvVar} to cli.js / cli.cjs.`
        ].join('\n')
    );
}

function main() {
    const configPath = path.resolve(process.argv[2] ?? '');
    const dslRelative = process.argv[3];
    const outRelative = process.argv[4];

    if (!configPath || !dslRelative || !outRelative) {
        console.error(
            'Usage: node demos-generate.mjs <demos-generate.config.json> <file.dsl> <generated/tools/out.ts>'
        );
        process.exit(1);
    }

    const config = loadConfig(configPath);
    const demosRoot = path.dirname(configPath);
    const { scriptPath, embedHome } = resolveCliSpawn(config, demosRoot);
    const dslPath = path.join(demosRoot, dslRelative);
    const outPath = path.join(demosRoot, outRelative);
    const env = embedHome ? { ...process.env, [config.embedHomeEnvVar]: embedHome } : process.env;

    execFileSync(process.execPath, [scriptPath, 'generate', dslPath, outPath], {
        stdio: 'inherit',
        cwd: demosRoot,
        env
    });
}

main();
