import { open, readFile, rm } from 'node:fs/promises';
import { readFileSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

/**
 * Блокировка каталога PGlite на уровне приложения.
 *
 * PGlite — это PostgreSQL, скомпилированный в WASM: он не умеет надёжно
 * различать два процесса, открывших один каталог данных. Два API на одной базе
 * или жёсткое завершение процесса во время записи ломают WAL (PANIC: could not
 * locate a valid checkpoint record). Чтобы это не повторялось, перед открытием
 * базы создаём рядом lock-файл с PID и проверяем, что владелец ещё жив.
 */
export interface DbLock {
  release: () => Promise<void>;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM означает, что процесс существует, но принадлежит другому пользователю.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function readOwnerPid(lockFile: string): Promise<number | null> {
  try {
    const raw = await readFile(lockFile, 'utf8');
    const pid = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/** Атомарно создаёт lock-файл: из двух стартующих процессов выигрывает только один. */
async function tryClaim(lockFile: string): Promise<boolean> {
  try {
    const handle = await open(lockFile, 'wx');

    try {
      await handle.writeFile(`${process.pid}\n`, 'utf8');
    } finally {
      await handle.close();
    }

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}

export async function acquireDbLock(lockFile: string): Promise<DbLock> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const ownerPid = await readOwnerPid(lockFile);
    const ours = ownerPid === process.pid;
    const stale = ownerPid !== null && !ours && !isPidAlive(ownerPid);

    // Свой PID после неудачного открытия или умерший процесс — освобождаем файл.
    if (ours || stale) {
      await rm(lockFile, { force: true });
    }

    if (ownerPid === null || ours || stale) {
      if (await tryClaim(lockFile)) {
        let released = false;

        const release = async (): Promise<void> => {
          if (released) return;
          released = true;

          // Не удаляем чужой lock: за время работы файл мог перейти новому процессу.
          try {
            const current = await readFile(lockFile, 'utf8');
            if (current.trim() === String(process.pid)) {
              await rm(lockFile, { force: true });
            }
          } catch {
            // Файла уже нет — освобождать нечего.
          }
        };

        // Подстраховка на случай process.exit без closeDb.
        process.once('exit', () => {
          try {
            if (readFileSync(lockFile, 'utf8').trim() === String(process.pid)) {
              rmSync(lockFile, { force: true });
            }
          } catch {
            // Ничего не остаётся, кроме как оставить файл — при следующем старте он считается устаревшим.
          }
        });

        return { release };
      }
    }

    // Возможно, предыдущий процесс ещё закрывает базу — даём ему время.
    await delay(250);
  }

  const ownerPid = await readOwnerPid(lockFile);
  throw new Error(
    `База данных уже открыта другим процессом API (PID ${ownerPid ?? 'неизвестен'}). ` +
      'PGlite допускает только один процесс на каталог данных — остановите его ' +
      `(Stop-Process -Id ${ownerPid ?? '<pid>'}) и запустите сервер заново.`,
  );
}
