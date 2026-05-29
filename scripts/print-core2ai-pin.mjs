#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const pinPath = path.join(scriptsDir, 'core2ai-pin.json');
const pin = JSON.parse(fs.readFileSync(pinPath, 'utf-8'));

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(pin, null, 2));
} else {
    console.log(pin.spec);
}
