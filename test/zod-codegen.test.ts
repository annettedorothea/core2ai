import { describe, expect, test } from 'vitest';
import {
    emitZodExpression,
    enrichJsonSchemaPropertyDescription,
    formatJsonSchemaTypeHint,
    mergeJsonSchemaExampleIntoDescription,
    mergeJsonSchemaTypeIntoDescription
} from '../src/codegen/zod-codegen.js';

describe('formatJsonSchemaTypeHint', () => {
    test('formats primitive and array types', () => {
        expect(formatJsonSchemaTypeHint({ type: 'integer' })).toBe('integer');
        expect(formatJsonSchemaTypeHint({ type: 'array', items: { type: 'string' } })).toBe('array of string');
    });
});

describe('mergeJsonSchemaTypeIntoDescription', () => {
    test('appends type suffix when description is set', () => {
        expect(mergeJsonSchemaTypeIntoDescription('max rows', { type: 'integer' })).toBe('max rows (type: integer)');
    });

    test('does not duplicate when description already mentions type', () => {
        expect(mergeJsonSchemaTypeIntoDescription('max rows (type: integer)', { type: 'integer' })).toBe(
            'max rows (type: integer)'
        );
    });
});

describe('enrichJsonSchemaPropertyDescription', () => {
    test('appends type before example', () => {
        expect(
            enrichJsonSchemaPropertyDescription('max rows', {
                type: 'integer',
                examples: [100]
            })
        ).toBe('max rows (type: integer) (example: 100)');
    });
});

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
        expect(source).toContain('.describe("max rows per page (type: integer) (example: 100)")');
    });

    test('emits number fields as strict Zod types', () => {
        expect(emitZodExpression({ type: 'number' })).toBe('z.number()');
        expect(emitZodExpression({ type: 'integer' })).toBe('z.number().int()');
    });

    test('emits numeric enums as number literals only', () => {
        expect(emitZodExpression({ type: 'integer', enum: [1, 2] })).toBe('z.union([z.literal(1), z.literal(2)])');
    });

    test('emits boolean fields as strict Zod boolean', () => {
        expect(emitZodExpression({ type: 'boolean' })).toBe('z.boolean()');
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
