import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    assertGeneratedToolsDestinationMatchesHostProduct,
    relativeImportToLoggingAdapter,
    relativeJsImportPath,
    resolveGeneratedCliDir,
    resolveGeneratedToolsPath,
    resolveHostProductFromGeneratedToolsPath,
    resolveProjectRootFromGeneratedCliDir
} from '../src/codegen/generated-layout.js';

const projectRoot = '/workspace/demo';

describe('generated-layout', () => {
    it('resolveGeneratedToolsPath nests under product', () => {
        expect(resolveGeneratedToolsPath(projectRoot, 'api2ai', 'github')).toBe(
            path.join(projectRoot, 'generated', 'api2ai', 'tools', 'github-tools.ts')
        );
    });

    it('resolveHostProductFromGeneratedToolsPath reads product segment', () => {
        const toolsPath = path.join(projectRoot, 'generated', 'db2ai', 'tools', 'sakila-tools.ts');
        expect(resolveHostProductFromGeneratedToolsPath(toolsPath)).toBe('db2ai');
    });

    it('resolveHostProductFromGeneratedToolsPath rejects flat legacy layout', () => {
        const legacy = path.join(projectRoot, 'generated', 'tools', 'github-tools.ts');
        expect(() => resolveHostProductFromGeneratedToolsPath(legacy)).toThrow(/Unknown host product/);
    });

    it('resolveGeneratedCliDir pairs tools with sibling cli folder', () => {
        const toolsPath = path.join(projectRoot, 'generated', 'api2ai', 'tools', 'open-meteo-tools.ts');
        expect(resolveGeneratedCliDir(toolsPath)).toBe(path.join(projectRoot, 'generated', 'api2ai', 'cli'));
    });

    it('resolveProjectRootFromGeneratedCliDir walks up from nested cli', () => {
        const cliDir = path.join(projectRoot, 'generated', 'api2ai', 'cli');
        expect(resolveProjectRootFromGeneratedCliDir(cliDir)).toBe(path.resolve(projectRoot));
    });

    it('relativeJsImportPath emits posix .js spec', () => {
        const from = path.join(projectRoot, 'generated', 'api2ai', 'tools', 'github-tools.ts');
        const to = path.join(projectRoot, 'src', 'hooks', 'api2ai', 'github-tools', 'verifyGithubCredential.ts');
        expect(relativeJsImportPath(from, to)).toBe('../../../src/hooks/api2ai/github-tools/verifyGithubCredential.js');
    });

    it('relativeImportToLoggingAdapter from nested tools module', () => {
        const from = path.join(projectRoot, 'generated', 'api2ai', 'tools', 'github-tools.ts');
        expect(relativeImportToLoggingAdapter(from, projectRoot)).toBe('../../../src/utils/logging-adapter.js');
    });

    it('assertGeneratedToolsDestinationMatchesHostProduct passes on match', () => {
        const toolsPath = path.join(projectRoot, 'generated', 'api2ai', 'tools', 'github-tools.ts');
        expect(() => assertGeneratedToolsDestinationMatchesHostProduct(toolsPath, 'api2ai')).not.toThrow();
    });

    it('assertGeneratedToolsDestinationMatchesHostProduct fails on mismatch', () => {
        const toolsPath = path.join(projectRoot, 'generated', 'db2ai', 'tools', 'sakila-tools.ts');
        expect(() => assertGeneratedToolsDestinationMatchesHostProduct(toolsPath, 'api2ai')).toThrow(
            /this CLI generates "api2ai"/
        );
    });
});
