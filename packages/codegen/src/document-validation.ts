import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { URI } from 'langium';
import type { CliLangiumDocument, CliLangiumServices } from './langium-cli-types.js';

export type CliLangiumValidationDiagnostic = {
    severity?: number;
    message: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
};

export type AssertDocumentValidOptions = {
    beforeBuild?: () => void;
    extraErrors?: (
        document: CliLangiumDocument
    ) => Promise<CliLangiumValidationDiagnostic[]> | CliLangiumValidationDiagnostic[];
};

export function collectLangiumDocumentErrors(document: CliLangiumDocument): CliLangiumValidationDiagnostic[] {
    const errors: CliLangiumValidationDiagnostic[] = [];

    for (const parserError of document.parseResult?.parserErrors ?? []) {
        errors.push({
            severity: 1,
            message: parserError.message,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 }
            }
        });
    }

    for (const diagnostic of document.diagnostics ?? []) {
        if (diagnostic.severity === 1) {
            errors.push({
                severity: diagnostic.severity,
                message: diagnostic.message,
                range: {
                    start: {
                        line: diagnostic.range.start.line,
                        character: diagnostic.range.start.character ?? 0
                    },
                    end: {
                        line: diagnostic.range.end?.line ?? diagnostic.range.start.line,
                        character: diagnostic.range.end?.character ?? diagnostic.range.start.character ?? 0
                    }
                }
            });
        }
    }

    return errors;
}

export function printDocumentValidationErrors(
    document: CliLangiumDocument,
    errors: CliLangiumValidationDiagnostic[]
): void {
    for (const diagnostic of errors) {
        const hasRange =
            diagnostic.range.start.line > 0 ||
            diagnostic.range.start.character > 0 ||
            diagnostic.range.end.character > diagnostic.range.start.character;
        const location = hasRange ? `line ${diagnostic.range.start.line + 1}: ` : '';
        const snippet =
            hasRange && diagnostic.range.end.character > diagnostic.range.start.character
                ? ` [${document.textDocument.getText(diagnostic.range)}]`
                : '';
        console.error(chalk.red(`${location}${diagnostic.message}${snippet}`));
    }
}

function reportValidationErrorsAndExit(
    fileName: string,
    document: CliLangiumDocument,
    errors: CliLangiumValidationDiagnostic[]
): never {
    console.error(
        chalk.red(`Cannot generate — fix ${errors.length} validation error(s) in ${path.basename(fileName)} first:`)
    );
    printDocumentValidationErrors(document, errors);
    process.exit(1);
}

export async function assertDocumentValidForGenerate(
    fileName: string,
    services: CliLangiumServices,
    options: AssertDocumentValidOptions = {}
): Promise<CliLangiumDocument> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(chalk.yellow(`Please choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} does not exist.`));
        process.exit(1);
    }

    options.beforeBuild?.();

    const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(
        URI.file(path.resolve(fileName))
    );
    await services.shared.workspace.DocumentBuilder.build([document], { validation: true });

    let errors = collectLangiumDocumentErrors(document);
    if (options.extraErrors) {
        errors = [...errors, ...(await options.extraErrors(document))];
    }

    if (errors.length > 0) {
        reportValidationErrorsAndExit(fileName, document, errors);
    }

    return document;
}
