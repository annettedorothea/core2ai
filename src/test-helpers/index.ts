import { expect } from 'vitest';

/** Vitest assertion: value is a non-null object record. */
export function asRecord(value: unknown): Record<string, unknown> {
    expect(value).toBeTypeOf('object');
    expect(value).not.toBeNull();
    return value as Record<string, unknown>;
}

/** Restore `process.env[name]` after a test fixture (delete if previously unset). */
export function restoreEnv(name: string, previousValue: string | undefined): void {
    if (previousValue === undefined) {
        delete process.env[name];
        return;
    }
    process.env[name] = previousValue;
}
