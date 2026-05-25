export type JsonSchemaDict = Record<string, unknown>;

/** Emits Zod v4 expression source (uses identifier `z` in scope). */
export function emitZodExpression(schema: JsonSchemaDict): string {
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
        return 'z.unknown()';
    }

    if (Array.isArray(schema.anyOf)) {
        return emitUnion(schema.anyOf as JsonSchemaDict[]);
    }
    if (Array.isArray(schema.oneOf)) {
        return emitUnion(schema.oneOf as JsonSchemaDict[]);
    }

    if (schema.type === 'object' && schema.properties !== undefined && typeof schema.properties === 'object' && !Array.isArray(schema.properties)) {
        const props = schema.properties as Record<string, JsonSchemaDict>;
        const required = new Set(
            Array.isArray(schema.required) ? (schema.required as unknown[]).filter((x): x is string => typeof x === 'string') : []
        );
        const entries = Object.entries(props).map(([key, propSchema]) => {
            let inner = emitZodExpression(propSchema);
            if (!required.has(key)) {
                inner = `${inner}.optional()`;
            }
            return `${JSON.stringify(key)}: ${inner}`;
        });
        let obj = `z.object({ ${entries.join(', ')} })`;
        if (schema.additionalProperties === false) {
            obj += '.strict()';
        }
        return withDescribe(obj, schema);
    }

    if (schema.type === 'array') {
        const items = emitZodExpression((schema.items ?? {}) as JsonSchemaDict);
        return withDescribe(`z.array(${items})`, schema);
    }

    if (schema.type === 'string') {
        if (Array.isArray(schema.enum) && schema.enum.length >= 1 && schema.enum.every((e) => typeof e === 'string')) {
            return withDescribe(emitStringPicklist(schema.enum as string[]), schema);
        }
        return withDescribe('z.string()', schema);
    }

    if (schema.type === 'number' || schema.type === 'integer') {
        if (Array.isArray(schema.enum) && schema.enum.length >= 1 && schema.enum.every(isFiniteNumber)) {
            return withDescribe(emitNumberPicklist(schema.enum as number[]), schema);
        }
        return withDescribe('z.number()', schema);
    }

    if (schema.type === 'boolean') {
        return withDescribe('z.boolean()', schema);
    }

    if (schema.type === 'object' && schema.additionalProperties === true) {
        return withDescribe('z.record(z.string(), __core2aiPrimitiveUnion)', schema);
    }

    if (
        schema.type === 'object' &&
        typeof schema.additionalProperties === 'object' &&
        schema.additionalProperties !== null &&
        !Array.isArray(schema.additionalProperties)
    ) {
        const valueType = emitZodExpression(schema.additionalProperties as JsonSchemaDict);
        return withDescribe(`z.record(z.string(), ${valueType})`, schema);
    }

    return 'z.unknown()';
}

function withDescribe(expr: string, schema: JsonSchemaDict): string {
    const desc = schema.description;
    if (typeof desc === 'string' && desc.trim().length > 0) {
        return `${expr}.describe(${JSON.stringify(desc.trim())})`;
    }
    return expr;
}

function emitUnion(parts: JsonSchemaDict[]): string {
    const emitted = parts.map((p) => emitZodExpression(p));
    if (emitted.length === 0) {
        return 'z.never()';
    }
    if (emitted.length === 1) {
        return emitted[0]!;
    }
    return `z.union([${emitted.join(', ')}])`;
}

function emitStringPicklist(strings: readonly string[]): string {
    if (strings.length === 0) {
        return 'z.never()';
    }
    if (strings.length === 1) {
        return `z.literal(${JSON.stringify(strings[0])})`;
    }
    return `z.union([${strings.map((v) => `z.literal(${JSON.stringify(v)})`).join(', ')}])`;
}

function emitNumberPicklist(values: readonly number[]): string {
    if (values.length === 0) {
        return 'z.never()';
    }
    if (values.length === 1) {
        return `z.literal(${values[0]})`;
    }
    return `z.union([${values.map((v) => `z.literal(${v})`).join(', ')}])`;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/** Shared helpers referenced by per-tool Zod schemas in generated modules. */
export function emitGeneratedZodPreamble(): string {
    return `import * as z from 'zod/v4';

const __core2aiPrimitiveUnion = z.union([z.string(), z.number(), z.boolean()]);
`;
}

export function emitInputZodByToolExport(schemasByTool: Record<string, JsonSchemaDict>): string {
    const entries = Object.entries(schemasByTool).map(([toolName, schema]) => {
        return `    ${JSON.stringify(toolName)}: ${emitZodExpression(schema)}`;
    });
    return `export const inputZodByTool = {\n${entries.join(',\n')}\n};`;
}

export function buildInputZodBlock(schemasByTool: Record<string, JsonSchemaDict>): string {
    return `${emitGeneratedZodPreamble()}\n${emitInputZodByToolExport(schemasByTool)}\n`;
}
