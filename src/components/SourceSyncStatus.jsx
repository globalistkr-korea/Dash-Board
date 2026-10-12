import { useEffect, useState } from 'react';
import { localizeText } from '../lib/i18n';
import { useLang } from '../context/LangContext';

export default function SourceSyncStatus() {
  const { lang } = useLang();
  const [status, setStatus] = useState(null);
  const [now, setNow] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    const check = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('/pnl-sync.json', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Sync status unavailable');
        const value = await response.json();
        if (value.status !== 'ok' || !Number.isFinite(Date.parse(value.lastCheckedAt))) throw new Error('Invalid sync status');
        if (active) { setStatus(value); setUnavailable(false); }
      } catch { if (active) setUnavailable(true); }
      finally { clearTimeout(timeout); if (active) setNow(Date.now()); }
    };
    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const stale = status && now - Date.parse(status.lastCheckedAt) > 8 * 60 * 60 * 1000;
  const format = value => new Date(value).toLocaleString(lang === 'ko' ? 'ko-KR' : lang === 'vi' ? 'vi-VN' : 'en-GB', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  if (!status && !unavailable) return null;
  return <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${stale || unavailable ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
    {status?.automationEnabled ? localizeText('원본 자동 수집 · 3시간 간격', 'Source sync · every 3 hours', lang) : localizeText('원본 수집 준비 · 정기 실행 활성화 대기', 'Source sync ready · scheduled activation pending', lang)}
    {status && <> · {localizeText('확인', 'Checked', lang)} {format(status.lastCheckedAt)} · {localizeText('실적 갱신', 'Data updated', lang)} {format(status.lastUpdatedAt)}</>}
    {(stale || unavailable) && <span className="ml-2">{localizeText('최근 수집 확인 필요 · 마지막 정상 실적 유지', 'Check source sync · retaining last validated data', lang)}</span>}
  </div>;
}
