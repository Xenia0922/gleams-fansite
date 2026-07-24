import { useState, useEffect } from 'react';

export interface UseIslandDataOptions<T> {
  /** 读取 window.__SSR_DATA__[ssrKey] 作为首屏数据（middleware 注入，免二次 fetch） */
  ssrKey?: string;
  /** 构建期种子兜底（本地无 CF / 无 SSR 时） */
  initial?: T[];
  /** SSR 与种子皆无时的一次性回退请求 */
  fetchFn?: () => Promise<unknown>;
}

/**
 * 数据岛统一加载逻辑：SSR 注入 > 构建期种子 > 一次性 fetch。
 *
 * 替代 HomeMembers / MembersList / EventCardGrid / ScheduleList 中逐字重复的
 * `useEffect(() => { if (ssr?.x) {...} else if (initial) {...} else fetch() })`。
 * 骨架优先策略保持不变：初始态为空 + loading，真实数据到达后一次性渲染。
 */
export function useIslandData<T>({ ssrKey, initial, fetchFn }: UseIslandDataOptions<T>): {
  data: T[];
  loading: boolean;
} {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ssrVal = ssrKey ? (ssr as any)?.[ssrKey] : undefined;
    if (Array.isArray(ssrVal) && ssrVal.length) {
      setData(ssrVal as T[]);
      setLoading(false);
      return;
    }
    if (Array.isArray(initial) && initial.length) {
      setData(initial as T[]);
      setLoading(false);
      return;
    }
    if (!fetchFn) {
      setLoading(false);
      return;
    }
    let alive = true;
    Promise.resolve(fetchFn())
      .then((d) => {
        if (alive && Array.isArray(d) && d.length) setData(d as T[]);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // fetchFn/initial 在挂载时求一次即可，无需重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading };
}
