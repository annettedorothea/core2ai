import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { URI } from 'langium';

/**
 * Shared codegen helpers.
 * Extracted incrementally from api2ai/db2ai CLI code.
 */
export const CORE2AI_CODEGEN_VERSION = '0.0.1';

type CliLangiumDocument = {
    diagnostics?: Array<{
        severity?: number;
        message: string;
        range: {
            start: { line: number };
        };
    }>;
    textDocument: {
        getText(range: unknown): string;
    };
    parseResult?: {
        value?: unknown;
    };
};

type CliLangiumServices = {
    LanguageMetaData: {
        fileExtensions: readonly string[];
    };
    shared: {
        workspace: {
            LangiumDocuments: {
                getOrCreateDocument(uri: unknown): Promise<CliLangiumDocument>;
            };
            DocumentBuilder: {
                build(documents: CliLangiumDocument[], options: { validation: boolean }): Promise<void>;
            };
        };
    };
};

export async function extractDocument(fileName: string, services: CliLangiumServices): Promise<CliLangiumDocument> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(chalk.yellow(`Please choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} does not exist.`));
        process.exit(1);
    }

    const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(
        URI.file(path.resolve(fileName))
    );
    await services.shared.workspace.DocumentBuilder.build([document], { validation: true });

    const validationErrors = (document.diagnostics ?? []).filter((e) => e.severity === 1);
    if (validationErrors.length > 0) {
        console.error(chalk.red('There are validation errors:'));
        for (const validationError of validationErrors) {
            console.error(
                chalk.red(
                    `line ${validationError.range.start.line + 1}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
                )
            );
        }
        process.exit(1);
    }

    return document;
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

export * from './prettier-format.js';
export * from './project-bootstrap.js';
export * from './zod-codegen.js';
