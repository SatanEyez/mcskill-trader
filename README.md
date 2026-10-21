# McSkill Trader

Трейд-калькулятор и каталог минимальных цен для сервера **McSkill OneBlock**.
Монорепозиторий на npm workspaces: `server` (REST API) + `client` (React SPA).

- **Главная** `/` — каталог ресурсов, фильтры, быстрый калькулятор обмена.
- **Трейд-калькулятор** `/trade` — две стороны обмена (до 32 предметов в каждой), количество, дельта и доплата.
  Кнопка **«Посчитать минка к минке»** добирает количество в менее ценной стороне по минимальным ценам
  (округление вверх), списки сохраняются в `localStorage`.
- **Админка** `/admin` — ресурсы (включая загрузку картинки с компьютера), `/admin/categories` — категории, `/admin/users` — доступы, `/admin/logs` — журнал действий.
  Вход по логину и паролю; новые аккаунты регистрируются на `/admin/login` и ждут одобрения действующего администратора.

## Стек

| Часть | Технологии |
|---|---|
| Frontend | React 18, TypeScript, Vite 6, Tailwind 3.4, React Router 6, lucide-react |
| Backend | Node 20+, Express 4.21 (ESM, NodeNext), Zod, JWT, helmet, express-rate-limit |
| БД | MySQL 8.0+ (драйвер `mysql2`), схема — `server/migrations/*.sql` |
| Архитектура | routes → controller → service → db, валидация Zod, JSON в **snake_case** |

Полезные команды: `npm run dev`, `npm run build`, `npm run typecheck --workspace server|client`, `npm run db:seed[:force]`, `npm run test:api`.

## Быстрый старт

Нужен запущенный MySQL 8.0+ и база `mcskill_trader`:

```sql
CREATE DATABASE mcskill_trader CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'mcskill'@'localhost' IDENTIFIED BY 'mcskill';
GRANT ALL PRIVILEGES ON mcskill_trader.* TO 'mcskill'@'localhost';
```

```powershell
npm install
Copy-Item .env.example server\.env   # поправьте JWT_SECRET и ADMIN_PASSWORD
Copy-Item mysql-connection.env.example mysql-connection.env  # логин/пароль MySQL
npm run dev                          # API :4000 + Vite :5173
```

- Сайт: http://localhost:5173
- API: http://localhost:4000/api/health
- Админка: http://localhost:5173/admin (при первом запуске создаётся владелец `admin` / `change-me-strong-password` — логин и пароль из `ADMIN_LOGIN` и `ADMIN_PASSWORD`)
- Токен хранится в `localStorage` под ключом `mcskill.trader.token`.

Миграции применяются автоматически при старте API (`server/migrations/*.sql`,
учёт в `schema_migrations`). Демо-данные засеиваются, если база пуста
(`SEED_ON_START=true`).

> MySQL работает как отдельный сервис: API можно перезапускать сколько угодно,
> данные сохраняются. Проверить, что база слушает порт: `Get-NetTCPConnection -LocalPort 3306`.

## Доступ в админку

| Роль | Права |
|---|---|
| `owner` | всё: одобрение и отклонение заявок, удаление любых администраторов, выдача и снятие роли владельца, смена своего пароля |
| `admin` | каталог и категории, одобрение/отклонение заявок, удаление непринятых заявок, смена своего пароля |

- Регистрация (`POST /api/auth/register`) создаёт заявку со статусом `pending`; вход откроется только после одобрения в разделе «Пользователи».
- В списке видно, **кто и когда** одобрил или отклонил заявку: логин ревьюера хранится снимком и не пропадает даже после удаления его аккаунта.
- Отклонённая заявка остаётся в списке со статусом `rejected` — её можно удалить.
- Владелец может выдать полный доступ иконкой короны в списке пользователей (и снять его), но не может менять собственную роль и роль другого владельца оставляет на его усмотрение.
- Пароли хранятся как scrypt-хеш (`scrypt:<salt>:<hash>`), уникальность логина — по `LOWER(login)`.
- Токен содержит отпечаток текущего пароля: смена пароля, отклонение или удаление аккаунта сразу гасят выданные ранее токены.
- Каждое действие (вход, регистрация, одобрение, удаление, изменения каталога) пишется в `audit_log`; журнал виден в разделе «Логи» с фильтрами по группам, периоду и автору, время отображается по Москве.

Заявки на доступ и журнал требуют авторизации — эндпоинты `/api/users` и `/api/audit` закрыты Bearer-токеном.

## Изображения ресурсов

В форме ресурса можно указать прямую ссылку (`https://…` или локальный путь `/items/…`) либо
загрузить файл с компьютера: перетащить в область загрузки или нажать «Выбрать файл».
Поддерживаются PNG, JPG, WebP и GIF до 5 МБ.

- Файл сохраняется в `server/uploads` (`UPLOAD_DIR`) и раздаётся по `/uploads/<uuid>.<ext>`;
  в поле `image_url` подставляется этот путь, поэтому картинки не зависят от внешних хостингов.
- Формат проверяется по сигнатуре файла, а не по `Content-Type` и расширению; расширение
  приводится к реальному формату.
- Загрузка доступна только администратору (`POST /api/uploads`, Bearer + `multipart/form-data`, поле `image`).
- Пересборка клиента и `client/dist` картинки не затрагивают — они лежат вне сборки.

## Переменные окружения (`server/.env`)

| Переменная | Назначение | Значение по умолчанию |
|---|---|---|
| `PORT` | порт API | `4000` |
| `NODE_ENV` | `development` / `production` / `test` | `development` |
| `CLIENT_ORIGIN` | список origin для CORS (через запятую) | `http://localhost:5173` |
| `ADMIN_LOGIN` | логин владельца при первом запуске | `admin` |
| `ADMIN_PASSWORD` | пароль владельца (создание при первом запуске) | `change-me-strong-password` |
| `JWT_SECRET` | секрет подписи JWT (≥16 символов) | dev-значение |
| `JWT_EXPIRES_IN` | срок жизни токена | `12h` |
| `UPLOAD_DIR` | каталог загруженных картинок (отдаётся по `/uploads/<файл>`) | `./uploads` |
| `SEED_ON_START` | засеивать демо-данными при пустой базе | `true` |

Параметры MySQL (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`,
`MYSQL_CONNECTION_LIMIT`) задаются отдельно — в `mysql-connection.env` в корне проекта (см. выше).

В продакшене обязательно смените `ADMIN_LOGIN`, `ADMIN_PASSWORD` и `JWT_SECRET` — при дефолтных
значениях сервер пишет предупреждения в лог.

## MySQL и phpMyAdmin

Схема создаётся миграциями при старте API — вручную создавать таблицы не нужно.

### Настройки подключения — `mysql-connection.env`

Все логины и пароли к базе хранятся в одном файле в корне проекта:

```ini
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=mcskill
MYSQL_PASSWORD=change-me
MYSQL_DATABASE=mcskill_trader
MYSQL_SSL=false
```

Его читают **API**, **phpMyAdmin** и **`mysql-connect.cmd`** — править нужно только здесь.
После изменения перезапустите API (`Ctrl+C` → `npm run dev`) и обновите страницу phpMyAdmin.

Консольный клиент MySQL с этими же настройками (двойной клик по `mysql-connect.cmd`):

```powershell
.\mysql-connect.cmd                                              # интерактивный SQL
.\mysql-connect.cmd -Query "SELECT COUNT(*) FROM resources;"      # разовый запрос
```

Для облачной базы (`MYSQL_SSL=true`, например TiDB) `mysql-connect.cmd` сам запускает
`mysql-cli.mjs` на `mysql2`: `mysql.exe` 9.x не поддерживает `mysql_native_password`,
который использует TiDB. Напрямую: `node mysql-cli.mjs --query "SELECT 1" [--json]`.

**Вариант 1 — локальный MySQL (Windows, без установки службы):**

```powershell
# база и пользователь (из корня проекта)
mysql -u root -h 127.0.0.1 -P 3306 -e "CREATE DATABASE IF NOT EXISTS mcskill_trader CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -u root -h 127.0.0.1 -P 3306 -e "CREATE USER IF NOT EXISTS 'mcskill'@'localhost' IDENTIFIED BY 'mcskill'; GRANT ALL PRIVILEGES ON mcskill_trader.* TO 'mcskill'@'localhost';"
```

**Вариант 2 — Docker:**

```powershell
docker compose up -d          # MySQL 8.4 на :3306, база и пользователь создаются сами
```

**Вариант 3 — TiDB Cloud Starter (облако, бесплатный тариф):**

1. Создайте кластер на https://tidbcloud.com и базу `mcskill_trader` (кодировка `utf8mb4`, collation `utf8mb4_0900_ai_ci`).
2. В `mysql-connection.env` укажите host/port/user/password из консоли TiDB и включите TLS:

   ```ini
   MYSQL_HOST=gateway01.<регион>.prod.aws.tidbcloud.com
   MYSQL_PORT=4000
   MYSQL_USER=<user>.root
   MYSQL_PASSWORD=<пароль>
   MYSQL_DATABASE=mcskill_trader
   MYSQL_SSL=true
   ```

3. Запустите API — миграции применятся сами.

TiDB совместим с MySQL не полностью, поэтому мигратор пропускает операторы, перед которыми
стоит комментарий `-- @tidb: skip` (сейчас это `CHECK`-ограничения: TiDB их не хранит).
Генерируемая колонка `resources.name_manual_key` объявлена как `VIRTUAL` — только так её
можно добавить через `ALTER TABLE` и в MySQL, и в TiDB.

**phpMyAdmin** (веб-интерфейс к базе): http://127.0.0.1:8081
Логин `root` (пароль пустой в локальной сборке) или `mcskill` / `mcskill`; для TiDB — логин/пароль
из `mysql-connection.env` (phpMyAdmin читает этот же файл и сам включает TLS).
Запуск: `php -S 127.0.0.1:8081 -t C:\Users\<user>\phpmyadmin-stack\phpmyadmin`.

### Что переживает перезаливку и деплой

| Данные | Где хранятся |
|---|---|
| Ресурсы, цены, категории, администраторы, роли, журнал, обращения | база MySQL/TiDB |
| Аватары профилей и картинки, загруженные через админку | база (`uploaded_files`, MEDIUMBLOB) |
| Иконки прайса (9 252 шт.) | git (`server/uploads/prices/`), отдаются статикой |
| Копия иконок прайса | база (`price_icons`, MEDIUMBLOB) |
| Удалённые предметы (стоп-лист импорта) | база (`import_exclusions`) |

Диск контейнера на Render эфемерный, поэтому `POST /api/uploads` больше не пишет файлы на диск:
тело файла сохраняется в базе, а `/uploads/<uuid>.<ext>` читается из неё. Иконки прайса
по-прежнему лежат в git и отдаются статикой, а `npm run db:price-icons` (в `server`) кладёт их
копию в `price_icons`: если файла на диске нет, `/uploads/prices/<файл>` отдаст его из базы.
`mysql-connection.env` в git не попадает: на хостинге задайте `MYSQL_*` переменными окружения.

### Удалённые предметы

Удаление ресурса в админке — это не только `DELETE`: предмет попадает в стоп-лист
(`import_exclusions`), поэтому следующий импорт прайса его не вернёт. В админке под таблицей
есть блок «Удалённые предметы»: там видно, кто и когда удалил предмет, а кнопка «Вернуть»
добавляет его обратно в каталог с прежней ценой, цветом и иконкой.

## Деплой на Render

В репозитории лежит `render.yaml` — проще всего: **New → Blueprint → выбрать репозиторий**.
Render сам подставит сборку, старт, health-check (`/api/health`) и регион (Сингапур — ближе
всего к TiDB в Токио), а секреты спросит при создании.

Если создавать **Web Service** вручную, укажите:

| Параметр | Значение |
|---|---|
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Region | Singapore (ближе к TiDB) |

Переменные окружения:

| Переменная | Значение |
|---|---|
| `NODE_ENV` | `production` |
| `SEED_ON_START` | `false` (в базе уже есть ресурсы) |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` | из `mysql-connection.env` |
| `MYSQL_SSL` | `true` (TiDB Cloud пускает только по TLS) |
| `JWT_SECRET` | случайная строка ≥16 символов |

Важно:

- `NODE_ENV=production` отключает devDependencies, поэтому в build-команде нужен `--include=dev`: иначе не будет `tsc` и `vite`. В репозитории уже лежит `.npmrc` с `include=dev`, так что сборка не зависит от того, как именно вызван npm (`npm ci`, `npm install`).
- Миграции применяются автоматически при старте API; повторный деплой их не ломает.
- В TiDB Cloud должен быть разрешён доступ с адресов Render (IP Access List → `0.0.0.0/0`), иначе API не подключится к базе.
- Клиент собирается в `client/dist` и раздаётся тем же сервером, поэтому CORS и отдельный фронтенд не нужны.
- На бесплатном плане сервис засыпает после простоя: первый запрос после паузы отвечает ~30–60 с.

## Новости

Публичная лента доступна по адресу `/news`, последние три публикации выводятся блоком на главной
странице. Публиковать их можно в админке — раздел **«Новости»** (`/admin/news`): заголовок, текст,
необязательная картинка (загружается в базу через `/api/uploads`) и переключатель «опубликовать».

- Черновик сохраняется, но не виден на сайте — только в админском списке.
- Каждая публикация и правка пишется в журнал действий (`news.create`, `news.update`, `news.delete`).
- Просмотры считаются автоматически при открытии новости.
- Право на публикацию — `news.write` (владелец, администратор, модератор).

## Статистика посещений

Раздел **«Статистика»** (`/admin/stats`) показывает, сколько людей реально заходило на сайт:

- **Просмотры** — все открытия публичных страниц за период.
- **Уникальные посетители** — считаются по долгоживущей cookie `mcskill_visitor` (год), поэтому
  один человек не превращается в нескольких при каждом заходе.
- **Новые и вернувшиеся** — новые считаются по самому первому визиту внутри периода.
- **Онлайн** — уникальные посетители за последние 5 минут.
- **Топ страниц** и таблица посетителей: время первого и последнего визита, число заходов.

Боты, краулеры, мониторы и headless-браузеры отфильтровываются по User-Agent и в статистику не
попадают. Админка не трекается — иначе владельцы накручивали бы счётчики сами себе.

Данные лежат в таблице `site_visits` (одна строка = один просмотр), право на просмотр — `stats.view`.

## API

База: `/api`. Успех — `{ data, meta? }`, ошибка — `{ error: { message, details? } }`.

| Метод | Путь | Доступ |
|---|---|---|
| GET | `/health` | public |
| POST | `/auth/register` | public (`{ login, password }` → 201 `{ login, status, created_at }`, заявка в статусе `pending`) |
| POST | `/auth/login` | public (`{ login, password }` → `{ token, token_type, expires_in, user }`) |
| GET | `/auth/me` | Bearer |
| POST | `/auth/password` | Bearer (`{ current_password, new_password }` → новый токен) |
| GET | `/users?status=` | Bearer (`pending` / `approved` / `rejected`) |
| POST | `/users/:id/approve`, `/users/:id/reject` | Bearer |
| PUT | `/users/:id/role` | Bearer, только `owner` (`{ role }` = `owner` / `admin`) |
| PUT | `/users/me/avatar` | Bearer (multipart, поле `avatar`: PNG/JPG/WebP/GIF, до 2 МБ) |
| DELETE | `/users/me/avatar` | Bearer |
| DELETE | `/users/:id` | Bearer, право `users.delete` (владельца и системный аккаунт удалить нельзя) |
| GET | `/audit?group=&period=&user_id=&search=&limit=&offset=` | Bearer |
| GET | `/categories` | public (со `resource_count`) |
| POST/PUT/DELETE | `/categories`, `/categories/:id` | Bearer |
| GET | `/resources?search=&category_id=&sort=` | public (`sort`: `name_asc`, `price_asc`, `price_desc`, `newest`) |
| GET | `/resources/:id` | public |
| POST/PUT/DELETE | `/resources`, `/resources/:id` | Bearer |
| GET | `/resources/exclusions` | Bearer, право `resources.delete` (стоп-лист импорта) |
| POST | `/resources/exclusions/:id/restore` | Bearer, право `resources.delete` (вернуть предмет в каталог) |
| DELETE | `/resources/exclusions/:id` | Bearer, право `resources.delete` (убрать запись из стоп-листа) |
| POST | `/trade/calculate` | public |
| POST | `/uploads` | Bearer (multipart, поле `image`: PNG/JPG/WebP/GIF, до 5 МБ → `{ url, filename, mime, size }`; файл хранится в базе) |
| GET | `/uploads/:file` | public (иконка прайса из git или файл из базы) |
| GET | `/uploads/prices/:file` | public (иконка прайса из git, иначе из `price_icons`) |
| GET | `/news?limit=&offset=` | public (опубликованные новости, свежие сверху) |
| GET | `/news/all?limit=&offset=` | Bearer, право `news.write` (включая черновики) |
| GET | `/news/:id` | public (черновик виден только администратору) |
| POST/PUT/DELETE | `/news`, `/news/:id` | Bearer, право `news.write` |
| POST | `/stats/track` | public (`{path}` → 204, ставит cookie посетителя, ботов игнорирует) |
| GET | `/stats/visits?period=24h\|7d\|30d\|all` | Bearer, право `stats.view` |
| GET | `/stats/visitors?limit=&offset=` | Bearer, право `stats.view` |

### Трейд-расчёт

```json
POST /api/trade/calculate
{
  "side_a": [{ "resource_id": "<uuid>", "quantity": 64 }],
  "side_b": [{ "resource_id": "<uuid>", "quantity": 16 }]
}
```

Ответ: `{ side_a, side_b, delta, favored_side, ratio }`, где каждая сторона — это
`{ lines[], total, items_count, total_quantity }`, `delta = total_b − total_a`
(`> 0` — дороже сторона Б, доплачивает отдающая сторона), `favored_side` — `a` / `b` / `balanced`.

Ограничения: до 32 строк на сторону, `quantity` — целое `1…1e9`, `resource_id`
уникален внутри стороны. Неизвестный ресурс → 404 с `details.missing_resource_ids`.
Клиент дублирует ту же формулу локально (`client/src/lib/trade.ts`) для мгновенного UI.

### «Минка к минке»

Кнопка в панели «Итог сделки» выравнивает **менее ценную сторону** по стоимости второй —
работает в обе стороны: и для «Я отдаю», и для «Я получаю». Например, 10 000 мета-материи
(2 214 107 за штуку) превращаются в 18 450 892 алмаза (1 200 за штуку), чтобы принятая
сторона не была дешевле отданной.

- Пересчитывается сторона, которая по минималкам дешевле; вторая остаётся как была.
- Пропорции внутри стороны сохраняются — все строки получают один множитель.
- Количество всегда округляется **вверх** и не опускается ниже 1 — минимальные цены
  не нарушаются, вторая сторона не получает меньше своей минки.
- Если округление вверх перелетает цель сильнее текущего разрыва, кнопка блокируется:
  точнее целыми штуками не выйдет, а при повторных нажатиях суммы «пинг-понговали» бы.
- Считать нечего, если одна из сторон пуста или у предметов нулевые минималки.
- Расчёт локальный (данные каталога уже загружены), сервер не вызывается.

### Проверка по правилам экономики

Под калькулятором выводится панель «Проверка по правилам экономики». Она пересчитывается
на каждое изменение списков и показывает нарушения и замечания:

- **п. 9.6** — цена не должна выходить за минимальную и допустимый потолок (до 1 млн — ×10,
  от 1 до 10 млн — ×5, свыше 10 млн — ×2). Калькулятор всегда считает по минималке, поэтому
  проверка страхует будущие расчёты с наценкой.
- **п. 9.7** — запрещена публичная раздача земли, булыжника, камня, стекла и песка. Нарушением
  считается сделка без встречной стороны, в которой отдают эти предметы.
- **п. 9.9** — стоимость обмена оценивается по минимальным ценам; это указано в подписи панели.
- **п. 9.10** — если стороны не равны, показывается предупреждение: доплата должна пройти
  в игре и подтверждаться логами, иначе сделку могут квалифицировать как неравноценный обмен.
  Разница до **10% от стоимости меньшей стороны** считается равноценностью: такой обмен
  подсвечивается зелёным («Обмен верный»), рядом показывается фактический процент разницы.
- **п. 9.11** — запрещён обмен легкодобываемых ресурсов (пасеки, материя, молекулярные фермы,
  репликатор) на труднодоступные (энергия, эндгейм, слияния от пробуждённого). Панель
  перечисляет конкретные предметы, которые образовали такую пару.

Классификация предметов для п. 9.11 ведётся по названию в `client/src/lib/trade-rules.ts`;
по мере появления новых ресурсов списки шаблонов расширяются. Спорные случаи стоит уточнять
у состава сервера — панель носит предупреждающий характер и не блокирует расчёт.
Быстрый калькулятор на главной (`/#calculator`) показывает компактное уведомление о нарушениях
и ссылку на полный трейд-калькулятор.

### Одновременная работа пользователей

Трейд-калькулятор не хранит состояние на сервере: списки считаются в браузере и лежат
в `localStorage` каждого устройства, поэтому посетители не видят и не затирают трейды
друг друга. Сервер отдаёт только общий каталог минималок.

- `GET /resources` кешируется в памяти API на 15 секунд; кеш сбрасывается после любых
  изменений ресурсов и категорий, поэтому правки админки видны сразу.
- Вкладки одного браузера синхронизируются через событие `storage`: правка в одной вкладке
  сразу появляется в другой, и последняя запись не затирает чужой трейд молча.
- Ограничители входа/регистрации считаются по IP и на публичный калькулятор не влияют.
- Проверка: `npm run test:load` — параллельные расчёты и загрузки каталога с проверкой,
  что каждый пользователь получает свой результат.

### Модель данных

```ts
Resource = { id, name, min_price, image_url, category_id: string | null,
             category /* имя или «Без категории» */, created_at, updated_at }
Category = { id, name, resource_count, created_at, updated_at }
AdminUser = { id, login, role: 'owner'|'admin', status: 'pending'|'approved'|'rejected',
              created_at, updated_at, reviewed_at, reviewed_by, reviewed_by_login, last_login_at }
```

Поля `category` во входных данных нет — только `category_id`.
При удалении категории ресурсы не удаляются, а переходят в «Без категории»
(`ON DELETE SET NULL`), API возвращает `moved_resources`.

## Проверки

```powershell
npm run typecheck --workspace server
npm run typecheck --workspace client
npm run build --workspace client
npm run test:api                  # смоук-тест живого API (нужен запущенный сервер)
npm run test:load                 # конкурентная нагрузка: расчёты + каталог
```

`npm run test:load` — проверка многопользовательского режима: несколько волн параллельных
`POST /trade/calculate` (по умолчанию 25, 50, 100 и 200 запросов) плюс смешанная волна с
загрузками каталога. У каждого запроса своя пара количеств, поэтому тест ловит и ошибки,
и «перемешивание» ответов между пользователями. Уровни задаются через `LOAD_LEVELS`
(например, `LOAD_LEVELS=50,100,200`), адрес API — через `API_URL`.

`npm run test:api` — 109 проверок: health, регистрация и одобрение заявок (регистрация → `pending`
→ `403` на входе → одобрение → вход), выдача и снятие роли владельца (включая запрет для не-владельца),
смена пароля и гашение старых токенов, журнал действий, CRUD категорий и ресурсов, загрузка изображений
(тип, сигнатура файла, раздача по `/uploads`), валидация (401/404/409/422), трейд-расчёт и перенос
ресурсов при удалении категории. Скрипт создаёт временные сущности и удаляет их в конце (включая
загруженные файлы); логин и пароль владельца берутся из `ADMIN_LOGIN` / `ADMIN_PASSWORD`.
В конце тест сверяет общее количество ресурсов с исходным и падает, если каталог изменился.

## Структура

```
server/src/modules/{auth,users,audit,categories,resources,trade,uploads}/   routes → controller → service → db
server/migrations/                                      001_init, 002_dynamic_categories, 003_admin_users_and_audit, 004_reviewed_by_login
server/uploads/                                         загруженные картинки (UPLOAD_DIR, раздаются по /uploads)
client/src/pages/                                       HomePage, TradePage, AdminPage, AdminCategoriesPage, AdminUsersPage, AdminLogsPage, AdminLoginPage
client/src/components/{home,trade,admin,ui,layout}/      UI-блоки
client/src/lib/                                         api, trade, format, constants, audit
```

Изображения предметов лежат в `client/public/items`, поле `image_url` принимает
внешний http(s)-URL или локальный путь вида `/items/diamond.png`.
