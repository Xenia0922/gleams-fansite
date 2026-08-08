/**
 * 统一 API Client — 封装 fetch 调用，提供类型安全的 API 函数。
 * 组件不再直接写 `fetch('/api/xxx')`，统一从这里引用。
 */

// ---------- 基础工具 ----------

const DEFAULT_TIMEOUT = 8000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * 带超时的 fetch 封装，自动解析 JSON，统一错误处理。
 */
export async function apiFetch<T = unknown>(url: string, options?: RequestInit & { timeout?: number }): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options || {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new ApiError(data?.error || `请求失败 (${res.status})`, res.status);
    }

    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') {
      throw new ApiError('请求超时', 408);
    }
    throw new ApiError('网络错误，请稍后重试', 0);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 带管理暗号的请求头（仅在浏览器环境有效）。
 */
export function adminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return { 'x-admin-code': localStorage.getItem('gleams-admin') || '' };
}

// ---------- 类型定义 ----------

/**
 * 列表/卡片场景用的精简成员类型（卡片不展示微博/详情正文）。
 * 列表接口 SELECT 不带 gallery/weibo_* / intro。
 */
export interface MemberCard {
  id: string;
  name: string;
  name_jp: string;
  color: string;
  emoji: string;
  birthday: string;
  constellation: string;
  status: string;
  image: string;
}

export interface MemberInfo extends MemberCard {
  gallery?: string[];
  weibo?: string;
  weibo_name?: string;
  weibo_desc?: string;
  intro?: string;
  sort_order: number;
}

export interface EventData {
  id: string;
  date: string;
  time: string;
  title: string;
  venue: string;
  city?: string;
  performers: string[];
  status: string;
  image: string;
  body?: string;
  end_time?: string;
  created_at?: string;
}

export interface SiteConfig {
  about_worldview?: string;
  about_intro?: string;
  weidian?: string;
  staff_qq?: string;
  tokuten_rules?: string[];
  tokuten_images?: string[];
  weibo?: string;
  weibo_name?: string;
  weibo_desc?: string;
  xiaohongshu?: string;
  douyin?: string;
}

export interface GalleryPhotoData {
  id: string;
  url: string;
  member: string;
  featured?: number;
}

export interface MessageData {
  id: string;
  name: string;
  message: string;
  member: string;
  event: string;
  created_at: string;
}

export interface RecruitData {
  id: number;
  title: string;
  subtitle: string | null;
  body: string;
  cta_text: string;
  cta_url: string;
  deadline: string | null;
  enabled: number;
  sort_order: number;
}

export interface PhotoData {
  key: string;
  url: string;
  thumbUrl: string | null;
  member: string;
  event: string | null;
}

// ---------- API 函数 ----------

export function fetchMembers(all?: boolean) {
  const url = all ? '/api/members?all=1' : '/api/members';
  return apiFetch<MemberInfo[]>(url, {
    headers: all ? adminHeaders() : undefined,
  });
}

export function fetchEvents() {
  return apiFetch<EventData[]>('/api/events');
}

export function fetchSiteConfig() {
  return apiFetch<SiteConfig>('/api/site');
}

export function fetchGallery() {
  return apiFetch<{ photos: GalleryPhotoData[]; featured: GalleryPhotoData[]; isAdmin: boolean }>('/api/gallery');
}

export function fetchMessages() {
  return apiFetch<MessageData[]>('/api/messages');
}

export function fetchRecruits(all?: boolean) {
  const url = all ? '/api/recruits?all=1' : '/api/recruits';
  return apiFetch<RecruitData[]>(url, {
    headers: all ? adminHeaders() : undefined,
  });
}

export function fetchPhotos() {
  return apiFetch<PhotoData[]>('/api/photos');
}

// ---------- 表情反应（批量查询） ----------

export interface ReactionBatch {
  [id: string]: { reactions: { emoji: string; count: number }[]; mine: string[] };
}

/**
 * 批量查询反应，按 CHUNK 分片请求，避免 ids 拼接超长 URL（上千条时 URL 超限会被拒）。
 * 逐片合并结果；某片失败静默跳过（局部数据缺失可容忍，不阻塞主体内容）。
 */
export async function fetchReactionMap(type: 'message' | 'photo', ids: string[]): Promise<ReactionBatch> {
  const CHUNK = 100;
  const merged: ReactionBatch = {};
  if (!ids.length) return merged;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const res = await fetch(`/api/reactions?type=${type}&ids=${encodeURIComponent(chunk.join(','))}`);
      if (!res.ok) continue;
      const map = await res.json();
      if (map && typeof map === 'object') Object.assign(merged, map);
    } catch { /* 单片失败跳过 */ }
  }
  return merged;
}
