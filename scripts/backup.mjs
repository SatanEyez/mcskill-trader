#!/usr/bin/env node
// scripts/backup.mjs — резервная копия McSkill Trader.
//
// Что сохраняет:
//   • database.sql.gz — вся база: схема + данные всех таблиц, включая
//     uploaded_files.data (загруженные иконки лежат в базе, а не на диске);
//   • uploads.tar.gz — папка server/uploads (иконки прайса из git + старые файлы);
//   • manifest.json  — что внутри, сколько строк, контрольные суммы;
//   • README.txt     — как восстановить.
//
// По умолчанию пишет ДВЕ независимые копии: рядом с репозиторием и в домашней
// папке (разные диски). Старые копии чистит, оставляя последние N.
//
// Запуск:
//   npm run backup                     — две копии, хранить 10 последних
//   npm run backup -- --keep 20        — хранить 20
//   npm run backup -- --out E:\backup  — только в указанную папку
//   npm run backup -- --no-uploads     — без архива uploads
//
// Настройки базы берутся из mysql-connection.env (или MCSKILL_DB_CONFIG),
// переменные окружения MYSQL_* имеют приоритет.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createReadStream, createWriteStream, readFileSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import mysql from 'mysql2/promise';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const UPLOADS_DIR = join(REPO_ROOT, 'server', 'uploads');
const STMT_MARKER = '-- @@STMT@@';

/** Читает KEY=VALUE из .env-файла. */
function readEnvFile(path) {
  const values = {};
  const text = readFileSyncSafe(path);
  if (text === null) return values;

  for (const raw of text.split(/\r?\n/)) {
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

  return values;
}

function readFileSyncSafe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function loadConfig() {
  const file = process.env.MCSKILL_DB_CONFIG || join(REPO_ROOT, 'mysql-connection.env');
  const fromFile = readEnvFile(file);

  const pick = (key, fallback) => process.env[key] ?? fromFile[key] ?? fallback;

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
  const options = { out: [], keep: 10, uploads: true };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--out') {
      options.out.push(resolve(argv[++index] ?? ''));
    } else if (arg === '--keep') {
      options.keep = Math.max(1, Number(argv[++index] ?? 10));
    } else if (arg === '--no-uploads') {
      options.uploads = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Резервная копия базы и загрузок McSkill Trader.',
          '',
          '  npm run backup                    две копии, хранить 10 последних',
          '  npm run backup -- --keep 20       хранить 20',
          '  npm run backup -- --out E:\\backup  только в указанную папку',
          '  npm run backup -- --no-uploads    без архива uploads',
        ].join('\n'),
      );
      process.exit(0);
    }
  }

  return options;
}

function stamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds()),
  ].join('');
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function gitInfo() {
  try {
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    const dirty =
      execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
        .length > 0;

    return { commit, branch, dirty };
  } catch {
    return { commit: null, branch: null, dirty: null };
  }
}

async function tableNames(connection) {
  const [rows] = await connection.query('SHOW TABLES');
  const key = Object.keys(rows[0] ?? {})[0];
  if (!key) return [];
  return rows.map((row) => row[key]).sort();
}

async function dumpDatabase(connection, file, config) {
  const tables = await tableNames(connection);
  const gzip = createGzip({ level: 9 });
  const output = createWriteStream(file);
  gzip.pipe(output);

  const write = async (text) => {
    if (!gzip.write(text)) await once(gzip, 'drain');
  };

  const statement = async (sql) => {
    await write(`${STMT_MARKER}\n${sql};\n`);
  };

  const startedAt = new Date();
  const summary = [];
  let totalRows = 0;

  await write(
    [
      '-- McSkill Trader — резервная копия базы данных',
      `-- Создано: ${startedAt.toISOString()}`,
      `-- База: ${config.database} @ ${config.host}:${config.port}`,
      '-- Восстановление: node scripts/restore.mjs <папка-с-бэкапом> --target-db <имя> --yes',
      '',
    ].join('\n'),
  );

  await statement('SET NAMES utf8mb4');
  await statement('SET FOREIGN_KEY_CHECKS = 0');
  await statement('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"');

  for (const [index, table] of tables.entries()) {
    const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    const createSql = createRow[Object.keys(createRow).find((key) => key.startsWith('Create'))];
    const [rows] = await connection.query(`SELECT * FROM \`${table}\``);

    // Вычисляемые колонки (GENERATED) писать в INSERT нельзя — база считает
    // их сама. В resources это name_manual_key.
    const [generatedRows] = await connection.query(
      `SELECT COLUMN_NAME AS name
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND EXTRA LIKE '%GENERATED%'`,
      [table],
    );
    const generated = new Set(generatedRows.map((row) => row.name));

    await statement(`DROP TABLE IF EXISTS \`${table}\``);
    await statement(createSql);

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]).filter((column) => !generated.has(column));
      const columnList = columns.map((column) => `\`${column}\``).join(', ');

      let batch = [];
      let bytes = 0;

      const flush = async () => {
        if (batch.length === 0) return;
        await statement(
          `INSERT INTO \`${table}\` (${columnList}) VALUES\n${batch.join(',\n')}`,
        );
        batch = [];
        bytes = 0;
      };

      for (const row of rows) {
        const tuple = `(${columns.map((column) => connection.escape(row[column])).join(',')})`;
        batch.push(tuple);
        bytes += tuple.length;

        // Держим каждый INSERT в пределах ~512 КБ: у TiDB ограничен размер пакета.
        if (batch.length >= 200 || bytes >= 512 * 1024) await flush();
      }

      await flush();
    }

    totalRows += rows.length;
    summary.push({ table, rows: rows.length });
    console.log(
      `  [${String(index + 1).padStart(2)}/${tables.length}] ${table.padEnd(20)} ${String(
        rows.length,
      ).padStart(6)} строк`,
    );
  }

  await statement('SET FOREIGN_KEY_CHECKS = 1');
  await write(`\n-- Итого таблиц: ${tables.length}, строк: ${totalRows}\n`);

  gzip.end();
  await once(output, 'close');

  return { tables: summary, totalRows };
}

async function archiveUploads(workDir) {
  try {
    const info = await stat(UPLOADS_DIR);
    if (!info.isDirectory()) throw new Error('not a directory');
  } catch {
    return null;
  }

  const files = (await readdir(UPLOADS_DIR, { recursive: true, withFileTypes: true })).filter(
    (entry) => entry.isFile(),
  ).length;

  try {
    // Имя архива — относительное, а cwd = папка копии: GNU tar на Windows
    // принимает «D://...» за удалённый хост и падает с «Cannot connect to D:».
    execFileSync('tar', ['-czf', 'uploads.tar.gz', '-C', UPLOADS_DIR, '.'], {
      cwd: workDir,
      stdio: 'pipe',
    });
    const info = await stat(join(workDir, 'uploads.tar.gz'));
    return { files, bytes: info.size, archive: 'uploads.tar.gz' };
  } catch {
    // Нет tar — копируем папку как есть.
    await cp(UPLOADS_DIR, join(workDir, 'uploads'), { recursive: true });
    return { files, bytes: null, archive: 'uploads/' };
  }
}

const README = `McSkill Trader — резервная копия
================================

Что внутри
----------
database.sql.gz   Вся база: схема и данные всех таблиц. Загруженные иконки
                  (таблица uploaded_files) лежат в базе целиком, поэтому
                  картинки тоже внутри.
uploads.tar.gz    Папка server/uploads: иконки прайса и старые файлы.
manifest.json     Состав копии, количество строк и контрольные суммы.
uploads/          Появляется вместо uploads.tar.gz, если в системе нет tar.

Как восстановить базу
---------------------
1. Убедитесь, что в mysql-connection.env указана нужная база.
2. Восстановите в отдельную базу и проверьте:
     node scripts/restore.mjs "<эта папка>" --target-db mcskill_trader_restore --yes
3. Если всё в порядке — восстановите в рабочую:
     node scripts/restore.mjs "<эта папка>" --yes

Флаг --yes обязателен: скрипт перезаписывает таблицы.

Как восстановить uploads
------------------------
     node scripts/restore.mjs "<эта папка>" --uploads-only
(или просто распакуйте uploads.tar.gz в server/uploads)
`;

async function makeBackup(targets, options, config) {
  const created = new Date();
  const name = `backup-${stamp(created)}`;
  const workDir = join(targets[0], name);
  await mkdir(workDir, { recursive: true });

  console.log(`\nБаза: ${config.database} @ ${config.host}:${config.port}`);
  console.log(`Папка: ${workDir}\n`);

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    // mysql2 по умолчанию разбирает JSON в объекты, а connection.escape()
    // превращает массив в список значений — INSERT разваливается.
    // Берём JSON сырой строкой, как её хранит база.
    typeCast: (field, next) => (field.type === 'JSON' ? field.string('utf8') : next()),
    ...(config.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    connectTimeout: 20000,
  });

  try {
    console.log('Дамп базы:');
    const dump = await dumpDatabase(connection, join(workDir, 'database.sql.gz'), config);

    const [[iconRow]] = await connection.query(
      "SELECT COUNT(*) AS total FROM resources WHERE image_url LIKE '/uploads/%' OR image_url LIKE '/items/%'",
    );

    const artifacts = [];

    const dbFile = join(workDir, 'database.sql.gz');
    const dbStat = await stat(dbFile);
    artifacts.push({
      file: 'database.sql.gz',
      bytes: dbStat.size,
      sha256: await sha256(dbFile),
    });

    let uploads = null;
    if (options.uploads) {
      console.log('\nАрхив uploads…');
      uploads = await archiveUploads(workDir);
      if (uploads?.archive === 'uploads.tar.gz') {
        const uploadStat = await stat(join(workDir, 'uploads.tar.gz'));
        artifacts.push({
          file: 'uploads.tar.gz',
          bytes: uploadStat.size,
          sha256: await sha256(join(workDir, 'uploads.tar.gz')),
        });
      }
      console.log(
        uploads
          ? `  ${uploads.files} файлов, ${human(uploads.bytes ?? 0)}`
          : '  папка server/uploads не найдена — пропущено',
      );
    }

    const manifest = {
      app: 'McSkill Trader',
      created_at: created.toISOString(),
      git: gitInfo(),
      database: {
        host: config.host,
        port: config.port,
        name: config.database,
        tables: dump.tables.length,
        rows: dump.totalRows,
        resources_with_icon: Number(iconRow?.total ?? 0),
      },
      tables: dump.tables,
      uploads,
      artifacts,
    };

    await writeFile(join(workDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await writeFile(join(workDir, 'README.txt'), README, 'utf8');

    console.log('\nКопирую в остальные места…');
    for (const target of targets.slice(1)) {
      const destination = join(target, name);
      await mkdir(target, { recursive: true });
      await cp(workDir, destination, { recursive: true });
      console.log(`  ${destination}`);
    }

    for (const target of targets) {
      await prune(target, options.keep);
    }

    const size = artifacts.reduce((sum, item) => sum + item.bytes, 0);
    console.log(
      `\nГотово: ${dump.totalRows} строк в ${dump.tables.length} таблицах, ` +
        `${iconRow?.total ?? 0} ресурсов с иконками, ${human(size)} архивов.`,
    );
    console.log(`Копий: ${targets.length}. Храним последние ${options.keep}.`);

    return { name, workDir, manifest };
  } finally {
    await connection.end();
  }
}

async function prune(target, keep) {
  let entries;

  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch {
    return;
  }

  const backups = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('backup-'))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const name of backups.slice(keep)) {
    await rm(join(target, name), { recursive: true, force: true });
    console.log(`  удалена старая копия: ${join(target, name)}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  const targets =
    options.out.length > 0
      ? options.out
      : [
          join(dirname(REPO_ROOT), 'Mcskilltrader-backups'),
          join(homedir(), 'McSkillTrader-backups'),
        ];

  await makeBackup(targets, options, config);
}

main().catch((error) => {
  console.error('\nНе удалось сделать резервную копию:', error.message);
  process.exit(1);
});
