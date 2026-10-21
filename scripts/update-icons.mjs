// scripts/update-icons.mjs — замена иконок прайса на исправленные 3D-PNG.
//
// Зачем: генератор прайса отдаёт пакет «только картинки» (mapping.json + png/),
// где иконки уже отрендерены в 3D. Скрипт раскладывает их по тем же именам,
// что и импорт (`/uploads/prices/<icon_index>.png`), обновляет блобы в
// price_icons (на Render диск эфемерный) и помечает image_url версией,
// чтобы браузеры не показывали старую 2D-картинку из кэша.
//
// Запуск:
//   node scripts/update-icons.mjs --src D:/tmp/mc3d --dry-run
//   node scripts/update-icons.mjs --src D:/tmp/mc3d --apply
//
// --src — распакованный пакет (в нём mapping.json и png/).
// --dry-run — только отчёт, ничего не пишет (по умолчанию).

import { readFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..');
const ICON_DIR = join(repoRoot, 'server', 'uploads', 'prices');
const ICON_URL = '/uploads/prices';
/** Метка версии в image_url: меняется при каждой пачке новых иконок. */
const ICON_VERSION = '3d';

function readEnvFile(path) {
  const values = {};
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return values; }
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
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function parseArgs(argv) {
  const args = { src: '', apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--src') args.src = argv[++i] ?? '';
    else if (arg.startsWith('--src=')) args.src = arg.slice(6);
  }
  return args;
}

async function connect() {
  const env = readEnvFile(join(repoRoot, 'mysql-connection.env'));
  return mysql.createConnection({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT) || 4000,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    ssl: env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    supportBigNumbers: true,
    multipleStatements: false,
  });
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.src) throw new Error('Укажите --src <папка с mapping.json и png/>');

  const mappingPath = join(args.src, 'mapping.json');
  const mappings = JSON.parse(readFileSync(mappingPath, 'utf8'));
  console.log(`Пакет: ${mappingPath}`);
  console.log(`Записей в mapping.json: ${mappings.length}`);

  const byKey = new Map();
  for (const entry of mappings) {
    const key = `${entry.itemid}@${entry.damage}`;
    if (byKey.has(key)) console.log(`  ! дубль в пакете: ${key}`);
    byKey.set(key, entry);
  }

  const conn = await connect();
  const keys = [...byKey.keys()];
  const dbRows = [];
  for (const part of chunk(keys, 500)) {
    const [rows] = await conn.execute(
      `SELECT id, source_key, name, image_url FROM resources WHERE source_key IN (${part.map(() => '?').join(',')})`,
      part,
    );
    dbRows.push(...rows);
  }
  console.log(`Совпало с базой по source_key: ${dbRows.length}`);

  const stats = {
    updated: 0, already: 0, noSource: 0, noDisk: 0, copied: 0, blobs: 0,
  };
  const unmatched = keys.filter((key) => !dbRows.some((row) => row.source_key === key));
  const plan = [];

  for (const row of dbRows) {
    const entry = byKey.get(row.source_key);
    if (!entry) continue;

    const iconName = `${String(entry.icon_index).padStart(5, '0')}.png`;
    const expectedUrl = `${ICON_URL}/${iconName}`;
    const sourcePath = join(args.src, entry.file);
    const targetPath = join(ICON_DIR, iconName);

    if (!existsSync(sourcePath)) { stats.noSource += 1; continue; }
    if (!existsSync(targetPath)) stats.noDisk += 1;

    plan.push({ row, entry, iconName, expectedUrl, sourcePath, targetPath });
  }

  if (args.apply) {
    // Файлы копируем локально, блобы и image_url пишем пачками: по одному
    // UPDATE на удалённый TiDB — это ~15 минут на 3 300 предметов.
    const pending = [];
    for (const item of plan) {
      const bytes = readFileSync(item.sourcePath);
      copyFileSync(item.sourcePath, item.targetPath);
      stats.copied += 1;

      const targetUrl = `${item.expectedUrl}?v=${ICON_VERSION}`;
      if (item.row.image_url === targetUrl) {
        stats.already += 1;
      } else {
        pending.push({ id: item.row.id, url: targetUrl });
      }

      // Блоб обновляем в любом случае: на Render иконка может прийти из базы.
      item.bytes = bytes;
    }

    const blobBatch = 150;
    for (const part of chunk(plan, blobBatch)) {
      await conn.query(
        'INSERT INTO price_icons (name, data) VALUES ? ON DUPLICATE KEY UPDATE data = VALUES(data)',
        [part.map((item) => [item.iconName, item.bytes])],
      );
      stats.blobs += part.length;
      console.log(`  блобы: ${stats.blobs}/${plan.length}`);
    }

    const updateBatch = 100;
    for (const part of chunk(pending, updateBatch)) {
      const cases = part.map(() => 'WHEN ? THEN ?').join(' ');
      const params = part.flatMap((item) => [item.id, item.url]);
      const ids = part.map(() => '?').join(',');
      await conn.execute(
        `UPDATE resources
            SET image_url = CASE id ${cases} END,
                updated_at = CURRENT_TIMESTAMP(3)
          WHERE id IN (${ids})`,
        [...params, ...part.map((item) => item.id)],
      );
      stats.updated += part.length;
      console.log(`  image_url: ${stats.updated}/${pending.length}`);
    }
  } else {
    stats.updated = plan.filter((item) => item.row.image_url !== `${item.expectedUrl}?v=${ICON_VERSION}`).length;
    stats.already = plan.length - stats.updated;
  }

  console.log('\n── Итог ─────────────────────────────');
  console.log(`  к обработке:        ${plan.length}`);
  console.log(`  ${args.apply ? 'скопировано файлов' : 'файлов будет скопировано'}: ${args.apply ? stats.copied : plan.length}`);
  console.log(`  ${args.apply ? 'обновлено блобов' : 'блобов в price_icons'}:  ${args.apply ? stats.blobs : plan.length}`);
  console.log(`  image_url обновлён: ${stats.updated}`);
  console.log(`  уже с меткой ${ICON_VERSION}:    ${stats.already}`);
  console.log(`  нет файла в пакете: ${stats.noSource}`);
  console.log(`  не было на диске:   ${stats.noDisk}`);
  console.log(`  не найдено в базе:  ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('  примеры не найденных source_key:');
    for (const key of unmatched.slice(0, 10)) console.log(`    ${key}`);
  }
  if (!args.apply) console.log('\nЭто dry-run. Для записи добавьте --apply.');

  await conn.end();
}

main().catch((error) => { console.error(error); process.exit(1); });
