import { describe, expect, it } from 'vitest';
import { collectLangiumDocumentErrors, printDocumentValidationErrors } from '../src/document-validation.js';
import type { CliLangiumDocument } from '../src/langium-cli-types.js';

describe('document-validation', () => {
    it('collects parser and Langium error diagnostics', () => {
        const document: CliLangiumDocument = {
            textDocument: { getText: () => 'bad' },
            parseResult: {
                parserErrors: [{ message: 'parse failed' }],
                value: {}
            },
            diagnostics: [
                {
                    severity: 1,
                    message: 'toolName must be unique',
                    range: { start: { line: 2, character: 4 }, end: { line: 2, character: 8 } }
                },
                {
                    severity: 2,
                    message: 'warning only',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }
                }
            ]
        };

        const errors = collectLangiumDocumentErrors(document);
        expect(errors).toHaveLength(2);
        expect(errors[0]?.message).toBe('parse failed');
        expect(errors[1]?.message).toBe('toolName must be unique');
        expect(() => printDocumentValidationErrors(document, errors)).not.toThrow();
    });
});
