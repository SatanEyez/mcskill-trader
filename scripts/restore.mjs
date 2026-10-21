#!/usr/bin/env node
// scripts/restore.mjs — восстановление из копии, сделанной scripts/backup.mjs.
//
// Запуск:
//   node scripts/restore.mjs "D:\Mcskilltrader-backups\backup-2026-10-21_22-15-00" \
//        --target-db mcskill_trader_restore --yes     — в отдельную базу (проверка)
//
//   node scripts/restore.mjs "<папка>" --yes           — в рабочую базу из конфига
//   node scripts/restore.mjs "<папка>" --uploads-only --yes  — только uploads
//
// Без --yes скрипт только показывает, что и куда восстановит.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import mysql from 'mysql2/promise';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const UPLOADS_DIR = join(REPO_ROOT, 'server', 'uploads');
const STMT_MARKER = '-- @@STMT@@';

function readEnvFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function loadConfig() {
  const file = process.env.MCSKILL_DB_CONFIG || join(REPO_ROOT, 'mysql-connection.env');
  const values = {};

  for (const raw of readEnvFile(file).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }

    values[key] = value;
  }

  const pick = (key, fallback) => process.env[key] ?? values[key] ?? fallback;

  return {
    host: pick('MYSQL_HOST', '127.0.0.1'),
    port: Number(pick('MYSQL_PORT', '3306')),
    user: pick('MYSQL_USER', 'root'),
    password: pick('MYSQL_PASSWORD', ''),
    database: pick('MYSQL_DATABASE', 'mcskill_trader'),
    ssl: String(pick('MYSQL_SSL', 'false')) === 'true',
  };
}

function parseArgs(argv) {
  const options = {
    dir: null,
    target: null,
    yes: false,
    uploadsOnly: false,
    uploadsDir: UPLOADS_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--target-db') {
      options.target = argv[++index];
    } else if (arg === '--uploads-only') {
      options.uploadsOnly = true;
    } else if (arg === '--uploads-dir') {
      options.uploadsDir = resolve(argv[++index] ?? '');
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Восстановление McSkill Trader из резервной копии.',
          '',
          '  node scripts/restore.mjs <папка> --target-db <имя> --yes',
          '  node scripts/restore.mjs <папка> --yes',
          '  node scripts/restore.mjs <папка> --uploads-only --yes',
          '',
          'Без --yes ничего не меняется — только план восстановления.',
        ].join('\n'),
      );
      process.exit(0);
    } else if (!arg.startsWith('-') && !options.dir) {
      options.dir = resolve(arg);
    }
  }

  return options;
}

async function readDump(dir) {
  const gz = join(dir, 'database.sql.gz');

  try {
    await stat(gz);
    const buffer = gunzipSync(await readFile(gz));
    return buffer.toString('utf8');
  } catch {
    const plain = join(dir, 'database.sql');
    return readFile(plain, 'utf8');
  }
}

function splitStatements(sql) {
  return sql
    .split(STMT_MARKER)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.replace(/;\s*$/, ''));
}

async function restoreDatabase(options, config) {
  const dir = options.dir;
  const manifest = await readFile(join(dir, 'manifest.json'), 'utf8')
    .then((text) => JSON.parse(text))
    .catch(() => null);

  const target = options.target ?? config.database;
  const statements = splitStatements(await readDump(dir));

  console.log(`Копия:     ${dir}`);
  console.log(`Создана:   ${manifest?.created_at ?? 'неизвестно'}`);
  console.log(`База:      ${config.database} @ ${config.host}:${config.port}`);
  console.log(`Цель:      ${target}`);
  console.log(
    `Содержимое: ${manifest?.database?.rows ?? '?'} строк, ` +
      `${manifest?.database?.tables ?? '?'} таблиц, ` +
      `${manifest?.database?.resources_with_icon ?? '?'} ресурсов с иконками`,
  );
  console.log(`Команд в дампе: ${statements.length}`);

  if (!options.yes) {
    console.log('\nЭто предварительный просмотр. Добавьте --yes, чтобы восстановить.');
    return;
  }

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: 'utf8mb4',
    multipleStatements: false,
    ...(config.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    connectTimeout: 20000,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
    );
    await connection.query(`USE \`${target}\``);
    console.log(`\nВосстанавливаю в \`${target}\`…`);

    for (const [index, statement] of statements.entries()) {
      try {
        await connection.query(statement);
      } catch (error) {
        console.error(`\nОшибка в команде №${index + 1}:`);
        console.error(statement.slice(0, 300));
        throw error;
      }

      if ((index + 1) % 100 === 0) {
        process.stdout.write(`  ${index + 1} / ${statements.length}\r`);
      }
    }

    console.log(`  ${statements.length} / ${statements.length} — готово`);

    // Сверяем количество строк с манифестом.
    if (manifest?.tables) {
      const [rows] = await connection.query('SHOW TABLES');
      const key = Object.keys(rows[0] ?? {})[0];
      const tables = key ? rows.map((row) => row[key]) : [];
      let mismatches = 0;

      for (const table of manifest.tables) {
        if (!tables.includes(table.table)) {
          console.log(`  ! нет таблицы ${table.table}`);
          mismatches += 1;
          continue;
        }

        const [[counted]] = await connection.query(
          `SELECT COUNT(*) AS n FROM \`${table.table}\``,
        );

        if (Number(counted.n) !== table.rows) {
          console.log(
            `  ! ${table.table}: в копии ${table.rows}, восстановлено ${counted.n}`,
          );
          mismatches += 1;
        }
      }

      console.log(
        mismatches === 0
          ? 'Сверка: все таблицы совпадают по количеству строк.'
          : `Сверка: расхождений — ${mismatches}.`,
      );
    }
  } finally {
    await connection.end();
  }
}

async function restoreUploads(options) {
  const archive = join(options.dir, 'uploads.tar.gz');

  try {
    await stat(archive);
  } catch {
    console.log('В копии нет uploads.tar.gz — пропускаю.');
    return;
  }

  if (!options.yes) {
    console.log(`Распакую ${archive} в ${options.uploadsDir}. Добавьте --yes.`);
    return;
  }

  await mkdir(options.uploadsDir, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', options.uploadsDir], { stdio: 'inherit' });
  console.log(`uploads распакованы в ${options.uploadsDir}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dir) {
    console.error('Укажите папку с копией: node scripts/restore.mjs <папка>');
    process.exit(1);
  }

  const config = loadConfig();

  if (options.uploadsOnly) {
    await restoreUploads(options);
    return;
  }

  await restoreDatabase(options, config);
}

main().catch((error) => {
  console.error('\nВосстановление прервано:', error.message);
  process.exit(1);
});
