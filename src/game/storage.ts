const memoryStorageFallback: Record<string, string> = {};

export function safeSessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return memoryStorageFallback[key] || null;
  }
}

export function safeSessionSet(key: string, val: string): void {
  try {
    window.sessionStorage.setItem(key, val);
  } catch {
    memoryStorageFallback[key] = val;
  }
}

export function safeLocalGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalSet(key: string, val: string): void {
  try {
    window.localStorage.setItem(key, val);
  } catch {
    // ignore storage errors
  }
}

export function copyTextToClipboard(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }
  document.body.removeChild(ta);
}

export function isCanvasPreviewEnvironment(): boolean {
  try {
    const host = window.location.hostname || '';
    const ref = document.referrer || '';
    if (host.includes('scf.usercontent.goog') || ref.includes('scf.usercontent.goog')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function formatKeyCodeLabel(code: string): string {
  if (!code) return '---';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'SPACE';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  return code;
}
