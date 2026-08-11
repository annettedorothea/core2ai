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

    if (schema.type === 'object') {
        const props =
            schema.properties !== undefined &&
            typeof schema.properties === 'object' &&
            !Array.isArray(schema.properties)
                ? (schema.properties as Record<string, JsonSchemaDict>)
                : undefined;
        const namedEntries = props ? Object.entries(props) : [];

        if (namedEntries.length > 0) {
            const required = new Set(
                Array.isArray(schema.required)
                    ? (schema.required as unknown[]).filter((x): x is string => typeof x === 'string')
                    : []
            );
            const entries = namedEntries.map(([key, propSchema]) => {
                let inner = emitZodExpression(propSchema);
                if (!required.has(key)) {
                    inner = `${inner}.optional()`;
                }
                return `${JSON.stringify(key)}: ${inner}`;
            });
            const obj = applyAdditionalPropertiesModifier(
                `z.object({ ${entries.join(', ')} })`,
                schema.additionalProperties
            );
            return withDescribe(obj, schema);
        }

        if (schema.additionalProperties === true) {
            return withDescribe('z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))', schema);
        }

        if (
            typeof schema.additionalProperties === 'object' &&
            schema.additionalProperties !== null &&
            !Array.isArray(schema.additionalProperties)
        ) {
            const valueType = emitZodExpression(schema.additionalProperties as JsonSchemaDict);
            return withDescribe(`z.record(z.string(), ${valueType})`, schema);
        }

        // Explicit empty `properties` and/or `additionalProperties: false` → object; bare `{ type: 'object' }` stays unknown.
        if (props !== undefined || schema.additionalProperties === false) {
            const empty = applyAdditionalPropertiesModifier('z.object({})', schema.additionalProperties);
            return withDescribe(empty, schema);
        }
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
        return emitStrictNumber(schema, schema.type === 'integer');
    }

    if (schema.type === 'boolean') {
        return withDescribe('z.boolean()', schema);
    }

    return 'z.unknown()';
}

/** Append Zod unknown-key policy from JSON Schema `additionalProperties`. */
function applyAdditionalPropertiesModifier(objectExpr: string, additionalProperties: unknown): string {
    if (additionalProperties === false) {
        return `${objectExpr}.strict()`;
    }
    if (additionalProperties === true) {
        return `${objectExpr}.passthrough()`;
    }
    if (
        typeof additionalProperties === 'object' &&
        additionalProperties !== null &&
        !Array.isArray(additionalProperties)
    ) {
        return `${objectExpr}.catchall(${emitZodExpression(additionalProperties as JsonSchemaDict)})`;
    }
    return objectExpr;
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

/** Type label for MCP tool/input descriptions (LLM-facing prose), e.g. `integer`, `array of string`. */
export function formatJsonSchemaTypeHint(schema: JsonSchemaDict): string | undefined {
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
        return undefined;
    }

    if (schema.type === 'array') {
        const items =
            schema.items !== undefined && typeof schema.items === 'object' && !Array.isArray(schema.items)
                ? formatJsonSchemaTypeHint(schema.items as JsonSchemaDict)
                : undefined;
        return items ? `array of ${items}` : 'array';
    }

    if (schema.type === 'integer') {
        return 'integer';
    }
    if (schema.type === 'number') {
        return 'number';
    }
    if (schema.type === 'string') {
        return 'string';
    }
    if (schema.type === 'boolean') {
        return 'boolean';
    }

    return undefined;
}

function appendDescriptionSuffix(description: string, suffix: string): string {
    return description.length > 0 ? `${description} ${suffix}` : suffix;
}

/** Append `(type: …)` when JSON Schema carries a known type and text does not already mention it. */
export function mergeJsonSchemaTypeIntoDescription(
    description: string | undefined,
    schema: JsonSchemaDict
): string | undefined {
    const trimmed = description?.trim() ?? '';
    if (trimmed.includes('(type:')) {
        return trimmed.length > 0 ? trimmed : undefined;
    }
    const hint = formatJsonSchemaTypeHint(schema);
    if (!hint) {
        return trimmed.length > 0 ? trimmed : undefined;
    }
    return appendDescriptionSuffix(trimmed, `(type: ${hint})`);
}

/** Parameter prose for MCP tool descriptions — always includes `(type: …)` when known. */
export function formatMcpParameterDescriptionLine(
    description: string | undefined,
    schema: JsonSchemaDict
): string | undefined {
    const withType = mergeJsonSchemaTypeIntoDescription(description, schema);
    return mergeJsonSchemaExampleIntoDescription(withType, schema);
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
    return appendDescriptionSuffix(trimmed, suffix);
}

/** Merge type and example suffixes onto a JSON Schema property description for MCP input schemas. */
export function enrichJsonSchemaPropertyDescription(
    description: string | undefined,
    schema: JsonSchemaDict
): string | undefined {
    const trimmed = description?.trim() ?? '';
    const withType = trimmed.length > 0 ? mergeJsonSchemaTypeIntoDescription(trimmed, schema) : trimmed;
    const base = withType !== undefined && withType.length > 0 ? withType : undefined;
    return mergeJsonSchemaExampleIntoDescription(base, schema);
}

function withDescribe(expr: string, schema: JsonSchemaDict): string {
    const desc = enrichJsonSchemaPropertyDescription(
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

/** Strict OpenAPI number/integer for MCP tool args (invalid types fail at MCP validation). */
function emitStrictNumber(schema: JsonSchemaDict, integer: boolean): string {
    if (Array.isArray(schema.enum) && schema.enum.length >= 1 && schema.enum.every(isFiniteNumber)) {
        const literals = (schema.enum as number[]).map((v) => `z.literal(${v})`);
        if (literals.length === 1) {
            return withDescribe(literals[0]!, schema);
        }
        return withDescribe(`z.union([${literals.join(', ')}])`, schema);
    }
    const numberBranch = integer ? 'z.number().int()' : 'z.number()';
    return withDescribe(numberBranch, schema);
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
