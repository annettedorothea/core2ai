import { describe, expect, test } from 'vitest';
import { decodeJwtPayloadUnsafe, resolveCredentialAndOptionalJwt, resolveCredentialFromEnv } from '../src/jwt.js';

describe('jwt', () => {
    test('decodeJwtPayloadUnsafe decodes payload segment', () => {
        const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ sub: 'alice', role: 'admin' })).toString('base64url');
        const token = `${header}.${payload}.sig`;
        expect(decodeJwtPayloadUnsafe(token)).toEqual({ sub: 'alice', role: 'admin' });
    });

    test('resolveCredentialFromEnv reads process.env', () => {
        const prev = process.env.TEST_AUTH_TOKEN;
        process.env.TEST_AUTH_TOKEN = '  secret  ';
        try {
            expect(resolveCredentialFromEnv('TEST_AUTH_TOKEN')).toBe('secret');
            expect(resolveCredentialFromEnv(undefined)).toBeUndefined();
        } finally {
            if (prev === undefined) {
                delete process.env.TEST_AUTH_TOKEN;
            } else {
                process.env.TEST_AUTH_TOKEN = prev;
            }
        }
    });

    test('resolveCredentialAndOptionalJwt returns jwt for three-part token', () => {
        const header = Buffer.from('{}').toString('base64url');
        const payload = Buffer.from(JSON.stringify({ tenantId: 't1' })).toString('base64url');
        const token = `${header}.${payload}.sig`;
        const prev = process.env.TEST_JWT_ENV;
        process.env.TEST_JWT_ENV = token;
        try {
            expect(resolveCredentialAndOptionalJwt('TEST_JWT_ENV')).toEqual({
                credential: token,
                jwt: { tenantId: 't1' }
            });
        } finally {
            if (prev === undefined) {
                delete process.env.TEST_JWT_ENV;
            } else {
                process.env.TEST_JWT_ENV = prev;
            }
        }
    });

    test('resolveCredentialAndOptionalJwt omits jwt for non-JWT credential', () => {
        const prev = process.env.TEST_PLAIN_ENV;
        process.env.TEST_PLAIN_ENV = 'api-key-not-jwt';
        try {
            expect(resolveCredentialAndOptionalJwt('TEST_PLAIN_ENV')).toEqual({
                credential: 'api-key-not-jwt'
            });
        } finally {
            if (prev === undefined) {
                delete process.env.TEST_PLAIN_ENV;
            } else {
                process.env.TEST_PLAIN_ENV = prev;
            }
        }
    });
});
