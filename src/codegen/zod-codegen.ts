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

    if (
        schema.type === 'object' &&
        schema.properties !== undefined &&
        typeof schema.properties === 'object' &&
        !Array.isArray(schema.properties)
    ) {
        const props = schema.properties as Record<string, JsonSchemaDict>;
        const required = new Set(
            Array.isArray(schema.required)
                ? (schema.required as unknown[]).filter((x): x is string => typeof x === 'string')
                : []
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
        return withDescribe(`z.union([z.array(${items}), z.string()])`, schema);
    }

    if (schema.type === 'string') {
        if (Array.isArray(schema.enum) && schema.enum.length >= 1 && schema.enum.every((e) => typeof e === 'string')) {
            return withDescribe(emitStringPicklist(schema.enum as string[]), schema);
        }
        return withDescribe('z.string()', schema);
    }

    if (schema.type === 'number' || schema.type === 'integer') {
        return emitLlmTolerantNumber(schema, schema.type === 'integer');
    }

    if (schema.type === 'boolean') {
        return withDescribe('z.union([z.boolean(), z.literal("true"), z.literal("false")])', schema);
    }

    if (schema.type === 'object' && schema.additionalProperties === true) {
        return withDescribe('z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))', schema);
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

function formatExampleForDescription(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return JSON.stringify(value);
}

function firstJsonSchemaExampleValue(schema: JsonSchemaDict): unknown | undefined {
    if (Array.isArray(schema.examples) && schema.examples.length > 0) {
        return schema.examples[0];
    }
    if (schema.example !== undefined) {
        return schema.example;
    }
    return undefined;
}

/** Append `(example: …)` to a description when JSON Schema carries example(s) and text does not already. */
export function mergeJsonSchemaExampleIntoDescription(
    description: string | undefined,
    schema: JsonSchemaDict
): string | undefined {
    const trimmed = description?.trim() ?? '';
    if (trimmed.includes('(example:')) {
        return trimmed.length > 0 ? trimmed : undefined;
    }
    const exampleValue = firstJsonSchemaExampleValue(schema);
    if (exampleValue === undefined) {
        return trimmed.length > 0 ? trimmed : undefined;
    }
    const suffix = `(example: ${formatExampleForDescription(exampleValue)})`;
    return trimmed.length > 0 ? `${trimmed} ${suffix}` : suffix;
}

function withDescribe(expr: string, schema: JsonSchemaDict): string {
    const desc = mergeJsonSchemaExampleIntoDescription(
        typeof schema.description === 'string' ? schema.description : undefined,
        schema
    );
    if (desc && desc.length > 0) {
        return `${expr}.describe(${JSON.stringify(desc)})`;
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

/** MCP tool args: models often pass OpenAPI numbers/booleans as JSON strings. */
function emitLlmTolerantNumber(schema: JsonSchemaDict, integer: boolean): string {
    if (Array.isArray(schema.enum) && schema.enum.length >= 1 && schema.enum.every(isFiniteNumber)) {
        const literals = (schema.enum as number[]).flatMap((v) => [
            `z.literal(${v})`,
            `z.literal(${JSON.stringify(String(v))})`
        ]);
        if (literals.length === 1) {
            return withDescribe(literals[0]!, schema);
        }
        return withDescribe(`z.union([${literals.join(', ')}])`, schema);
    }
    const numberBranch = integer ? 'z.number().int()' : 'z.number()';
    return withDescribe(`z.union([${numberBranch}, z.string()])`, schema);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/** Shared helpers referenced by per-tool Zod schemas in generated modules. */
export function emitGeneratedZodPreamble(): string {
    return `import * as z from 'zod/v4';
`;
}

export function emitInputZodByToolExport(schemasByTool: Record<string, JsonSchemaDict>): string {
    const entries = Object.entries(schemasByTool).map(([toolName, schema]) => {
        return `    ${JSON.stringify(toolName)}: ${emitZodExpression(schema)}`;
    });
    return `export const inputZodByTool = {\n${entries.join(',\n')}\n};`;
}

export function buildInputZodBlock(schemasByTool: Record<string, JsonSchemaDict>): string {
    return `${emitInputZodByToolExport(schemasByTool)}\n`;
}
