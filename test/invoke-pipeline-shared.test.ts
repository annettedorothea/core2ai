import { describe, expect, test } from 'vitest';
import { resolveInvokePipelineTier } from '../src/codegen/invoke-pipeline-shared.js';

describe('resolveInvokePipelineTier', () => {
    test('returns none when invoke pipeline is disabled', () => {
        expect(resolveInvokePipelineTier(false, ['a'], ['b'], [])).toBe('none');
    });

    test('returns full when hook tools are present', () => {
        expect(resolveInvokePipelineTier(true, ['a'], [], [])).toBe('full');
        expect(resolveInvokePipelineTier(true, [], ['b'], [])).toBe('full');
        expect(resolveInvokePipelineTier(true, [], [], ['c'])).toBe('full');
    });

    test('returns credential for protected-only modules', () => {
        expect(resolveInvokePipelineTier(true, [], [], [])).toBe('credential');
    });
});
