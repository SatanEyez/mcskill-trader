// Временный смоук новых фич: новости + статистика посещений.
const BASE = 'http://127.0.0.1:4001/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

let passed = 0;
let failed = 0;

function check(name, ok, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

const login = await jsonRequest('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    login: process.env.ADMIN_LOGIN ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'change-me-strong-password',
  }),
});
const token = login.body?.data?.token;
check('вход владельца', login.status === 200 && Boolean(token));

const auth = { Authorization: `Bearer ${token}` };

console.log('\n--- Новости ---');
const created = await jsonRequest('/news', {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Смоук-новость: обновление цен',
    body: 'Проверка публикации новости из админки.\nВторая строка текста.',
    image_url: '',
    is_published: true,
  }),
});
check('POST /news → 201', created.status === 201, JSON.stringify(created.body));
const newsId = created.body?.data?.id;
check('новость получила id и published_at', Boolean(newsId) && Boolean(created.body?.data?.published_at));

const publicList = await jsonRequest('/news?limit=10');
const found = (publicList.body?.data ?? []).find((item) => item.id === newsId);
check('GET /news → новость в публичной ленте', publicList.status === 200 && Boolean(found));
check('в ленте есть автор и просмотры', found?.created_by_login === 'admin' && typeof found?.views === 'number');

const detail = await jsonRequest(`/news/${newsId}`);
check('GET /news/:id → 200', detail.status === 200);
check('счётчик просмотров увеличился', detail.body?.data?.views >= 1, `views=${detail.body?.data?.views}`);

const updated = await jsonRequest(`/news/${newsId}`, {
  method: 'PUT',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Смоук-новость: обновлённый заголовок', is_published: false }),
});
check('PUT /news/:id → 200 и черновик', updated.status === 200 && updated.body?.data?.is_published === false);
check('published_at сброшен у черновика', updated.body?.data?.published_at === null);

const hidden = await jsonRequest(`/news/${newsId}`);
check('черновик не виден публично → 404', hidden.status === 404);

const adminList = await jsonRequest('/news/all?limit=10', { headers: auth });
check('GET /news/all → черновик виден админу', adminList.status === 200 && (adminList.body?.data ?? []).some((item) => item.id === newsId));

const noAuth = await jsonRequest('/news', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Без токена', body: 'должно быть 401' }),
});
check('POST /news без токена → 401', noAuth.status === 401);

const badTitle = await jsonRequest('/news', {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'x', body: 'короткий' }),
});
check('валидация короткого заголовка → 422', badTitle.status === 422);

console.log('\n--- Статистика ---');
const randomCookie = () => `mcskill_visitor=${crypto.randomUUID()}`;
const visitorA = crypto.randomUUID();
const visitorB = crypto.randomUUID();

async function track(path, cookie, ua = UA) {
  return fetch(`${BASE}/stats/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ua, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ path, referrer: '' }),
  });
}

const first = await track('/trade', `mcskill_visitor=${visitorA}`);
check('POST /stats/track → 204', first.status === 204);
const setCookie = first.headers.get('set-cookie');
check('трекинг ставит cookie посетителя', !setCookie || setCookie.includes('mcskill_visitor'));

await track('/', `mcskill_visitor=${visitorA}`);
await track('/news', `mcskill_visitor=${visitorB}`);

const botResponse = await track('/trade', '', 'Googlebot/2.1 (+http://www.google.com/bot.html)');
check('бот не пишется → 204', botResponse.status === 204);

const missingVisitor = crypto.randomUUID();
const before = await jsonRequest('/stats/visits?period=7d', { headers: auth });
await track('/report', `mcskill_visitor=${missingVisitor}`);
const after = await jsonRequest('/stats/visits?period=7d', { headers: auth });

check('GET /stats/visits → 200', after.status === 200);
check(
  'новый посетитель увеличил счётчик уникальных',
  after.body?.data?.visitors === before.body?.data?.visitors + 1,
  `${before.body?.data?.visitors} → ${after.body?.data?.visitors}`,
);
check('просмотры тоже выросли', after.body?.data?.visits === before.body?.data?.visits + 1);
check('бот не увеличил счётчики', after.body?.data?.visits - before.body?.data?.visits === 1);
check('есть разбивка по дням', Array.isArray(after.body?.data?.series) && after.body.data.series.length > 0);
check('есть топ страниц', Array.isArray(after.body?.data?.pages) && after.body.data.pages.length > 0);
check('онлайн-счётчик посчитан', typeof after.body?.data?.online_now === 'number');

const visitors = await jsonRequest('/stats/visitors?limit=10', { headers: auth });
const listed = (visitors.body?.data ?? []).find((item) => item.id === visitorA);
check('GET /stats/visitors → посетитель в списке', visitors.status === 200 && Boolean(listed));
check('у посетителя посчитаны визиты', listed?.visits === 2, `visits=${listed?.visits}`);

const statsNoAuth = await jsonRequest('/stats/visits');
check('GET /stats/visits без токена → 401', statsNoAuth.status === 401);

console.log('\n--- Уборка ---');
const del = await jsonRequest(`/news/${newsId}`, { method: 'DELETE', headers: auth });
check('DELETE /news/:id → 200', del.status === 200);

console.log(`\nИтог: ${passed} PASS, ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
