// mysql-cli.mjs — консольный клиент MySQL/TiDB на mysql2.
//
// Зачем: mysql.exe 9.x не умеет mysql_native_password, которым пользуется TiDB,
// поэтому для облачной базы mysql-connect.ps1 запускает этот скрипт.
//
// Запуск:
//   node mysql-cli.mjs                          — интерактивная консоль
//   node mysql-cli.mjs --query "SELECT 1"       — разовый запрос
//   node mysql-cli.mjs --query "…" --json       — ответ в JSON
//
// Настройки берутся из mysql-connection.env рядом со скриптом
// (или из файла, указанного в MCSKILL_DB_CONFIG).

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/** Читает KEY=VALUE из .env-файла (комментарии и кавычки поддерживаются). */
function readEnvFile(path) {
  const values = {};
  let text;

  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Не найден файл настроек: ${path}`);
  }

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

/** Разбирает аргументы командной строки: --query/-Query, --json, --help. */
function parseArgs(argv) {
  const options = { query: null, json: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--query' || arg === '-Query' || arg === '-query') {
      options.query = argv[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith('--query=')) {
      options.query = arg.slice('--query='.length);
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Неизвестный аргумент: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`mysql-cli — консольный клиент MySQL/TiDB

  node mysql-cli.mjs                       интерактивная консоль (exit — выход)
  node mysql-cli.mjs --query "SELECT 1"    разовый запрос
  node mysql-cli.mjs --query "…" --json    ответ в JSON

Настройки: mysql-connection.env рядом со скриптом
(переопределяется переменной MCSKILL_DB_CONFIG).`);
}

/** Печатает результат в виде таблицы. */
function printTable(rows) {
  if (rows.length === 0) {
    console.log('(пусто)');
    return;
  }

  const columns = Object.keys(rows[0]);
  const cells = rows.map((row) =>
    columns.map((column) => {
      const value = row[column];
      if (value === null || value === undefined) return 'NULL';
      if (value instanceof Date) return value.toISOString();
      if (Buffer.isBuffer(value)) return `<binary ${value.length} B>`;
      return String(value);
    }),
  );

  const widths = columns.map((column, index) =>
    Math.max(column.length, ...cells.map((row) => row[index].length)),
  );

  const line = (values) => values.map((value, index) => value.padEnd(widths[index])).join(' | ');

  console.log(line(columns));
  console.log(widths.map((width) => '-'.repeat(width)).join('-+-'));
  for (const row of cells) console.log(line(row));

  console.log(`\n${rows.length} строк(и)`);
}

/** Выполняет один оператор и печатает результат. */
async function runStatement(connection, sql, asJson) {
  const [result] = await connection.query(sql);

  if (Array.isArray(result)) {
    if (asJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printTable(result);
    }
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`OK: affectedRows=${result.affectedRows ?? 0}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const configPath =
    process.env.MCSKILL_DB_CONFIG || join(scriptDir, 'mysql-connection.env');
  const config = readEnvFile(configPath);
  const ssl = config.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined;

  const connection = await mysql.createConnection({
    host: config.MYSQL_HOST || '127.0.0.1',
    port: Number(config.MYSQL_PORT || 3306),
    user: config.MYSQL_USER || 'root',
    password: config.MYSQL_PASSWORD ?? '',
    database: config.MYSQL_DATABASE || 'mcskill_trader',
    charset: 'utf8mb4',
    timezone: 'Z',
    ...(ssl ? { ssl } : {}),
    connectTimeout: 20000,
  });

  try {
    if (options.query) {
      await runStatement(connection, options.query, options.json);
      return;
    }

    const address = `${config.MYSQL_USER}@${config.MYSQL_HOST}:${config.MYSQL_PORT}/${config.MYSQL_DATABASE}`;
    console.log(`\n  MySQL: ${address}`);
    console.log('  Введите SQL и нажмите Enter. Выход — exit;\n');

    const readline = createInterface({ input: process.stdin, output: process.stdout });
    let buffer = '';

    for await (const line of readline) {
      const trimmed = line.trim();

      if (trimmed === '' && buffer === '') continue;

      if (buffer === '' && (trimmed === 'exit' || trimmed === 'exit;' || trimmed === 'quit')) {
        break;
      }

      buffer += `${line}\n`;

      // Оператор считается законченным по точке с запятой в конце строки.
      if (!trimmed.endsWith(';')) continue;

      const sql = buffer.trim().replace(/;$/, '');
      buffer = '';

      try {
        await runStatement(connection, sql, options.json);
      } catch (error) {
        console.error(`Ошибка: ${error.code ? `${error.code}: ` : ''}${error.message}`);
      }
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Ошибка: ${error.message}`);
  process.exitCode = 1;
});
