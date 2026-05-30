export type CliLangiumDocument = {
    uri?: { toString(): string };
    diagnostics?: Array<{
        severity?: number;
        message: string;
        range: {
            start: { line: number; character?: number };
            end?: { line: number; character?: number };
        };
    }>;
    textDocument: {
        getText(range: unknown): string;
    };
    parseResult?: {
        value?: unknown;
        parserErrors?: Array<{ message: string }>;
    };
};

export type CliLangiumServices = {
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
