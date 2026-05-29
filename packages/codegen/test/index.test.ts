import { describe, expect, it } from 'vitest';
import { CORE2AI_CODEGEN_VERSION } from '../src/index.js';

describe('@core2ai/codegen', () => {
    it('exports a version marker', () => {
        expect(CORE2AI_CODEGEN_VERSION).toBe('0.0.3');
    });
});
