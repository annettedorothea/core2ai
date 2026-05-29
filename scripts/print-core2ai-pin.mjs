#!/usr/bin/env node
import * as path from 'node:path';
import { loadPin } from './resolve-core2ai-scripts.mjs';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const json = args.includes('--json');
const positional = args.filter((arg) => !arg.startsWith('-'));
const consumerRoot = positional[0] ? path.resolve(positional[0]) : process.cwd();

try {
    const { pin, source } = loadPin(consumerRoot);
    if (json) {
        console.log(JSON.stringify({ ...pin, source }, null, 2));
    } else {
        console.log(pin.spec);
        if (verbose) {
            console.error(`[core2ai:pin] source: ${source}`);
        }
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
