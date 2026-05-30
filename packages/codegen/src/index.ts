import { assertDocumentValidForGenerate } from './document-validation.js';
import type { CliLangiumDocument, CliLangiumServices } from './langium-cli-types.js';
import * as path from 'node:path';

/**
 * Shared codegen helpers.
 * Extracted incrementally from api2ai/db2ai CLI code.
 */
export const CORE2AI_CODEGEN_VERSION = '0.0.4';

export async function extractDocument(fileName: string, services: CliLangiumServices): Promise<CliLangiumDocument> {
    return assertDocumentValidForGenerate(fileName, services);
}

export async function extractAstNode<T>(fileName: string, services: CliLangiumServices): Promise<T> {
    return (await extractDocument(fileName, services)).parseResult?.value as T;
}

export function extractDestinationAndName(destination: string): { destination: string; name: string } {
    return {
        destination: path.dirname(destination),
        name: path.basename(destination)
    };
}

export * from './access-stubs.js';
export * from './document-validation.js';
export * from './langium-cli-types.js';
export * from './prettier-format.js';
export * from './project-bootstrap.js';
export * from './zod-codegen.js';
