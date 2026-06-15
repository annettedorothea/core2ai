import { GENERATED_SCRIPTS_BANNER } from './generated-scripts-banner.js';

export function renderKillListenersOnPortMjsSource(): string {
    return `${GENERATED_SCRIPTS_BANNER}/**
 * Kill only TCP listeners on a port (not clients connected to that port).
 */
import { execSync } from 'node:child_process';

/**
 * @param {number} port
 * @returns {string[]}
 */
function listListenerPids(port) {
    try {
        const raw = execSync(\`lsof -nP -iTCP:\${port} -sTCP:LISTEN -t\`, { encoding: 'utf8' }).trim();
        if (!raw) {
            return [];
        }
        return raw.split('\\n').filter(Boolean);
    } catch (err) {
        const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined;
        if (status === 1) {
            return [];
        }
        throw err;
    }
}

/**
 * @param {string} pid
 * @returns {string}
 */
function processCommand(pid) {
    try {
        return execSync(\`ps -p \${pid} -o comm=\`, { encoding: 'utf8' }).trim();
    } catch {
        return '';
    }
}

function isNodeListener(pid) {
    const comm = processCommand(pid).toLowerCase();
    return comm === 'node' || comm.endsWith('/node');
}

/**
 * @param {number} port
 * @param {{ logPrefix?: string, nodeOnly?: boolean }} [options]
 * @returns {{ killed: string[], skipped: string[] }}
 */
export function killListenersOnPort(port, options = {}) {
    const logPrefix = options.logPrefix ?? 'kill';
    const nodeOnly = options.nodeOnly !== false;
    const pids = listListenerPids(port);
    if (pids.length === 0) {
        console.log(\`[\${logPrefix}] port \${port}: nothing listening\`);
        return { killed: [], skipped: [] };
    }

    const killed = [];
    const skipped = [];
    for (const pid of pids) {
        if (nodeOnly && !isNodeListener(pid)) {
            const comm = processCommand(pid) || 'unknown';
            skipped.push(pid);
            console.warn(\`[\${logPrefix}] port \${port}: skip pid \${pid} (\${comm}) — not a node listener\`);
            continue;
        }
        execSync(\`kill \${pid}\`);
        killed.push(pid);
    }

    if (killed.length > 0) {
        console.log(\`[\${logPrefix}] port \${port}: stopped \${killed.join(', ')}\`);
    }
    if (killed.length === 0 && skipped.length > 0) {
        console.log(\`[\${logPrefix}] port \${port}: no node listener stopped\`);
    }
    return { killed, skipped };
}
`;
}
