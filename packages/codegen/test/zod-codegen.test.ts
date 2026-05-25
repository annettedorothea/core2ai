import { describe, expect, it } from 'vitest';
import { emitInputZodByToolExport, emitZodExpression, type JsonSchemaDict } from '../src/index.js';

describe('json-schema-to-zod-codegen', () => {
    it('emits object with optional fields and strict', () => {
        const schema: JsonSchemaDict = {
            type: 'object',
            properties: {
                query: { type: 'string' }
            },
            required: [],
            additionalProperties: false
        };
        expect(emitZodExpression(schema)).toBe('z.object({ "query": z.string().optional() }).strict()');
    });

    it('emits string enum as union of literals', () => {
        const schema: JsonSchemaDict = {
            type: 'string',
            enum: ['a', 'b']
        };
        expect(emitZodExpression(schema)).toBe('z.union([z.literal("a"), z.literal("b")])');
    });

    it('emits inputZodByTool export', () => {
        const out = emitInputZodByToolExport({
            demo: { type: 'object', properties: {}, additionalProperties: true }
        });
        expect(out).toContain('export const inputZodByTool');
        expect(out).toContain('"demo"');
    });
});
