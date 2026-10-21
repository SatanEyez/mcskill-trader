export const CHAT_SOUND_STORAGE_KEY = 'mcskill.chat.sound';
export const CHAT_SOUND_CHANGED_EVENT = 'mcskill:chat-sound-changed';

const SOUND_URL = '/sounds/chat-notification.mp3';

let audio: HTMLAudioElement | null = null;

export function isChatSoundEnabled(): boolean {
  try {
    return localStorage.getItem(CHAT_SOUND_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setChatSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CHAT_SOUND_STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new Event(CHAT_SOUND_CHANGED_EVENT));
  } catch {
    // Приватный режим может запретить localStorage — просто не сохраняем.
  }
}

/**
 * Звук уведомления. Проигрываем только когда включён переключатель
 * в профиле — проверку видимости вкладки делает вызывающий код.
 */
export function playChatSound(): void {
  try {
    if (!audio) {
      audio = new Audio(SOUND_URL);
      audio.preload = 'auto';
      audio.volume = 0.7;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Браузер может блокировать автоплей до первого взаимодействия.
    });
  } catch {
    // Звук — не критичная часть: ошибки не должны ломать чат.
  }
}
