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

    test('emits number fields as union with string for LLM tool callers', () => {
        expect(emitZodExpression({ type: 'number' })).toBe('z.union([z.number(), z.string()])');
        expect(emitZodExpression({ type: 'integer' })).toBe('z.union([z.number().int(), z.string()])');
    });

    test('emits numeric enums with string literal counterparts', () => {
        expect(emitZodExpression({ type: 'integer', enum: [1, 2] })).toBe(
            'z.union([z.literal(1), z.literal("1"), z.literal(2), z.literal("2")])'
        );
    });

    test('emits array fields as union with string for LLM tool callers', () => {
        expect(
            emitZodExpression({
                type: 'array',
                items: { type: 'string', enum: ['temperature_2m'] }
            })
        ).toBe('z.union([z.array(z.literal("temperature_2m")), z.string()])');
    });
});
