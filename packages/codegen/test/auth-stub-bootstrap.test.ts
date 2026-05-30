import { describe, expect, it } from 'vitest';
import {
    renderAuthStubFileContent,
    renderParameterCheckerImports,
    renderParameterCheckersMap
} from '../src/auth-stub-bootstrap.js';

describe('auth-stub-bootstrap', () => {
    it('renders stub file with parameter check export name', () => {
        const content = renderAuthStubFileContent('listOrders', 'api2ai-invoke-options');
        expect(content).toContain('export function checkListOrdersParameters');
        expect(content).toContain("from './api2ai-invoke-options.js'");
    });

    it('renders parameter checker imports and map', () => {
        const stubPaths = new Map([['listOrders', '/project/src/auth/listOrders.mjs']]);
        const imports = renderParameterCheckerImports('/project/out/tools.ts', stubPaths, true);
        expect(imports).toContain("import { checkListOrdersParameters } from '../src/auth/listOrders.js';");

        const map = renderParameterCheckersMap(stubPaths, true);
        expect(map).toContain('"listOrders": checkListOrdersParameters');
    });
});
