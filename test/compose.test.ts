import { describe, expect, test } from 'vitest';
import { compose } from '../src/codegen/compose.js';

describe('compose', () => {
    test('replaces named slots', () => {
        const out = compose('<<imports>>\n<<body>>', {
            imports: "import * as fs from 'node:fs';",
            body: 'export const x = 1;'
        });
        expect(out).toBe("import * as fs from 'node:fs';\nexport const x = 1;");
    });

    test('throws on missing slots', () => {
        expect(() => compose('<<a>> <<b>>', { a: 'ok' })).toThrow(/missing slots: b/);
    });

    test('reports all missing slots', () => {
        expect(() => compose('<<a>> <<b>>', {})).toThrow(/missing slots:.*a.*b/);
    });
});
