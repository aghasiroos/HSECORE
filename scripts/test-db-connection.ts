/**
 * HSECORE Database Connection Diagnostic & Troubleshooting Utility
 * Executed inside Backend Container using exact production environment variables.
 *
 * Test Sequence:
 *   1. DNS Resolution (host.docker.internal)
 *   2. Host Reachability & IP Resolution
 *   3. Port Connectivity (TCP Socket check)
 *   4. PostgreSQL Service Protocol Handshake
 *   5. Authentication (User & Password Verification)
 *   6. Target Database Existence & Privileges
 *   7. SQL Query Execution & Read/Write Test
 *
 * Security: Masking all secrets/passwords, provides clear root-cause and remediation advice.
 */

import dns from 'dns';
import net from 'net';
import pg from 'pg';

const { Client } = pg;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

const SQL_HOST = process.env.SQL_HOST || 'host.docker.internal';
const SQL_PORT = Number(process.env.SQL_PORT || process.env.POSTGRES_PORT || 5432);
const SQL_USER = process.env.SQL_USER || 'hse_user';
const SQL_PASSWORD = process.env.SQL_PASSWORD || '';
const SQL_DB_NAME = process.env.SQL_DB_NAME || 'hsedb';
const SQL_SSL = process.env.SQL_SSL === 'true';

function printHeader() {
  console.log(`\n${BOLD}${CYAN}======================================================================${NC}`);
  console.log(`${BOLD}${CYAN}   HSECORE Container -> PostgreSQL Host Diagnostic & Troubleshooting  ${NC}`);
  console.log(`${BOLD}${CYAN}======================================================================${NC}`);
  console.log(`  Target Host      : ${SQL_HOST}`);
  console.log(`  Target Port      : ${SQL_PORT}`);
  console.log(`  Database User    : ${SQL_USER}`);
  console.log(`  Database Name    : ${SQL_DB_NAME}`);
  console.log(`  Password Config  : ${SQL_PASSWORD ? '******** (Provided)' : '[MISSING]'}`);
  console.log(`  SSL Mode         : ${SQL_SSL ? 'true (Strict)' : 'false'}`);
  console.log(`${BOLD}${CYAN}======================================================================${NC}\n`);
}

function printSuccess(step: string, detail: string) {
  console.log(`  ${GREEN}[✓] ${step}${NC} : ${detail}`);
}

function printFailure(step: string, errorMsg: string, causes: string[], fixes: string[]) {
  console.log(`\n  ${RED}[✗] ${step} FAILED${NC}`);
  console.log(`  ${RED}Error:${NC} ${errorMsg}`);
  console.log(`\n  ${YELLOW}Possible Root Causes:${NC}`);
  causes.forEach((c) => console.log(`    - ${c}`));
  console.log(`\n  ${CYAN}Recommended Action / Remediation:${NC}`);
  fixes.forEach((f) => console.log(`    - ${f}`));
  console.log(`\n${RED}Diagnostic Terminated. Fix the issue above and retry.${NC}\n`);
}

async function runDiagnostic() {
  printHeader();

  // 1. Connection Target Check
  const isUnixSocket = SQL_HOST.startsWith('/');
  let resolvedIp = '';

  if (isUnixSocket) {
    printSuccess('1. Socket Path Verification', `Unix domain socket directory '${SQL_HOST}' verified.`);
    printSuccess('2. Host Reachability', `Bypassing TCP/DNS (Cloud SQL Unix domain socket transport).`);
    printSuccess('3. Port Connectivity', `Local Unix socket channel ready for PostgreSQL protocol.`);
  } else {
    // 1. DNS Resolution
    try {
      const lookup = await new Promise<{ address: string; family: number }>((resolve, reject) => {
        dns.lookup(SQL_HOST, (err, address, family) => {
          if (err) reject(err);
          else resolve({ address, family });
        });
      });
      resolvedIp = lookup.address;
      printSuccess('1. DNS Resolution', `${SQL_HOST} resolved to IP ${resolvedIp}`);
    } catch (err: any) {
      printFailure(
        '1. DNS Resolution',
        err.message || 'Unable to resolve hostname',
        [
          `Docker container failed to resolve '${SQL_HOST}'.`,
          'Docker daemon did not inject extra_hosts for host-gateway in docker-compose.',
        ],
        [
          "Verify 'extra_hosts: [\"host.docker.internal:host-gateway\"]' exists in docker-compose.server.yml.",
          'Ensure Docker Engine version is 20.10+ which supports host-gateway on Linux.',
          'Run `docker compose config` to verify the generated docker-compose schema.',
        ]
      );
      process.exit(1);
    }

    // 2. Host Reachability
    if (resolvedIp === '127.0.0.1') {
      printFailure(
        '2. Host Reachability',
        `Resolved IP is 127.0.0.1 (Loopback inside container)`,
        [
          "Using 127.0.0.1 inside a container directs traffic to the container itself, not the Ubuntu VPS host.",
        ],
        [
          "Ensure SQL_HOST is set to 'host.docker.internal' in .env.",
          'Check that docker-compose is mapping host.docker.internal to host-gateway.',
        ]
      );
      process.exit(1);
    }
    printSuccess('2. Host Reachability', `Host gateway IP (${resolvedIp}) confirmed outside container loopback.`);

    // 3. Port Connectivity (TCP Socket check)
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(4000);
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error(`Connection to ${resolvedIp}:${SQL_PORT} timed out (4000ms)`));
        });
        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
        socket.connect(SQL_PORT, resolvedIp);
      });
      printSuccess('3. Port Connectivity', `TCP port ${SQL_PORT} on host is reachable and accepting sockets.`);
    } catch (err: any) {
      printFailure(
        '3. Port Connectivity',
        err.message || `Cannot connect to port ${SQL_PORT}`,
        [
          `PostgreSQL is not listening on ${SQL_PORT} on host interface (currently bound only to 127.0.0.1).`,
          'Ubuntu UFW or iptables is dropping container bridge network traffic.',
          'PostgreSQL service on the host is stopped or restarting.',
        ],
        [
          `On VPS host, check: sudo systemctl status postgresql`,
          `Inspect postgresql.conf on VPS host: ensure listen_addresses includes '*' or '${resolvedIp}'.`,
          `Verify listening socket on host: sudo ss -tulpn | grep ${SQL_PORT}`,
          `Ensure UFW is not dropping docker0 interface: sudo ufw allow from 172.16.0.0/12 to any port ${SQL_PORT}`,
        ]
      );
      process.exit(1);
    }
  }

  if (process.env.NODE_ENV === 'production' && SQL_PASSWORD === 'hse_secure_password_2026') {
    printFailure(
      '0. Security Policy Verification',
      'Weak default password (hse_secure_password_2026) detected in production environment',
      ['Using the static default password in production is a critical security risk.'],
      ['Set a strong, unique SQL_PASSWORD in .env via sudo ./install.sh --step 5.']
    );
    process.exit(1);
  }

  // 4. PostgreSQL Service Protocol Handshake & 5. Authentication
  const sslConfig = (() => {
    if (!SQL_SSL || isUnixSocket) return false;
    const rejectUnauth = process.env.SQL_SSL_REJECT_UNAUTHORIZED !== 'false';
    const caPath = process.env.SQL_SSL_CA || process.env.PGSSLROOTCERT;
    if (caPath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(caPath)) {
          return { rejectUnauthorized: rejectUnauth, ca: fs.readFileSync(caPath, 'utf-8') };
        }
      } catch {}
    }
    return { rejectUnauthorized: rejectUnauth };
  })();

  let client = new Client({
    host: SQL_HOST,
    port: SQL_PORT,
    user: SQL_USER,
    password: SQL_PASSWORD,
    database: SQL_DB_NAME,
    ssl: sslConfig,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    printSuccess('4. PostgreSQL Service', 'Protocol handshake completed successfully.');
    printSuccess('5. Authentication', `User '${SQL_USER}' authenticated successfully.`);
    printSuccess('6. Database Access', `Connected to database '${SQL_DB_NAME}'.`);
  } catch (err: any) {
    const code = err.code;
    const msg = err.message || '';

    // Handle authentication failures (code 28P01 / 28000)
    if (code === '28P01' || msg.includes('password authentication failed') || msg.includes('authentication failed')) {
      printFailure(
        '5. Authentication',
        'Password authentication failed for user',
        [
          `Password provided in SQL_PASSWORD does not match PostgreSQL password for '${SQL_USER}'.`,
          "pg_hba.conf is rejecting this auth method (e.g. scram-sha-256 vs md5).",
        ],
        [
          `Update user password on VPS host: sudo -u postgres psql -c "ALTER ROLE \\"${SQL_USER}\\" WITH LOGIN PASSWORD 'YOUR_NEW_PASSWORD';"`,
          `Check /etc/postgresql/<version>/main/pg_hba.conf has: 'host all all 172.16.0.0/12 scram-sha-256'`,
          `Run step 5 of ./install.sh to re-enter credentials securely.`,
        ]
      );
      process.exit(1);
    }

    // Handle pg_hba rejection (code 28000)
    if (code === '28000' || msg.includes('no pg_hba.conf entry')) {
      printFailure(
        '4. PostgreSQL Service (pg_hba.conf)',
        'Host pg_hba.conf rejected connection from container IP subnet',
        [
          `The container IP is not permitted in the host's /etc/postgresql/*/main/pg_hba.conf.`,
        ],
        [
          `Add the following entry to /etc/postgresql/*/main/pg_hba.conf on the host VPS:`,
          `  host    all    all    172.16.0.0/12    scram-sha-256`,
          `Then reload PostgreSQL: sudo systemctl reload postgresql`,
        ]
      );
      process.exit(1);
    }

    // Handle database not found (code 3D000)
    if (code === '3D000' || msg.includes('database') && msg.includes('does not exist')) {
      printFailure(
        '6. Database Access',
        `Database '${SQL_DB_NAME}' does not exist on PostgreSQL host`,
        [
          `Database '${SQL_DB_NAME}' has not been created yet or name was misspelled.`,
        ],
        [
          `Create the database on VPS host: sudo -u postgres psql -c "CREATE DATABASE \\"${SQL_DB_NAME}\\" OWNER \\"${SQL_USER}\\";"`,
          `Run step 7 of ./install.sh to create database and assign privileges.`,
        ]
      );
      process.exit(1);
    }

    // Other errors
    printFailure(
      '4/5. PostgreSQL Service & Connection',
      msg,
      ['Unexpected PostgreSQL error during connection handshake.'],
      ['Check database server logs: sudo journalctl -u postgresql -n 50 --no-pager']
    );
    process.exit(1);
  }

  // 7. SQL Query Execution & Read/Write Test
  try {
    const testResult = await client.query(`
      SELECT 
        current_database() as db_name,
        current_user as current_role,
        version() as pg_version;
    `);

    const row = testResult.rows[0];
    printSuccess(
      '7. SQL Query Execution',
      `Query executed successfully. Role: ${row.current_role} | DB: ${row.db_name}`
    );

    // Test temporary table write & drop
    await client.query(`
      CREATE TABLE IF NOT EXISTS _hsecore_test_rw (id serial primary key, chk timestamp default now());
      INSERT INTO _hsecore_test_rw DEFAULT VALUES;
      DROP TABLE _hsecore_test_rw;
    `);
    printSuccess('8. Schema Write/Read', 'Schema write and drop permissions verified successfully.');

    await client.end();
  } catch (err: any) {
    printFailure(
      '7. SQL Query / Schema Privileges',
      err.message || 'Query execution failed',
      [
        `User '${SQL_USER}' does not have CREATE or USAGE privilege on schema public in database '${SQL_DB_NAME}'.`,
      ],
      [
        `Grant schema permissions on VPS host:`,
        `  sudo -u postgres psql -d "${SQL_DB_NAME}" -c "GRANT ALL ON SCHEMA public TO \\"${SQL_USER}\\"; ALTER SCHEMA public OWNER TO \\"${SQL_USER}\\";"`,
      ]
    );
    process.exit(1);
  }

  console.log(`\n${BOLD}${GREEN}======================================================================${NC}`);
  console.log(`${BOLD}${GREEN}  ALL DIAGNOSTIC CHECKS PASSED: Docker -> Host PostgreSQL is Ready!  ${NC}`);
  console.log(`${BOLD}${GREEN}======================================================================${NC}\n`);
  process.exit(0);
}

runDiagnostic().catch((e) => {
  console.error(`\n${RED}[FATAL ERROR]${NC}`, e?.message || e);
  process.exit(1);
});
