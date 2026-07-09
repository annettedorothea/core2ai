import { describe, expect, test } from 'vitest';
import { resolveAuthPipelineTier } from '../src/codegen/auth-pipeline-shared.js';

describe('resolveAuthPipelineTier', () => {
    test('returns none when auth pipeline is disabled', () => {
        expect(resolveAuthPipelineTier(false, ['a'], ['b'])).toBe('none');
    });

    test('returns full when hook tools are present', () => {
        expect(resolveAuthPipelineTier(true, ['a'], [])).toBe('full');
        expect(resolveAuthPipelineTier(true, [], ['b'])).toBe('full');
    });

    test('returns credential for protected-only modules', () => {
        expect(resolveAuthPipelineTier(true, [], [])).toBe('credential');
    });
});
