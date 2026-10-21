/**
 * Смоук-тест API McSkill Trader.
 * Актуальный контракт: логин/пароль + регистрация с одобрением, categories + category_id,
 * /trade/calculate, журнал действий /audit и загрузка изображений /uploads.
 *
 * Запуск: npm run test:api           (нужен поднятый API на :4000)
 *         API_URL=http://host:4000/api node api-test.mjs
 *
 * Скрипт создаёт временные сущности (категории, ресурсы, администраторов, файлы) и удаляет их в конце.
 */
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
const ORIGIN = BASE.replace(/\/api$/, '');
const UPLOADS_DIR = fileURLToPath(new URL('./server/uploads/', import.meta.url));
const ADMIN_LOGIN = process.env.ADMIN_LOGIN ?? 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'change-me-strong-password';
const STAMP = Date.now();
const TEST_PASSWORD = 'smoke-pass-2026';
const NEW_TEST_PASSWORD = 'smoke-pass-updated-2026';

let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

async function api(path, options = {}) {
  const { token, ...rest } = options;
  const isFormData = rest.body instanceof FormData;

  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: response.status, body };
}

const json = (value) => JSON.stringify(value);

/** Временные сущности, которые нужно убрать в любом случае. */
const cleanup = { categoryIds: [], resourceIds: [], userIds: [], uploadedFiles: [] };

async function cleanupAll(token) {
  for (const id of cleanup.resourceIds) {
    await api(`/resources/${id}`, { method: 'DELETE', token }).catch(() => {});
  }
  for (const id of cleanup.categoryIds) {
    await api(`/categories/${id}`, { method: 'DELETE', token }).catch(() => {});
  }
  for (const id of cleanup.userIds) {
    await api(`/users/${id}`, { method: 'DELETE', token }).catch(() => {});
  }
  for (const filename of cleanup.uploadedFiles) {
    await rm(join(UPLOADS_DIR, filename), { force: true }).catch(() => {});
  }
}

async function findUserByLogin(token, login) {
  const list = await api('/users', { token });
  return list.body?.data?.find((user) => user.login.toLowerCase() === login.toLowerCase()) ?? null;
}

const health = await api('/health');
check('health 200', health.status === 200, json(health.body));
check('health database', health.body?.database === 'mysql', json(health.body));

const login = await api('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ login: ADMIN_LOGIN, password: PASSWORD }),
});
check('login 200', login.status === 200 && Boolean(login.body?.data?.token), json(login.body));
check(
  'login возвращает данные владельца',
  login.body?.data?.user?.role === 'owner' && login.body?.data?.user?.login === ADMIN_LOGIN,
  json(login.body?.data?.user),
);
const token = login.body?.data?.token;

// Снимок каталога до теста: в конце сверяем, что смоук не затронул боевые данные.
const catalogBaseline = await api('/resources');
const baselineTotal = catalogBaseline.body?.meta?.total ?? -1;

try {
  section('Авторизация');
  const badLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: ADMIN_LOGIN, password: 'wrong-password' }),
  });
  check('неверный пароль → 401', badLogin.status === 401, json(badLogin.body));

  const unknownLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: `nobody_${STAMP}`, password: TEST_PASSWORD }),
  });
  check('неизвестный логин → 401', unknownLogin.status === 401, json(unknownLogin.body));

  const legacyBody = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password: PASSWORD }),
  });
  check('вход без логина (старый контракт) → 422', legacyBody.status === 422, json(legacyBody.body));

  const me = await api('/auth/me', { token });
  check(
    'auth/me → 200 владелец',
    me.status === 200 && me.body?.data?.role === 'owner' && me.body?.data?.login === ADMIN_LOGIN,
    json(me.body),
  );

  const badToken = await api('/auth/me', { token: 'not-a-real-token' });
  check('битый токен → 401', badToken.status === 401, json(badToken.body));

  section('Регистрация и одобрение доступа');
  const pendingLogin = `pending_${STAMP}`;
  const rejectedLogin = `reject_${STAMP}`;

  const shortLogin = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ login: 'x', password: TEST_PASSWORD }),
  });
  check('короткий логин → 422', shortLogin.status === 422, json(shortLogin.body));

  const shortPassword = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ login: pendingLogin, password: '123' }),
  });
  check('короткий пароль → 422', shortPassword.status === 422, json(shortPassword.body));

  const registerPending = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ login: pendingLogin, password: TEST_PASSWORD }),
  });
  check(
    'POST /auth/register → 201 со статусом pending',
    registerPending.status === 201 && registerPending.body?.data?.status === 'pending',
    json(registerPending.body),
  );

  const duplicateRegister = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ login: pendingLogin.toUpperCase(), password: TEST_PASSWORD }),
  });
  check('повторная регистрация логина → 409', duplicateRegister.status === 409, json(duplicateRegister.body));

  const pendingLoginAttempt = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: pendingLogin, password: TEST_PASSWORD }),
  });
  check('вход до одобрения → 403', pendingLoginAttempt.status === 403, json(pendingLoginAttempt.body));

  const usersNoToken = await api('/users');
  check('GET /users без токена → 401', usersNoToken.status === 401);

  const usersList = await api('/users', { token });
  check(
    'GET /users → список со счётчиками',
    usersList.status === 200 &&
      Array.isArray(usersList.body?.data) &&
      typeof usersList.body?.meta?.pending === 'number' &&
      usersList.body.meta.pending >= 1,
    json(usersList.body?.meta),
  );

  const pendingUser = usersList.body?.data?.find((user) => user.login === pendingLogin);
  check('новый аккаунт виден в списке', Boolean(pendingUser) && pendingUser.status === 'pending');

  if (pendingUser) cleanup.userIds.push(pendingUser.id);

  const approve = pendingUser
    ? await api(`/users/${pendingUser.id}/approve`, { method: 'POST', token })
    : { status: 0, body: null };
  check(
    'POST /users/:id/approve → 200 approved',
    approve.status === 200 &&
      approve.body?.data?.status === 'approved' &&
      approve.body?.data?.reviewed_by_login === ADMIN_LOGIN &&
      typeof approve.body?.data?.reviewed_at === 'string',
    json(approve.body),
  );

  const approvedLoginAttempt = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: pendingLogin, password: TEST_PASSWORD }),
  });
  check(
    'вход после одобрения → 200 (роль admin)',
    approvedLoginAttempt.status === 200 &&
      approvedLoginAttempt.body?.data?.user?.role === 'admin',
    json(approvedLoginAttempt.body),
  );
  const approvedToken = approvedLoginAttempt.body?.data?.token;

  const roleChangeByAdmin = pendingUser
    ? await api(`/users/${pendingUser.id}/role`, {
        method: 'PUT',
        token: approvedToken,
        body: JSON.stringify({ role: 'owner' }),
      })
    : { status: 0, body: null };
  check(
    'смена роли не владельцем → 403',
    roleChangeByAdmin.status === 403,
    json(roleChangeByAdmin.body),
  );

  const invalidRole = pendingUser
    ? await api(`/users/${pendingUser.id}/role`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ role: 'superuser' }),
      })
    : { status: 0, body: null };
  check('неизвестная роль → 422', invalidRole.status === 422, json(invalidRole.body));

  const selfOwnerId = login.body?.data?.user?.id;
  const selfRoleChange = selfOwnerId
    ? await api(`/users/${selfOwnerId}/role`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ role: 'admin' }),
      })
    : { status: 0, body: null };
  check('смена собственной роли → 400', selfRoleChange.status === 400, json(selfRoleChange.body));

  const promote = pendingUser
    ? await api(`/users/${pendingUser.id}/role`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ role: 'owner' }),
      })
    : { status: 0, body: null };
  check(
    'выдача полного доступа → 200 (owner)',
    promote.status === 200 && promote.body?.data?.role === 'owner',
    json(promote.body),
  );

  const demote = pendingUser
    ? await api(`/users/${pendingUser.id}/role`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ role: 'admin' }),
      })
    : { status: 0, body: null };
  check(
    'понижение до администратора → 200',
    demote.status === 200 && demote.body?.data?.role === 'admin',
    json(demote.body),
  );

  const changePassword = await api('/auth/password', {
    method: 'POST',
    token: approvedToken,
    body: JSON.stringify({
      current_password: TEST_PASSWORD,
      new_password: NEW_TEST_PASSWORD,
    }),
  });
  check(
    'POST /auth/password → 200 и новый токен',
    changePassword.status === 200 && Boolean(changePassword.body?.data?.token),
    json(changePassword.body),
  );

  const oldPasswordLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: pendingLogin, password: TEST_PASSWORD }),
  });
  check('старый пароль после смены → 401', oldPasswordLogin.status === 401, json(oldPasswordLogin.body));

  const newPasswordLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: pendingLogin, password: NEW_TEST_PASSWORD }),
  });
  check('новый пароль → 200', newPasswordLogin.status === 200, json(newPasswordLogin.body));

  const staleToken = await api('/auth/me', { token: approvedToken });
  check('токен, выданный до смены пароля, гасится → 401', staleToken.status === 401, json(staleToken.body));

  const wrongCurrent = await api('/auth/password', {
    method: 'POST',
    token: newPasswordLogin.body?.data?.token,
    body: JSON.stringify({
      current_password: 'definitely-wrong',
      new_password: 'another-password-2026',
    }),
  });
  check('неверный текущий пароль → 400', wrongCurrent.status === 400, json(wrongCurrent.body));

  const registerRejected = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ login: rejectedLogin, password: TEST_PASSWORD }),
  });
  check('вторая регистрация → 201', registerRejected.status === 201, json(registerRejected.body));

  const rejectedUser = await findUserByLogin(token, rejectedLogin);
  if (rejectedUser) cleanup.userIds.push(rejectedUser.id);

  const reject = rejectedUser
    ? await api(`/users/${rejectedUser.id}/reject`, { method: 'POST', token })
    : { status: 0, body: null };
  check(
    'POST /users/:id/reject → 200 rejected',
    reject.status === 200 &&
      reject.body?.data?.status === 'rejected' &&
      reject.body?.data?.reviewed_by_login === ADMIN_LOGIN,
    json(reject.body),
  );

  const rejectedLoginAttempt = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: rejectedLogin, password: TEST_PASSWORD }),
  });
  check('вход отклонённого аккаунта → 403', rejectedLoginAttempt.status === 403, json(rejectedLoginAttempt.body));

  const ownerUser = usersList.body?.data?.find((user) => user.id === login.body?.data?.user?.id);
  const deleteOwner = ownerUser
    ? await api(`/users/${ownerUser.id}`, { method: 'DELETE', token })
    : { status: 0, body: null };
  check('удаление владельца → 403', deleteOwner.status === 403, json(deleteOwner.body));

  const deleteRejected = rejectedUser
    ? await api(`/users/${rejectedUser.id}`, { method: 'DELETE', token })
    : { status: 0, body: null };
  check(
    'DELETE /users/:id → 200',
    deleteRejected.status === 200 && deleteRejected.body?.data?.login === rejectedLogin,
    json(deleteRejected.body),
  );

  if (rejectedUser) {
    cleanup.userIds = cleanup.userIds.filter((id) => id !== rejectedUser.id);
  }

  const deletedLoginAttempt = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: rejectedLogin, password: TEST_PASSWORD }),
  });
  check('вход удалённого аккаунта → 401', deletedLoginAttempt.status === 401, json(deletedLoginAttempt.body));

  section('Категории: публичный список');
  const categories = await api('/categories');
  check('GET /categories 200', categories.status === 200, json(categories.body));
  check(
    'категории содержат resource_count',
    Array.isArray(categories.body?.data) &&
      categories.body.data.length >= 5 &&
      categories.body.data.every((item) => typeof item.resource_count === 'number'),
    json(categories.body),
  );

  const removedLegacyRoute = await api('/resources/categories');
  check(
    'GET /resources/categories больше нет (400/404, не список)',
    (removedLegacyRoute.status === 400 || removedLegacyRoute.status === 404) &&
      Boolean(removedLegacyRoute.body?.error),
    json(removedLegacyRoute.body),
  );

  section('Категории: защита и валидация');
  const createNoToken = await api('/categories', {
    method: 'POST',
    body: JSON.stringify({ name: `Смоук-${STAMP}` }),
  });
  check('POST /categories без токена → 401', createNoToken.status === 401);

  const createCategory = await api('/categories', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: `Смоук-${STAMP}` }),
  });
  check('POST /categories → 201', createCategory.status === 201, json(createCategory.body));
  const categoryId = createCategory.body?.data?.id;
  if (categoryId) cleanup.categoryIds.push(categoryId);
  check('новая категория пустая', createCategory.body?.data?.resource_count === 0);

  const duplicateCategory = await api('/categories', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: `смоук-${STAMP}` }),
  });
  check('дубликат категории → 409', duplicateCategory.status === 409, json(duplicateCategory.body));

  const invalidCategory = await api('/categories', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: 'X' }),
  });
  check('короткое имя категории → 422', invalidCategory.status === 422, json(invalidCategory.body));

  const extraFieldCategory = await api('/categories', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: `Смоук-extra-${STAMP}`, color: 'red' }),
  });
  check('лишнее поле в категории → 422', extraFieldCategory.status === 422, json(extraFieldCategory.body));

  const renameCategory = await api(`/categories/${categoryId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ name: `Смоук-${STAMP}-renamed` }),
  });
  check(
    'PUT /categories/:id → 200',
    renameCategory.status === 200 && renameCategory.body?.data?.name === `Смоук-${STAMP}-renamed`,
    json(renameCategory.body),
  );

  const renameToExisting = await api(`/categories/${categoryId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ name: categories.body.data[0].name }),
  });
  check('переименование в занятое имя → 409', renameToExisting.status === 409, json(renameToExisting.body));

  const renameUnknown = await api('/categories/00000000-0000-4000-8000-000000000000', {
    method: 'PUT',
    token,
    body: JSON.stringify({ name: `Смоук-unknown-${STAMP}` }),
  });
  check('PUT несуществующей категории → 404', renameUnknown.status === 404, json(renameUnknown.body));

  const renameBadUuid = await api('/categories/not-a-uuid', {
    method: 'PUT',
    token,
    body: JSON.stringify({ name: `Смоук-bad-${STAMP}` }),
  });
  check('PUT с плохим UUID → 422', renameBadUuid.status === 422, json(renameBadUuid.body));

  section('Ресурсы: чтение');
  const list = await api('/resources');
  check('GET /resources 200', list.status === 200, json(list.body));
  check('каталог засеян (≥30)', (list.body?.meta?.total ?? 0) >= 30, `total=${list.body?.meta?.total}`);
  check(
    'DTO ресурса содержит category_id и category',
    list.body?.data?.[0]?.category_id !== undefined &&
      typeof list.body?.data?.[0]?.category === 'string',
    json(list.body?.data?.[0]),
  );
  check(
    'DTO ресурса без legacy-поля category как входа',
    !('category_name' in (list.body?.data?.[0] ?? {})),
  );

  const sortDesc = await api('/resources?sort=price_desc');
  check(
    'sort=price_desc работает',
    sortDesc.body?.data?.[0]?.min_price >= sortDesc.body?.data?.[1]?.min_price,
  );

  const search = await api(`/resources?search=${encodeURIComponent('алм')}`);
  check('поиск находит «Алмаз»', search.body?.data?.some((item) => item.name === 'Алмаз'));

  const badQueryUuid = await api('/resources?category_id=not-a-uuid');
  check('плохой category_id в query → 422', badQueryUuid.status === 422, json(badQueryUuid.body));

  section('Ресурсы: создание и валидация');
  const createNoTokenResource = await api('/resources', {
    method: 'POST',
    body: JSON.stringify({ name: `Смоук-ресурс-${STAMP}`, min_price: 1 }),
  });
  check('POST /resources без токена → 401', createNoTokenResource.status === 401);

  const legacyField = await api('/resources', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name: `Смоук-legacy-${STAMP}`,
      min_price: 10,
      category: 'Тест',
      image_url: '',
    }),
  });
  check('поле category во входе → 422', legacyField.status === 422, json(legacyField.body));

  const unknownCategory = await api('/resources', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name: `Смоук-unknown-cat-${STAMP}`,
      min_price: 10,
      image_url: '',
      category_id: '00000000-0000-4000-8000-000000000001',
    }),
  });
  check('несуществующая категория → 400', unknownCategory.status === 400, json(unknownCategory.body));

  const createResource = await api('/resources', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name: `Смоук-ресурс-${STAMP}`,
      min_price: 133.337,
      image_url: '/items/diamond.png',
      category_id: categoryId,
    }),
  });
  check('POST /resources → 201', createResource.status === 201, json(createResource.body));
  const resourceId = createResource.body?.data?.id;
  if (resourceId) cleanup.resourceIds.push(resourceId);
  check('цена округлена до 133.34', createResource.body?.data?.min_price === 133.34);
  check(
    'ресурс связан с категорией',
    createResource.body?.data?.category_id === categoryId,
    json(createResource.body?.data),
  );

  const duplicateResource = await api('/resources', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name: `смоук-ресурс-${STAMP}`,
      min_price: 5,
      image_url: '',
      category_id: null,
    }),
  });
  check('дубликат ресурса → 409', duplicateResource.status === 409, json(duplicateResource.body));

  const invalidResource = await api('/resources', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name: 'X',
      min_price: -5,
      image_url: 'javascript:alert(1)',
      category_id: null,
    }),
  });
  check('невалидный ресурс → 422', invalidResource.status === 422, json(invalidResource.body));

  section('Ресурсы: обновление и удаление');
  const filterByCategory = await api(`/resources?category_id=${categoryId}`);
  check(
    'фильтр по category_id возвращает созданный ресурс',
    filterByCategory.body?.data?.length === 1 && filterByCategory.body.data[0].id === resourceId,
    json(filterByCategory.body),
  );

  const getById = await api(`/resources/${resourceId}`);
  check('GET /resources/:id → 200', getById.status === 200 && getById.body?.data?.id === resourceId);

  const getUnknown = await api('/resources/00000000-0000-4000-8000-000000000002');
  check('GET несуществующего ресурса → 404', getUnknown.status === 404, json(getUnknown.body));

  const getBadUuid = await api('/resources/not-a-uuid');
  check('GET с плохим UUID → 400', getBadUuid.status === 400, json(getBadUuid.body));

  const updateResource = await api(`/resources/${resourceId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ min_price: 999.5 }),
  });
  check(
    'PUT /resources/:id → 200',
    updateResource.status === 200 && updateResource.body?.data?.min_price === 999.5,
    json(updateResource.body),
  );
  check('имя не изменилось', updateResource.body?.data?.name === `Смоук-ресурс-${STAMP}`);

  section('Трейд-калькулятор');
  const second = list.body.data.find((item) => item.id !== resourceId);

  const trade = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({
      side_a: [{ resource_id: resourceId, quantity: 64 }],
      side_b: [{ resource_id: second.id, quantity: 16 }],
    }),
  });
  check('POST /trade/calculate → 200', trade.status === 200, json(trade.body));

  const tradeData = trade.body?.data;
  const expectedA = Math.round(999.5 * 64 * 100) / 100;
  const expectedB = Math.round(second.min_price * 16 * 100) / 100;

  check('итог стороны А совпадает', tradeData?.side_a?.total === expectedA, `got=${tradeData?.side_a?.total} want=${expectedA}`);
  check('итог стороны Б совпадает', tradeData?.side_b?.total === expectedB, `got=${tradeData?.side_b?.total} want=${expectedB}`);
  check(
    'delta = total_b - total_a',
    tradeData?.delta === Math.round((expectedB - expectedA) * 100) / 100,
    `got=${tradeData?.delta}`,
  );
  check(
    'favored_side соответствует знаку delta',
    tradeData?.delta === 0
      ? tradeData?.favored_side === 'balanced'
      : tradeData?.delta > 0
        ? tradeData?.favored_side === 'b'
        : tradeData?.favored_side === 'a',
    `delta=${tradeData?.delta} favored=${tradeData?.favored_side}`,
  );
  check(
    'строки содержат name/image_url/category/unit_price',
    Boolean(
      tradeData?.side_a?.lines?.[0]?.name &&
        tradeData?.side_a?.lines?.[0]?.image_url !== undefined &&
        tradeData?.side_a?.lines?.[0]?.category &&
        tradeData?.side_a?.lines?.[0]?.unit_price === 999.5,
    ),
    json(tradeData?.side_a?.lines?.[0]),
  );
  check('items_count и total_quantity посчитаны', tradeData?.side_a?.items_count === 1 && tradeData?.side_a?.total_quantity === 64);

  // Монеты в сделке: входят в стоимость стороны и в delta, но не в items_total.
  const withCoins = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({
      side_a: [{ resource_id: resourceId, quantity: 64 }],
      side_b: [{ resource_id: second.id, quantity: 16 }],
      coins_a: 500.25,
      coins_b: 0,
    }),
  });
  const coinsData = withCoins.body?.data;
  check('POST /trade/calculate с монетами → 200', withCoins.status === 200, json(withCoins.body));
  check(
    'монеты стороны А входят в total',
    coinsData?.side_a?.items_total === expectedA &&
      coinsData?.side_a?.coins === 500.25 &&
      coinsData?.side_a?.total === Math.round((expectedA + 500.25) * 100) / 100,
    json(coinsData?.side_a),
  );
  check(
    'delta учитывает монеты',
    coinsData?.delta === Math.round((expectedB - expectedA - 500.25) * 100) / 100,
    `got=${coinsData?.delta}`,
  );
  check(
    'без монет coins = 0 (обратная совместимость)',
    tradeData?.side_a?.coins === 0 && tradeData?.side_a?.items_total === expectedA,
    json(tradeData?.side_a),
  );

  const badCoins = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({ side_a: [], side_b: [], coins_a: -1 }),
  });
  check('отрицательные монеты → 400', badCoins.status === 400, json(badCoins.body));

  const emptySide = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({ side_a: [], side_b: [{ resource_id: second.id, quantity: 1 }] }),
  });
  check(
    'пустая сторона А → ratio null, favored=b',
    emptySide.status === 200 && emptySide.body?.data?.ratio === null && emptySide.body?.data?.favored_side === 'b',
    json(emptySide.body),
  );

  const missingResource = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({
      side_a: [{ resource_id: '00000000-0000-4000-8000-000000000003', quantity: 1 }],
      side_b: [],
    }),
  });
  check('несуществующий ресурс → 404', missingResource.status === 404, json(missingResource.body));
  check(
    '404 содержит missing_resource_ids',
    Array.isArray(missingResource.body?.error?.details?.missing_resource_ids) &&
      missingResource.body.error.details.missing_resource_ids.includes(
        '00000000-0000-4000-8000-000000000003',
      ),
    json(missingResource.body),
  );

  const duplicateLines = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({
      side_a: [
        { resource_id: second.id, quantity: 1 },
        { resource_id: second.id, quantity: 2 },
      ],
      side_b: [],
    }),
  });
  check('дубликаты в одной стороне → 422', duplicateLines.status === 422, json(duplicateLines.body));

  const zeroQuantity = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({ side_a: [{ resource_id: second.id, quantity: 0 }], side_b: [] }),
  });
  check('quantity = 0 → 422', zeroQuantity.status === 422, json(zeroQuantity.body));

  const tooManyLines = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({
      side_a: Array.from({ length: 33 }, (_, index) => ({
        resource_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        quantity: 1,
      })),
      side_b: [],
    }),
  });
  check('33 предмета в стороне → 422', tooManyLines.status === 422, json(tooManyLines.body));

  const tradeExtraField = await api('/trade/calculate', {
    method: 'POST',
    body: JSON.stringify({
      side_a: [{ resource_id: second.id, quantity: 1, price: 1 }],
      side_b: [],
    }),
  });
  check('лишнее поле в строке трейда → 422', tradeExtraField.status === 422, json(tradeExtraField.body));

  section('Удаление категории с переносом ресурсов');
  const deleteCategory = await api(`/categories/${categoryId}`, { method: 'DELETE', token });
  check(
    'DELETE /categories/:id → moved_resources = 1',
    deleteCategory.status === 200 && deleteCategory.body?.data?.moved_resources === 1,
    json(deleteCategory.body),
  );
  cleanup.categoryIds.length = 0;

  const afterCategoryDelete = await api(`/resources/${resourceId}`);
  check(
    'ресурс перешёл в «Без категории»',
    afterCategoryDelete.body?.data?.category_id === null &&
      afterCategoryDelete.body?.data?.category === 'Без категории',
    json(afterCategoryDelete.body?.data),
  );

  const deleteCategoryAgain = await api(`/categories/${categoryId}`, { method: 'DELETE', token });
  check('повторное удаление категории → 404', deleteCategoryAgain.status === 404);

  section('Удаление ресурса');
  const deleteResource = await api(`/resources/${resourceId}`, { method: 'DELETE', token });
  check('DELETE /resources/:id → 200', deleteResource.status === 200, json(deleteResource.body));
  cleanup.resourceIds.length = 0;

  const afterResourceDelete = await api(`/resources/${resourceId}`);
  check('удалённый ресурс → 404', afterResourceDelete.status === 404);

  section('Стоп-лист удалённых предметов');
  const stopList = await api('/resources/exclusions', { token });
  const excluded = (stopList.body?.data ?? []).find(
    (item) => item.name === `Смоук-ресурс-${STAMP}`,
  );
  check('удалённый ресурс попал в стоп-лист импорта', Boolean(excluded), json(stopList.body));

  if (excluded) {
    const restoreExcluded = await api(`/resources/exclusions/${excluded.id}/restore`, {
      method: 'POST',
      token,
    });
    check(
      'возврат из стоп-листа → 200 и ресурс снова в каталоге',
      restoreExcluded.status === 200 &&
        restoreExcluded.body?.data?.name === `Смоук-ресурс-${STAMP}`,
      json(restoreExcluded.body),
    );

    const restoredId = restoreExcluded.body?.data?.id;
    const afterRestore = await api(`/resources/${restoredId}`);
    check('возвращённый ресурс доступен по /resources/:id', afterRestore.status === 200);

    // Убираем за собой: удаляем ресурс и чистим стоп-лист.
    await api(`/resources/${restoredId}`, { method: 'DELETE', token });
    const cleanupList = await api('/resources/exclusions', { token });
    const leftover = (cleanupList.body?.data ?? []).find(
      (item) => item.name === `Смоук-ресурс-${STAMP}`,
    );

    if (leftover) {
      const removed = await api(`/resources/exclusions/${leftover.id}`, {
        method: 'DELETE',
        token,
      });
      check('DELETE /resources/exclusions/:id → 200', removed.status === 200, json(removed.body));
    }
  }

  section('Загрузка изображений');
  // Пиксель 1×1 в PNG — минимальный валидный файл для проверки сигнатуры.
  const pxPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  const uploadNoToken = await api('/uploads', { method: 'POST', body: new FormData() });
  check('POST /uploads без токена → 401', uploadNoToken.status === 401, json(uploadNoToken.body));

  const pngForm = new FormData();
  pngForm.append('image', new Blob([pxPng], { type: 'image/png' }), 'smoke-pixel.png');
  const uploadPng = await api('/uploads', { method: 'POST', token, body: pngForm });
  const uploadedUrl = uploadPng.body?.data?.url;
  const uploadedFilename = uploadPng.body?.data?.filename;
  check(
    'POST /uploads (PNG) → 201 и путь /uploads/...',
    uploadPng.status === 201 && typeof uploadedUrl === 'string' && uploadedUrl.startsWith('/uploads/'),
    json(uploadPng.body),
  );

  if (uploadedFilename) cleanup.uploadedFiles.push(uploadedFilename);

  const servedImage = await fetch(`${ORIGIN}${uploadedUrl}`);
  check(
    'загруженный файл отдаётся по /uploads',
    servedImage.status === 200 && servedImage.headers.get('content-type')?.includes('image/png'),
    `${servedImage.status} ${servedImage.headers.get('content-type')}`,
  );

  const spoofedForm = new FormData();
  spoofedForm.append('image', new Blob([Buffer.from('это не картинка')], { type: 'image/png' }), 'fake.png');
  const uploadSpoofed = await api('/uploads', { method: 'POST', token, body: spoofedForm });
  check('поддельный image/png без сигнатуры → 422', uploadSpoofed.status === 422, json(uploadSpoofed.body));

  const textForm = new FormData();
  textForm.append('image', new Blob([Buffer.from('просто текст')], { type: 'text/plain' }), 'note.txt');
  const uploadText = await api('/uploads', { method: 'POST', token, body: textForm });
  check('файл не-изображение → 422', uploadText.status === 422, json(uploadText.body));

  section('Журнал действий');
  const auditNoToken = await api('/audit');
  check('GET /audit без токена → 401', auditNoToken.status === 401);

  const audit = await api('/audit?limit=50', { token });
  check(
    'GET /audit → 200 и записи',
    audit.status === 200 &&
      Array.isArray(audit.body?.data) &&
      audit.body.data.length > 0 &&
      audit.body?.meta?.total > 0,
    json(audit.body?.meta),
  );
  check(
    'запись журнала содержит автора, действие и время',
    audit.body?.data?.every(
      (entry) =>
        typeof entry.user_login === 'string' &&
        typeof entry.action === 'string' &&
        typeof entry.created_at === 'string' &&
        !Number.isNaN(Date.parse(entry.created_at)),
    ),
    json(audit.body?.data?.[0]),
  );

  const resourceAudit = await api('/audit?group=resources&limit=50', { token });
  check(
    'фильтр group=resources возвращает только ресурсы',
    resourceAudit.status === 200 &&
      resourceAudit.body.data.length > 0 &&
      resourceAudit.body.data.every((entry) => entry.action.startsWith('resource.')),
    json(resourceAudit.body?.data?.[0]),
  );

  const createEntry = resourceAudit.body?.data?.find(
    (entry) => entry.action === 'resource.create' && entry.entity_label === `Смоук-ресурс-${STAMP}`,
  );
  check(
    'в журнале есть создание смоук-ресурса',
    Boolean(createEntry) && createEntry.user_login === ADMIN_LOGIN,
    json(createEntry),
  );

  const updateEntry = resourceAudit.body?.data?.find(
    (entry) => entry.action === 'resource.update' && entry.entity_label === `Смоук-ресурс-${STAMP}`,
  );
  check(
    'журнал хранит изменение цены (from → to)',
    updateEntry?.details?.changes?.min_price?.from === 133.34 &&
      updateEntry?.details?.changes?.min_price?.to === 999.5,
    json(updateEntry?.details),
  );

  const deleteEntry = resourceAudit.body?.data?.find(
    (entry) => entry.action === 'resource.delete' && entry.entity_label === `Смоук-ресурс-${STAMP}`,
  );
  check('журнал хранит удаление ресурса', Boolean(deleteEntry), json(deleteEntry));

  const searchAudit = await api(`/audit?search=${encodeURIComponent(pendingLogin)}&limit=50`, { token });
  check(
    'поиск по журналу находит действия с логином',
    searchAudit.status === 200 && searchAudit.body.data.some((entry) => entry.user_login === pendingLogin),
    json(searchAudit.body?.data?.[0]),
  );

  const approveEntry = searchAudit.body?.data?.find(
    (entry) => entry.action === 'user.approve' && entry.entity_label === pendingLogin,
  );
  check('журнал хранит одобрение заявки', Boolean(approveEntry), json(approveEntry));

  const passwordEntry = searchAudit.body?.data?.find((entry) => entry.action === 'user.password_change');
  check('журнал хранит смену пароля', Boolean(passwordEntry), json(passwordEntry));

  const roleEntry = searchAudit.body?.data?.find(
    (entry) => entry.action === 'user.role_change' && entry.entity_label === pendingLogin,
  );
  check(
    'журнал хранит смену роли (from → to)',
    roleEntry?.details?.from === 'owner' && roleEntry?.details?.to === 'admin',
    json(roleEntry?.details),
  );

  const userFilterAudit = await api('/audit?group=users&limit=50', { token });
  check(
    'фильтр group=users содержит регистрацию',
    userFilterAudit.body?.data?.some(
      (entry) => entry.action === 'user.register' && entry.entity_label === pendingLogin,
    ),
    json(userFilterAudit.body?.data?.[0]),
  );

  const authAudit = await api('/audit?group=auth&limit=50', { token });
  check(
    'фильтр group=auth содержит неудачные входы',
    authAudit.body?.data?.some((entry) => entry.action.startsWith('auth.login')),
    json(authAudit.body?.data?.[0]),
  );

  const badLimit = await api('/audit?limit=5000', { token });
  check('limit вне диапазона → 422', badLimit.status === 422, json(badLimit.body));

  const badGroup = await api('/audit?group=whatever', { token });
  check('неизвестная группа в журнале → 422', badGroup.status === 422, json(badGroup.body));
} finally {
  await cleanupAll(token);

  const catalogAfterCleanup = await api('/resources');
  check(
    'каталог не пострадал после теста (total не изменился)',
    catalogAfterCleanup.body?.meta?.total === baselineTotal,
    `до теста ${baselineTotal}, после ${catalogAfterCleanup.body?.meta?.total}`,
  );
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
