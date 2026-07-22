import type { DatabaseDialect } from './types.js';

export function parseDatabaseDialect(value: unknown): DatabaseDialect | undefined {
    return value === 'postgres' ||
        value === 'mysql' ||
        value === 'mariadb' ||
        value === 'sqlserver' ||
        value === 'oracle'
        ? value
        : undefined;
}

export function isExpectedDatabaseUrl(connectionString: string, dialect: DatabaseDialect): boolean {
    if (dialect === 'mysql') {
        return connectionString.startsWith('mysql://');
    }
    if (dialect === 'mariadb') {
        return connectionString.startsWith('mariadb://');
    }
    if (dialect === 'sqlserver') {
        return (
            connectionString.startsWith('sqlserver://') ||
            connectionString.startsWith('mssql://') ||
            /^Server=/i.test(connectionString)
        );
    }
    if (dialect === 'oracle') {
        return connectionString.startsWith('oracle://');
    }
    return connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://');
}
