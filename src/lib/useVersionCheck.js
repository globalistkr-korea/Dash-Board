/* global __BUILD_ID__ */
import { useEffect, useState } from 'react';

// 로드된 앱의 빌드ID (vite define 주입). 개발 모드에선 'dev'.
const CURRENT = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

// 배포된 version.json의 buildId와 비교해 새 버전이 뜨면 true.
// 서비스워커 없이 폴링만 사용(iOS PWA 안전). 개발 모드에선 비활성.
export function useVersionCheck({ intervalMs = 5 * 60 * 1000 } = {}) {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (CURRENT === 'dev') return undefined;
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (alive && buildId && buildId !== CURRENT) setUpdateReady(true);
      } catch {
        /* 네트워크 실패는 무시 — 다음 주기에 재시도 */
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const id = window.setInterval(check, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    check(); // 최초 1회
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return updateReady;
}

export function applyUpdate() {
  window.location.reload();
}
