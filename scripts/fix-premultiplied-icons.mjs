// scripts/fix-premultiplied-icons.mjs — снятие premultiplied alpha с 3D-иконок.
//
// Зачем: пакет 3D-иконок отрендерен OpenGL-рендерером мода и сохранён с
// premultiplied alpha: в файле лежит уже умноженный на альфу цвет, то есть
// у полупрозрачных пикселей RGB ≈ alpha. Браузер считает PNG обычным
// (straight) alpha и рисует такие пиксели почти чёрными — вокруг кристаллов,
// стекла и светящихся предметов появляется тёмная плашка вместо свечения.
//
// Лечение: c' = c * 255 / a (для 0 < a < 255), alpha не меняется.
// Обратное к тому, что сделал рендерер, поэтому после правки иконка выглядит
// так, как задумано: цветное свечение вместо чёрного прямоугольника.
//
// Трогаем только 64×64 (пакет 3D) и только те файлы, у которых эмпирическая
// зависимость «максимум канала от альфы» похожа на premultiplied (наклон ≤ 1.25).
// Иконки 32×32 из спрайт-листа уже с обычной альфой — их не трогаем.
//
// Запуск:
//   npx tsx scripts/fix-premultiplied-icons.mjs --dry-run
//   npx tsx scripts/fix-premultiplied-icons.mjs --apply

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { decodePng, encodePng } from '../server/src/modules/import/png.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..');
const ICON_DIR = join(repoRoot, 'server', 'uploads', 'prices');

/** Старая и новая метки версии для 3D-иконок. */
const OLD_VERSION = '3d2';
const NEW_VERSION = '3d3';

/** Минимум полупрозрачных пикселей, чтобы вообще судить о наклоне. */
const MIN_SOFT_PIXELS = 40;
/** Наклон выше этого — цвет уже ярче альфы, значит альфа обычная. */
const MAX_PREMULTIPLIED_SLOPE = 1.25;

function readEnvFile(path) {
  const values = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return values;
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
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function parseArgs(argv) {
  const args = { apply: false, limit: 12 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--limit') args.limit = Number(argv[++i] ?? args.limit);
  }
  return args;
}

/**
 * Наклон прямой «max(RGB) = k * alpha» по полупрозрачным пикселям.
 * У premultiplied alpha k ≈ 1, у обычной — заметно больше.
 */
function premultipliedSlope(data, width, height) {
  let sumVA = 0;
  let sumAA = 0;
  let soft = 0;
  for (let i = 0; i < width * height; i += 1) {
    const alpha = data[i * 4 + 3];
    if (alpha <= 5 || alpha >= 250) continue;
    const max = Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    sumVA += max * alpha;
    sumAA += alpha * alpha;
    soft += 1;
  }
  if (soft < MIN_SOFT_PIXELS || sumAA === 0) return { slope: null, soft };
  return { slope: sumVA / sumAA, soft };
}

function unpremultiply(data, width, height) {
  const out = Buffer.from(data);
  for (let i = 0; i < width * height; i += 1) {
    const alpha = out[i * 4 + 3];
    if (alpha === 0) {
      out[i * 4] = 0;
      out[i * 4 + 1] = 0;
      out[i * 4 + 2] = 0;
      continue;
    }
    if (alpha === 255) continue;
    const factor = 255 / alpha;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = Math.round(out[i * 4 + channel] * factor);
      out[i * 4 + channel] = value > 255 ? 255 : value;
    }
  }
  return out;
}

async function connectDb() {
  const env = {
    ...readEnvFile(join(repoRoot, 'mysql-connection.env')),
    ...process.env,
  };
  const host = env.MYSQL_HOST ?? env.DB_HOST;
  if (!host) return null;
  return mysql.createConnection({
    host,
    port: Number(env.MYSQL_PORT ?? env.DB_PORT ?? 3306),
    user: env.MYSQL_USER ?? env.DB_USER,
    password: env.MYSQL_PASSWORD ?? env.DB_PASSWORD,
    database: env.MYSQL_DATABASE ?? env.DB_NAME,
    ssl: { minVersion: 'TLSv1.2' },
  });
}

const args = parseArgs(process.argv.slice(2));
const db = await connectDb();
if (!db) {
  console.error('Нет доступа к БД: заполните mysql-connection.env');
  process.exit(1);
}

const [rows] = await db.query(
  `SELECT DISTINCT image_url FROM resources WHERE image_url LIKE ?`,
  [`%v=${OLD_VERSION}%`],
);

const files = new Set();
for (const row of rows) {
  const match = String(row.image_url).match(/(\d{5})\.png/);
  if (match) files.add(`${match[1]}.png`);
}

console.log(`3D-иконок в каталоге: ${files.size}`);

const changed = [];
const skipped = [];

for (const file of [...files].sort()) {
  const path = join(ICON_DIR, file);
  let buffer;
  try {
    buffer = readFileSync(path);
  } catch {
    skipped.push({ file, reason: 'файла нет' });
    continue;
  }

  const png = decodePng(buffer);
  if (png.width !== 64 || png.height !== 64) {
    skipped.push({ file, reason: `размер ${png.width}×${png.height}` });
    continue;
  }

  const { slope, soft } = premultipliedSlope(png.data, png.width, png.height);
  if (slope === null) {
    skipped.push({ file, reason: `нет полупрозрачных пикселей (${soft})` });
    continue;
  }
  if (slope > MAX_PREMULTIPLIED_SLOPE) {
    skipped.push({ file, reason: `наклон ${slope.toFixed(2)} — альфа обычная` });
    continue;
  }

  const fixed = unpremultiply(png.data, png.width, png.height);
  changed.push({ file, slope, soft });
  if (args.apply) writeFileSync(path, encodePng(png.width, png.height, fixed));
}

console.log(`\nК исправлению: ${changed.length}, пропущено: ${skipped.length}`);
for (const item of changed.slice(0, args.limit)) {
  console.log(`  ${item.file}  наклон ${item.slope.toFixed(2)}  полупрозрачных ${item.soft}`);
}
if (changed.length > args.limit) console.log(`  … ещё ${changed.length - args.limit}`);

if (!args.apply) {
  console.log('\nЭто пробный прогон. Записать файлы: --apply');
  await db.end();
  process.exit(0);
}

const [result] = await db.query(
  `UPDATE resources SET image_url = REPLACE(image_url, ?, ?) WHERE image_url LIKE ?`,
  [`?v=${OLD_VERSION}`, `?v=${NEW_VERSION}`, `%v=${OLD_VERSION}%`],
);
console.log(`\nЗаписано файлов: ${changed.length}. Обновлено ссылок в каталоге: ${result.affectedRows}`);
await db.end();
