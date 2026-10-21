// scripts/refresh-icons-from-sheet.mjs — пересборка 2D-иконок из спрайта прайса.
//
// Зачем: часть 2D-иконок в `uploads/prices` нарезана из старой выгрузки
// (icons.png от 13:14): рендер вылезал за ячейку 32×32, и в каталоге висели
// обрезанные куски — например, луки divinerpg. Новая выгрузка (icons.png +
// prices-ready.json) рендерит те же предметы с полями, поэтому иконки
// пересобираются из неё.
//
// 3D-иконки (пакет mcskill-3d-icons-only) не трогаем: у них 64×64 и своя метка
// версии `?v=3d`.
//
// Запуск:
//   node scripts/refresh-icons-from-sheet.mjs --sheet <icons.png> --prices <prices-ready.json> --dry-run
//   node scripts/refresh-icons-from-sheet.mjs --sheet <icons.png> --prices <prices-ready.json> --apply
//
// Сопоставление — по source_key (`itemid@damage`), а не по порядку файлов.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
import { decodePng, cropPng } from '../server/src/modules/import/png.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..');
const ICON_DIR = join(repoRoot, 'server', 'uploads', 'prices');
const ICON_URL = '/uploads/prices';
const CELL = 32;
/** Метка версии для пересобранных 2D-иконок (у 3D — `3d`). */
const ICON_VERSION = '2d2';
/** Метка, которой помечены иконки из 3D-пакета. */
const KEEP_VERSION = '3d2';

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
  const args = { sheet: '', prices: '', apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--sheet') args.sheet = argv[++i] ?? '';
    else if (arg === '--prices') args.prices = argv[++i] ?? '';
    else if (arg.startsWith('--sheet=')) args.sheet = arg.slice(8);
    else if (arg.startsWith('--prices=')) args.prices = arg.slice(9);
  }
  return args;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Ячейка спрайта: пустая ли она (в выгрузке бывают дырки). */
function isEmptyCell(png, index) {
  const cols = png.width / CELL;
  const ox = (index % cols) * CELL;
  const oy = Math.floor(index / cols) * CELL;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      if (png.data[((oy + y) * png.width + ox + x) * 4 + 3] !== 0) return false;
    }
  }
  return true;
}

/** «Фиолетово-чёрный квадрат» — заглушка отсутствующей текстуры в Minecraft. */
function isMissingTexture(png, index) {
  const cols = png.width / CELL;
  const ox = (index % cols) * CELL;
  const oy = Math.floor(index / cols) * CELL;
  let magenta = 0, opaque = 0;

  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const i = ((oy + y) * png.width + ox + x) * 4;
      if (png.data[i + 3] === 0) continue;
      opaque += 1;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (r > 200 && g < 60 && b > 200) magenta += 1;
    }
  }

  return opaque > 0 && magenta / opaque > 0.25;
}

/** Признаки «рендер вылез за ячейку»: контент упирается во все 4 края и не заполняет кадр. */
function looksClipped(buffer) {
  const png = decodePng(buffer);
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1, opaque = 0;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;
      opaque += 1;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }

  if (opaque === 0) return false;

  const edges = (x0 === 0 ? 1 : 0) + (y0 === 0 ? 1 : 0) + (x1 === png.width - 1 ? 1 : 0) + (y1 === png.height - 1 ? 1 : 0);
  return edges === 4 && opaque / (png.width * png.height) < 0.75;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.sheet || !args.prices) throw new Error('Нужны --sheet <icons.png> и --prices <prices-ready.json>');

  const sheet = decodePng(readFileSync(args.sheet));
  const cols = sheet.width / CELL;
  const cells = cols * (sheet.height / CELL);
  console.log(`Спрайт: ${sheet.width}x${sheet.height}, ячеек ${cells}`);

  const payload = JSON.parse(readFileSync(args.prices, 'utf8'));
  const items = Array.isArray(payload) ? payload : payload.items ?? [];
  console.log(`Прайс: ${items.length} предметов`);

  const indexByKey = new Map();
  for (const item of items) {
    if (typeof item?.itemid !== 'string' || typeof item?.icon_index !== 'number') continue;
    indexByKey.set(`${item.itemid}@${item.damage ?? 0}`, item.icon_index);
  }

  const env = readEnvFile(join(repoRoot, 'mysql-connection.env'));
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT) || 4000,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    ssl: env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    supportBigNumbers: true,
  });

  const [rows] = await conn.query(
    'SELECT id, source_key, name, image_url FROM resources WHERE source_key IS NOT NULL',
  );

  const stats = {
    total: rows.length, skipped3d: 0, noIndex: 0, emptyCell: 0, same: 0,
    changed: 0, written: 0, blobs: 0, urlFixed: 0,
    missingTexture: 0, wouldGetWorse: 0,
  };
  const plan = [];

  for (const row of rows) {
    if ((row.image_url ?? '').includes(`v=${KEEP_VERSION}`)) { stats.skipped3d += 1; continue; }

    const index = indexByKey.get(row.source_key);
    if (index === undefined) { stats.noIndex += 1; continue; }
    if (index < 0 || index >= cells) { stats.noIndex += 1; continue; }
    if (isEmptyCell(sheet, index)) { stats.emptyCell += 1; continue; }

    const iconName = `${String(index + 1).padStart(5, '0')}.png`;
    const targetPath = join(ICON_DIR, iconName);
    const current = existsSync(targetPath) ? readFileSync(targetPath) : null;
    const next = cropPng(sheet, (index % cols) * CELL, Math.floor(index / cols) * CELL, CELL, CELL);
    const same = current !== null && createHash('sha256').update(current).digest('hex') === createHash('sha256').update(next).digest('hex');

    if (same) { stats.same += 1; plan.push({ row, iconName, targetPath, next, same: true, skip: false }); continue; }

    // В новой выгрузке есть дырки и заглушки «нет текстуры» — их не ставим.
    if (isMissingTexture(sheet, index)) {
      stats.missingTexture += 1;
      plan.push({ row, iconName, targetPath, next, same: false, skip: true });
      continue;
    }

    // И не меняем нормальную иконку на обрезанную.
    if (current !== null && !looksClipped(current) && looksClipped(next)) {
      stats.wouldGetWorse += 1;
      plan.push({ row, iconName, targetPath, next, same: false, skip: true });
      continue;
    }

    stats.changed += 1;
    plan.push({ row, iconName, targetPath, next, same: false, skip: false });
  }

  if (args.apply) {
    const pending = [];

    for (const item of plan) {
      if (item.skip) continue;

      if (!item.same) {
        writeFileSync(item.targetPath, item.next);
        stats.written += 1;
      }

      const targetUrl = `${ICON_URL}/${item.iconName}?v=${ICON_VERSION}`;
      if (item.row.image_url !== targetUrl) {
        pending.push({ id: item.row.id, url: targetUrl });
      }
    }

    // Блобы: на Render диск эфемерный, иконка может прийти из базы.
    const blobRows = plan.filter((item) => !item.same && !item.skip);
    for (const part of chunk(blobRows, 150)) {
      await conn.query(
        'INSERT INTO price_icons (name, data) VALUES ? ON DUPLICATE KEY UPDATE data = VALUES(data)',
        [part.map((item) => [item.iconName, item.next])],
      );
      stats.blobs += part.length;
      console.log(`  блобы: ${stats.blobs}/${blobRows.length}`);
    }

    for (const part of chunk(pending, 100)) {
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
      stats.urlFixed += part.length;
      console.log(`  image_url: ${stats.urlFixed}/${pending.length}`);
    }
  }

  console.log('\n── Итог ─────────────────────────────');
  console.log(`  ресурсов из импорта:      ${stats.total}`);
  console.log(`  пропущено 3D (?v=3d):     ${stats.skipped3d}`);
  console.log(`  нет в прайсе:             ${stats.noIndex}`);
  console.log(`  пустая ячейка в спрайте:  ${stats.emptyCell}`);
  console.log(`  иконка уже совпадает:     ${stats.same}`);
  console.log(`  заглушка «нет текстуры»:  ${stats.missingTexture}`);
  console.log(`  стало бы хуже (обрезано): ${stats.wouldGetWorse}`);
  console.log(`  ${args.apply ? 'перезаписано файлов' : 'файлов изменится'}:     ${args.apply ? stats.written : stats.changed}`);
  if (args.apply) {
    console.log(`  обновлено блобов:         ${stats.blobs}`);
    console.log(`  image_url с ?v=${ICON_VERSION}:       ${stats.urlFixed}`);
  } else {
    console.log('\nЭто dry-run. Для записи добавьте --apply.');
  }

  await conn.end();
}

main().catch((error) => { console.error(error); process.exit(1); });
