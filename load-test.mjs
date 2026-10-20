/**
 * Проверка многопользовательской нагрузки: параллельные расчёты трейда и загрузки каталога.
 *
 * Каждый запрос считает свою пару количеств, поэтому тест ловит и ошибки, и «перемешивание»
 * ответов между пользователями. Требует запущенного API.
 *
 * Запуск: npm run test:load
 * Настройка: API_URL и LOAD_LEVELS (например, LOAD_LEVELS=50,100,200).
 */
const BASE = (process.env.API_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '');
const LEVELS = (process.env.LOAD_LEVELS ?? '25,50,100,200')
  .split(',')
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isInteger(value) && value > 0);

async function fetchCatalog() {
  const response = await fetch(`${BASE}/resources`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Каталог недоступен: HTTP ${response.status}`);

  const payload = await response.json();
  const resources = payload.data.filter((resource) => resource.min_price > 0);

  if (resources.length < 2) throw new Error('В каталоге нужно минимум два ресурса с ценой больше нуля');

  return resources;
}

function expectedTotal(price, quantity) {
  return Math.round((price * quantity + Number.EPSILON) * 100) / 100;
}

async function calculate(index, first, second) {
  const quantityA = index;
  const quantityB = ((index * 37) % 500) + 1;
  const started = performance.now();

  try {
    const response = await fetch(`${BASE}/trade/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        side_a: [{ resource_id: first.id, quantity: quantityA }],
        side_b: [{ resource_id: second.id, quantity: quantityB }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const payload = await response.json();
    const elapsed = performance.now() - started;

    if (!response.ok) {
      return {
        ok: false,
        label: `#${index}`,
        status: response.status,
        error: JSON.stringify(payload),
        elapsed,
      };
    }

    const sideA = payload.data.side_a;
    const sideB = payload.data.side_b;
    const ok =
      sideA.lines[0]?.quantity === quantityA &&
      sideB.lines[0]?.quantity === quantityB &&
      sideA.total === expectedTotal(first.min_price, quantityA) &&
      sideB.total === expectedTotal(second.min_price, quantityB);

    return {
      ok,
      label: `#${index}`,
      status: response.status,
      elapsed,
      error: ok
        ? undefined
        : `ожидали A=${quantityA}/${expectedTotal(first.min_price, quantityA)}, ` +
          `B=${quantityB}/${expectedTotal(second.min_price, quantityB)}; ` +
          `получили A=${sideA.lines[0]?.quantity}/${sideA.total}, B=${sideB.lines[0]?.quantity}/${sideB.total}`,
    };
  } catch (error) {
    return {
      ok: false,
      label: `#${index}`,
      error: error instanceof Error ? error.message : String(error),
      elapsed: performance.now() - started,
    };
  }
}

async function catalog() {
  const started = performance.now();

  try {
    const response = await fetch(`${BASE}/resources`, { signal: AbortSignal.timeout(30_000) });
    const payload = await response.json();
    const ok = response.ok && Array.isArray(payload.data) && payload.data.length > 0;

    return {
      ok,
      label: 'каталог',
      status: response.status,
      elapsed: performance.now() - started,
      error: ok ? undefined : 'пустой или некорректный ответ',
    };
  } catch (error) {
    return {
      ok: false,
      label: 'каталог',
      error: error instanceof Error ? error.message : String(error),
      elapsed: performance.now() - started,
    };
  }
}

function report(title, results) {
  const passed = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok);
  const times = results.map((result) => result.elapsed).sort((a, b) => a - b);
  const percentile = (value) => times[Math.min(times.length - 1, Math.floor(times.length * value))];

  console.log(`\n${title}`);
  console.log(`  успешно: ${passed}/${results.length}`);
  console.log(
    `  время, мс: min ${times[0].toFixed(0)} · p50 ${percentile(0.5).toFixed(0)} · ` +
      `p95 ${percentile(0.95).toFixed(0)} · max ${times[times.length - 1].toFixed(0)}`,
  );

  for (const failure of failed.slice(0, 5)) {
    console.log(`  FAIL ${failure.label}${failure.status ? ` (HTTP ${failure.status})` : ''}: ${failure.error}`);
  }

  return failed.length === 0;
}

const catalogResources = await fetchCatalog();
const [first, second] = catalogResources;

console.log(`API: ${BASE}`);
console.log(`Пара: ${first.name} (${first.min_price}) / ${second.name} (${second.min_price})`);

let healthy = true;

for (const level of LEVELS) {
  const results = await Promise.all(
    Array.from({ length: level }, (_, index) => calculate(index + 1, first, second)),
  );
  healthy = report(`/trade/calculate — ${level} одновременных расчётов`, results) && healthy;
}

const catalogLevel = Math.max(...LEVELS);
const mixed = await Promise.all([
  ...Array.from({ length: catalogLevel }, (_, index) => calculate(index + 1, first, second)),
  ...Array.from({ length: catalogLevel }, () => catalog()),
]);
healthy = report(`Смешанно: ${catalogLevel} расчётов + ${catalogLevel} загрузок каталога`, mixed) && healthy;

if (!healthy) {
  console.error('\nНагрузочная проверка не пройдена.');
  process.exit(1);
}

console.log('\nНагрузочная проверка пройдена: ответы не перемешиваются, ошибок нет.');
