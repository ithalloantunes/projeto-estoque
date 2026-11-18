import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, '.runtime'), { recursive: true });
// PostgreSQL bootstrap on Windows needs an ASCII path when the user name has accents.
const runtime = process.platform === 'win32'
  ? execFileSync('cmd.exe', ['/d', '/c', 'for %I in (.runtime) do @echo %~sI'], {
    cwd: root, windowsHide: true, encoding: 'utf8',
  }).trim()
  : path.join(root, '.runtime');
const logs = path.join(runtime, 'logs');
const data = path.join(runtime, 'pgdata');
const bin = path.join(runtime, 'postgres', 'pgsql', 'bin');
const configFile = path.join(runtime, 'local-config.json');
const pidFile = path.join(runtime, 'server.pid');
const command = process.argv[2] || 'start';
const exists = file => fs.existsSync(file);
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const runPg = (name, args, env = process.env) => execFileSync(path.join(bin, `${name}.exe`), args, {
  env, windowsHide: true, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
});
const databaseRunning = () => {
  try { runPg('pg_ctl', ['-D', data, 'status']); return true; } catch { return false; }
};
const getHealth = async config => {
  try {
    const response = await fetch(`http://127.0.0.1:${config.appPort}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    const body = await response.json();
    return response.ok && body.service === 'acai-stock' && body.status === 'ok' ? body : null;
  } catch { return null; }
};
const readHealth = async config => (await getHealth(config))?.instanceId === config.instanceId;
const processExists = pid => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};
const printAccess = config => {
  console.log(`Sistema: http://localhost:${config.appPort}`);
  console.log(`Usuario local: ${config.adminUsername}`);
  console.log(`Senha local: ${config.adminPassword}`);
  console.log('Credenciais e configuracao: .runtime/local-config.json');
};

async function start() {
  if (process.platform !== 'win32') throw new Error('Este iniciador foi preparado para Windows.');
  if (!exists(path.join(bin, 'initdb.exe'))) {
    throw new Error('PostgreSQL local ausente. Consulte README-LOCAL.md para instalar os binarios oficiais.');
  }
  fs.mkdirSync(logs, { recursive: true });
  if (!exists(configFile)) {
    writeJson(configFile, {
      database: 'acai_local', databaseUser: 'acai_local',
      databasePassword: crypto.randomBytes(24).toString('hex'),
      databasePort: 55432, appPort: 3000,
      adminUsername: 'admin.local', adminPassword: crypto.randomBytes(12).toString('base64url'),
      recoveryCode: crypto.randomBytes(12).toString('hex'),
      instanceId: crypto.randomUUID(),
    });
  }
  const config = readJson(configFile);
  if (!exists(path.join(data, 'PG_VERSION'))) {
    const passwordFile = path.join(runtime, 'initdb-password.txt');
    fs.writeFileSync(passwordFile, config.databasePassword, 'utf8');
    try {
      console.log('Preparando banco PostgreSQL local...');
      runPg('initdb', ['-D', data, '-U', config.databaseUser, '-E', 'UTF8', '--locale=C',
        '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', `--pwfile=${passwordFile}`]);
    } finally { fs.unlinkSync(passwordFile); }
  }
  if (!databaseRunning()) {
    console.log('Iniciando PostgreSQL...');
    const pgLog = fs.openSync(path.join(logs, 'postgres.log'), 'a');
    let databaseProcess;
    try {
      databaseProcess = spawn(path.join(bin, 'postgres.exe'),
        ['-D', data, '-h', '127.0.0.1', '-p', String(config.databasePort)], {
          detached: true, windowsHide: true, stdio: ['ignore', pgLog, pgLog],
        });
      databaseProcess.unref();
    } finally { fs.closeSync(pgLog); }
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        runPg('pg_isready', ['-h', '127.0.0.1', '-p', String(config.databasePort),
          '-U', config.databaseUser, '-d', config.database]);
        ready = true;
        break;
      } catch { /* Wait for the database to accept local connections. */ }
      if (!processExists(databaseProcess.pid)) break;
      await delay(500);
    }
    if (!ready) throw new Error('PostgreSQL nao iniciou. Consulte .runtime/logs/postgres.log.');
  }
  const dbOptions = {
    host: '127.0.0.1', port: config.databasePort, user: config.databaseUser,
    password: config.databasePassword, ssl: false, connectionTimeoutMillis: 5000,
  };
  const adminPool = new Pool({ ...dbOptions, database: 'postgres' });
  try {
    const { rows } = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
    if (!rows.length) {
      if (config.database !== 'acai_local') throw new Error('Nome inesperado para o banco local.');
      await adminPool.query('CREATE DATABASE acai_local');
    }
  } finally { await adminPool.end(); }
  const pool = new Pool({ ...dbOptions, database: config.database });
  try {
    await pool.query(fs.readFileSync(path.join(root, 'db', 'schema.sql'), 'utf8'));
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT');
    await pool.query(`INSERT INTO users
      (id, username, username_lower, password_hash, role, approved, recovery_code_hash)
      VALUES ($1, $2, $3, $4, 'admin', TRUE, $5) ON CONFLICT (username_lower) DO NOTHING`, [
      crypto.randomUUID(), config.adminUsername, config.adminUsername.toLowerCase(),
      bcrypt.hashSync(config.adminPassword, 10), bcrypt.hashSync(config.recoveryCode, 10),
    ]);
  } finally { await pool.end(); }
  if (await readHealth(config)) {
    console.log('O sistema ja esta em execucao.');
    printAccess(config);
    return;
  }
  if (exists(pidFile) && processExists(Number(fs.readFileSync(pidFile, 'utf8')))) {
    throw new Error('O processo anterior ainda esta ativo. Confira os logs antes de iniciar novamente.');
  }
  const stdout = fs.openSync(path.join(logs, 'server.log'), 'a');
  const stderr = fs.openSync(path.join(logs, 'server-error.log'), 'a');
  const connectionString = `postgresql://${encodeURIComponent(config.databaseUser)}:${encodeURIComponent(config.databasePassword)}@127.0.0.1:${config.databasePort}/${config.database}`;
  let child;
  try {
    child = spawn(process.execPath, ['server.js'], {
      cwd: root, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr],
      env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1',
        PORT: String(config.appPort), DATABASE_URL: connectionString,
        DATABASE_SSL: 'disable', LOCAL_DATABASE_ONLY: 'true', LOCAL_INSTANCE_ID: config.instanceId },
    });
    fs.writeFileSync(pidFile, String(child.pid));
    child.unref();
  } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await readHealth(config)) {
      console.log('Sistema e banco de dados iniciados.');
      printAccess(config);
      return;
    }
    if (!processExists(child.pid)) break;
    await delay(500);
  }
  throw new Error('O servidor nao iniciou. Consulte .runtime/logs/server-error.log.');
}

async function stop() {
  if (exists(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('PID do servidor invalido.');
    if (processExists(pid)) {
      const config = readJson(configFile);
      const health = await getHealth(config);
      if (!health || health.pid !== pid || health.instanceId !== config.instanceId) {
        throw new Error('Nao foi possivel confirmar a identidade do servidor. Nenhum processo foi encerrado.');
      }
      process.kill(pid, 'SIGTERM');
      for (let attempt = 0; attempt < 20 && processExists(pid); attempt++) await delay(250);
      if (processExists(pid)) throw new Error('O servidor ainda esta encerrando. Tente novamente.');
    }
    fs.unlinkSync(pidFile);
  }
  if (exists(path.join(data, 'PG_VERSION')) && databaseRunning()) {
    runPg('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  }
  console.log('Sistema e PostgreSQL local parados. Os dados foram preservados.');
}

async function status() {
  if (!exists(configFile)) { console.log('Ambiente local ainda nao configurado.'); return; }
  const config = readJson(configFile);
  console.log(`PostgreSQL: ${databaseRunning() ? 'em execucao' : 'parado'}`);
  console.log(`Sistema: ${await readHealth(config) ? 'em execucao' : 'parado'}`);
  console.log(`Endereco: http://localhost:${config.appPort}`);
}

try {
  if (command === 'start') await start();
  else if (command === 'stop') await stop();
  else if (command === 'status') await status();
  else throw new Error('Use start, stop ou status.');
} catch (error) {
  console.error(error.message);
  if (error.stderr) console.error(error.stderr);
  process.exitCode = 1;
}
