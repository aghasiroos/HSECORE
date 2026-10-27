import pg from 'pg';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const { Client } = pg;

async function main() {
  let username = process.env.ADMIN_USER?.trim().toLowerCase();
  let password = process.env.ADMIN_PASS || '';
  let email = process.env.ADMIN_EMAIL?.trim();
  let fullName = process.env.ADMIN_NAME?.trim();
  let role = process.env.ADMIN_ROLE?.trim() || 'Administrator';

  let rl = null;
  const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

  // If credentials are not provided via environment variables, prompt interactively
  if (!username || !password) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n========================================');
    console.log('   HSECORE CLI - Create or Update User  ');
    console.log('========================================\n');

    if (!username) {
      username = (await ask('Enter Username: ')).trim().toLowerCase();
      if (!username) {
        console.error('Error: Username is required!');
        process.exit(1);
      }
    }

    if (!password) {
      password = await ask('Enter Password: ');
      if (!password || password.length < 4) {
        console.error('Error: Password must be at least 4 characters!');
        process.exit(1);
      }
    }

    if (!email) {
      email = (await ask(`Enter Email [${username}@hsecore.local]: `)).trim() || `${username}@hsecore.local`;
    }
    if (!fullName) {
      fullName = (await ask('Enter Full Name [کاربر سیستم]: ')).trim() || 'کاربر سیستم';
    }
    if (!role) {
      role = (await ask('Enter Role (Administrator/User) [Administrator]: ')).trim() || 'Administrator';
    }
  } else {
    if (!email) email = `${username}@hsecore.local`;
    if (!fullName) fullName = 'مدیر ارشد سامانه';
  }

  function normalizeDigits(str) {
    if (!str) return '';
    return String(str)
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  }

  // Inside the container, environment variables are loaded
  const client = new Client({
    host: process.env.SQL_HOST || 'host.docker.internal',
    port: parseInt(process.env.SQL_PORT || process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.SQL_USER || 'hse_user',
    password: process.env.SQL_PASSWORD || 'hse_secure_password_2026',
    database: process.env.SQL_DB_NAME || 'hsedb'
  });

  try {
    await client.connect();

    username = normalizeDigits(username).toLowerCase().trim();
    const cleanPassword = normalizeDigits(password);
    const hash = bcrypt.hashSync(cleanPassword, 10);
    const isAdmin = role.toLowerCase().includes('admin') || role.includes('مدیرارشد') || role.includes('مدیرسیستم');
    const perms = isAdmin ? JSON.stringify({ all: true }) : JSON.stringify({
      Dashboard: { view: true },
      'Heat Stress': { view: true, create: true },
      'TRIR Incident Rate': { view: true, create: true, print: true, export: true },
      'Safety Warnings': { view: true, create: true, print: true },
      'Permit To Work': { view: true, create: true, print: true, export: true },
      'PTW Audit': { view: true, create: true },
      Incidents: { view: true, create: true, print: true, export: true },
      PPE: { view: true, create: true },
      Training: { view: true, create: true },
      'Risk Assessment': { view: true, create: true },
      'Personnel 360': { view: true },
      Reports: { view: true, print: true, export: true },
      Notifications: { view: true }
    });

    // Check if user already exists
    const checkRes = await client.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);

    if (checkRes.rows.length > 0) {
      await client.query(
        'UPDATE users SET password_hash = $1, role = $2, full_name = $3, is_active = true, account_status = \'Active\', permissions = $4, updated_at = NOW() WHERE LOWER(username) = LOWER($5)',
        [hash, role, fullName, perms, username]
      );
      console.log(`[✓] Successfully updated existing user "${username}" (${role}) in database.`);
    } else {
      const uid = 'user-' + Math.random().toString(36).substring(2, 11);
      await client.query(
        'INSERT INTO users (uid, username, email, full_name, role, account_status, is_active, password_hash, permissions, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())',
        [uid, username, email, fullName, role, 'Active', true, hash, perms]
      );
      console.log(`[✓] Successfully registered initial user "${username}" (${role}) in database.`);
    }
  } catch (err) {
    console.error('\n[✗] Database Connection or User Registration Error:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
    if (rl) rl.close();
  }
}

main();
