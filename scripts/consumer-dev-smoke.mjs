#!/usr/bin/env node
/**
 * Dev smoke / MCP e2e helpers for api2ai / db2ai.
 *
 * Usage:
 *   node consumer-dev-smoke.mjs <dev-smoke.config.json> --list
 *   node consumer-dev-smoke.mjs <dev-smoke.config.json> --all-smoke
 *   node consumer-dev-smoke.mjs <dev-smoke.config.json> <scenario>
 *   node consumer-dev-smoke.mjs <dev-smoke.config.json> --e2e
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

function loadConfig(configPath) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.scenarios || typeof config.scenarios !== 'object') {
        throw new Error('[dev-smoke] config missing "scenarios" object');
    }
    return config;
}

function resolvePath(consumerRoot, relativePath) {
    return path.resolve(consumerRoot, relativePath);
}

function consumerRootFromConfigPath(configPath) {
    const configDir = path.dirname(configPath);
    if (path.basename(configDir) === 'scripts') {
        return path.dirname(configDir);
    }
    return configDir;
}

function runNode(consumerRoot, scriptPath, args = [], env = process.env) {
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: consumerRoot,
        stdio: 'inherit',
        env
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function runSmokeGenerated(consumerRoot, config, scenario) {
    const cliBin = resolvePath(consumerRoot, config.cliBin ?? './packages/cli/bin/cli.js');
    const modulePath = resolvePath(consumerRoot, scenario.module);
    const args = ['smoke-generated', modulePath, scenario.tool];
    if (scenario.argsJson) {
        args.push(scenario.argsJson);
    }
    const result = spawnSync(process.execPath, [cliBin, ...args], {
        cwd: consumerRoot,
        stdio: 'inherit'
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function runMcpServe(consumerRoot, scenario) {
    const env = { ...process.env, ...(scenario.env ?? {}) };
    const serveScript = resolvePath(consumerRoot, scenario.serveScript);
    const toolsModule = resolvePath(consumerRoot, scenario.toolsModule);
    const args = [serveScript, toolsModule];
    if (scenario.baseUrlEnv) {
        args.push('--base-url-env', scenario.baseUrlEnv);
    }
    const result = spawnSync(process.execPath, args, {
        cwd: consumerRoot,
        stdio: 'inherit',
        env
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function runScenario(consumerRoot, config, name) {
    const scenario = config.scenarios[name];
    if (!scenario) {
        console.error(`[dev-smoke] unknown scenario "${name}"`);
        console.error(`[dev-smoke] available: ${Object.keys(config.scenarios).join(', ')}`);
        process.exit(1);
    }

    console.log(`[dev-smoke] ${name} (${scenario.kind})`);
    switch (scenario.kind) {
        case 'smoke-generated':
            runSmokeGenerated(consumerRoot, config, scenario);
            break;
        case 'node-script':
            runNode(consumerRoot, resolvePath(consumerRoot, scenario.script));
            break;
        case 'mcp-serve':
            runMcpServe(consumerRoot, scenario);
            break;
        default:
            console.error(`[dev-smoke] unsupported kind "${scenario.kind}" in scenario "${name}"`);
            process.exit(1);
    }
}

function smokeScenarioNames(config) {
    if (Array.isArray(config.smoke) && config.smoke.length > 0) {
        return config.smoke;
    }
    return Object.entries(config.scenarios)
        .filter(([, scenario]) => scenario.kind === 'smoke-generated')
        .map(([name]) => name);
}

function runSuite(consumerRoot, config, names, label) {
    if (names.length === 0) {
        console.error(`[dev-smoke] no scenarios for ${label}`);
        process.exit(1);
    }
    for (const name of names) {
        runScenario(consumerRoot, config, name);
    }
}

function main() {
    const configPath = path.resolve(process.argv[2] ?? '');
    const consumerRoot = consumerRootFromConfigPath(configPath);
    const arg = process.argv[3];

    if (!configPath || !arg) {
        console.error(
            'Usage: node consumer-dev-smoke.mjs <dev-smoke.config.json> <scenario|--list|--all-smoke|--e2e>'
        );
        process.exit(1);
    }

    const config = loadConfig(configPath);

    if (arg === '--list') {
        for (const name of Object.keys(config.scenarios)) {
            console.log(name);
        }
        return;
    }

    if (arg === '--all-smoke') {
        runSuite(consumerRoot, config, smokeScenarioNames(config), '--all-smoke');
        return;
    }

    if (arg === '--e2e') {
        const suite = config.e2e;
        if (!Array.isArray(suite) || suite.length === 0) {
            console.error('[dev-smoke] config missing non-empty "e2e" array');
            process.exit(1);
        }
        runSuite(consumerRoot, config, suite, '--e2e');
        return;
    }

    runScenario(consumerRoot, config, arg);
}

main();
