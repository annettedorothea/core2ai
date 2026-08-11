import { describe, expect, test } from 'vitest';
import * as z from 'zod/v4';
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

    test('emits named props with additionalProperties false as strict', () => {
        expect(
            emitZodExpression({
                type: 'object',
                properties: { title: { type: 'string' } },
                required: ['title'],
                additionalProperties: false
            })
        ).toBe('z.object({ "title": z.string() }).strict()');
    });

    test('emits named props with additionalProperties true as passthrough', () => {
        expect(
            emitZodExpression({
                type: 'object',
                properties: { title: { type: 'string' } },
                required: ['title'],
                additionalProperties: true
            })
        ).toBe('z.object({ "title": z.string() }).passthrough()');
    });

    test('emits named props with typed additionalProperties as catchall', () => {
        const labeledValue = {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false
        };
        expect(
            emitZodExpression({
                type: 'object',
                properties: {
                    title: labeledValue,
                    region: labeledValue
                },
                required: ['title'],
                additionalProperties: labeledValue
            })
        ).toBe(
            'z.object({ "title": z.object({ "value": z.string() }).strict(), "region": z.object({ "value": z.string() }).strict().optional() }).catchall(z.object({ "value": z.string() }).strict())'
        );
    });

    test('emits empty properties with typed additionalProperties as record', () => {
        expect(
            emitZodExpression({
                type: 'object',
                properties: {},
                additionalProperties: { type: 'string' }
            })
        ).toBe('z.record(z.string(), z.string())');
    });

    test('safeParse keeps unknown keys when catchall is emitted', () => {
        const labeledValue = {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false
        };
        const expr = emitZodExpression({
            type: 'object',
            properties: {
                title: labeledValue,
                region: labeledValue,
                category: labeledValue
            },
            required: ['title', 'region', 'category'],
            additionalProperties: labeledValue
        });
        const schema = new Function('z', `return (${expr})`)(z) as z.ZodTypeAny;
        const parsed = schema.safeParse({
            title: { value: 'Demo title' },
            region: { value: 'north' },
            category: { value: 'general' },
            customTag: { value: 'extra-1' },
            sourceCode: { value: 'SRC-9' }
        });
        expect(parsed.success).toBe(true);
        if (!parsed.success) {
            return;
        }
        expect(parsed.data.customTag).toEqual({ value: 'extra-1' });
        expect(parsed.data.sourceCode).toEqual({ value: 'SRC-9' });
    });
});
