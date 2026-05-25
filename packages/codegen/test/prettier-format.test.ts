import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatGeneratedFilesWithPrettier } from '../src/index.js';

let tmpDir: string | undefined;

afterEach(() => {
    if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        tmpDir = undefined;
    }
});

function createTmpDir(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'core2ai-prettier-'));
    return tmpDir;
}

describe('formatGeneratedFilesWithPrettier', () => {
    it('formats generated files with local Prettier config', async () => {
        const dir = createTmpDir();
        fs.writeFileSync(path.join(dir, '.prettierrc'), JSON.stringify({ singleQuote: true, tabWidth: 4 }));
        const filePath = path.join(dir, 'generated.ts');
        fs.writeFileSync(filePath, 'export const value={name:"demo"}\n');

        await formatGeneratedFilesWithPrettier([filePath]);

        expect(fs.readFileSync(filePath, 'utf-8')).toBe("export const value = { name: 'demo' };\n");
    });

    it('respects local Prettier ignore files', async () => {
        const dir = createTmpDir();
        fs.writeFileSync(path.join(dir, '.prettierignore'), 'ignored.ts\n');
        const filePath = path.join(dir, 'ignored.ts');
        const source = 'export const value={name:"demo"}\n';
        fs.writeFileSync(filePath, source);

        await formatGeneratedFilesWithPrettier([filePath]);

        expect(fs.readFileSync(filePath, 'utf-8')).toBe(source);
    });
});
