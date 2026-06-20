import { describe, expect, test } from 'vitest';
import { emitZodExpression, mergeJsonSchemaExampleIntoDescription } from '../src/codegen/zod-codegen.js';

describe('mergeJsonSchemaExampleIntoDescription', () => {
    test('appends example suffix when description is set', () => {
        expect(
            mergeJsonSchemaExampleIntoDescription('max rows', {
                examples: [100]
            })
        ).toBe('max rows (example: 100)');
    });

    test('uses example alone when description is empty', () => {
        expect(
            mergeJsonSchemaExampleIntoDescription(undefined, {
                examples: ['open']
            })
        ).toBe('(example: open)');
    });

    test('does not duplicate when description already mentions example', () => {
        expect(
            mergeJsonSchemaExampleIntoDescription('filter (example: open)', {
                examples: ['done']
            })
        ).toBe('filter (example: open)');
    });
});

describe('emitZodExpression', () => {
    test('includes merged example in field describe', () => {
        const source = emitZodExpression({
            type: 'object',
            properties: {
                limit: {
                    type: 'integer',
                    description: 'max rows per page',
                    examples: [100]
                }
            },
            required: ['limit'],
            additionalProperties: false
        });
        expect(source).toContain('.describe("max rows per page (example: 100)")');
    });
});
