import { useEffect, useRef } from 'react';

declare global {
  interface Window { turnstile?: any; }
}

// Turnstile 脚本只加载一次（多组件共享）
let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => resolve(); // 加载失败也 resolve，widget 不渲染（后端 fail-open 兜底）
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile 人机验证 widget。
 * siteKey 由 middleware 注入到 window.__SSR_DATA__.turnstileSiteKey（未配置则不渲染）。
 * 验证通过后调用 onToken(token)；过期/失败调用 onToken('')。
 */
export default function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // onToken 用 ref 持有，避免 callback 变化导致 widget 重建
  const cbRef = useRef(onToken);
  cbRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      try {
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => cbRef.current(token),
          'expired-callback': () => cbRef.current(''),
          'error-callback': () => cbRef.current(''),
        });
      } catch { /* 渲染失败静默，后端 fail-open 兜底 */ }
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch {}
      }
    };
  }, [siteKey]);

  return <div ref={containerRef} className="flex justify-center" />;
}
