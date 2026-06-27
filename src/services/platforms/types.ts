import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { Song } from '../../data/songs';

// 平台标识符
export type Platform = 'netease' | 'kuwo' | 'kugou' | 'qq';

// 平台适配器接口
export interface PlatformAdapter {
  // 平台标识
  readonly id: Platform;
  // 显示名称
  readonly name: string;
  // 是否支持播放
  readonly canPlay: boolean;
  // 搜索歌曲
  search(keyword: string, limit?: number, offset?: number): Promise<Song[]>;
  // 获取播放URL
  getPlayUrl(song: Song): Promise<string | null>;
  // 获取歌词
  getLyric(song: Song): Promise<string>;
  // 获取排行榜（可选）
  getToplist?(id: string | number): Promise<Song[]>;
}

// 通用工具：将 http URL 转为 https
export function toHttps(url: string): string {
  return url ? url.replace(/^http:\/\//i, 'https://') : '';
}

// 通用 HTTP GET 请求封装
// 原生平台使用 CapacitorHttp 直接调用，避免 fetch patch 的问题
export async function httpGet<T>(url: string, headers?: Record<string, string>): Promise<T> {
  if (Capacitor.isNativePlatform()) {
    // 原生平台：直接使用 CapacitorHttp
    const response = await CapacitorHttp.get({
      url,
      headers: headers || {},
      connectTimeout: 15,
      readTimeout: 15,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    // CapacitorHttp 返回的 data 可能已经是对象或字符串
    if (typeof response.data === 'string') {
      return JSON.parse(response.data) as T;
    }
    return response.data as T;
  }

  // Web 平台：使用标准 fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 通用 HTTP POST 请求封装
export async function httpPost<T>(url: string, body: Record<string, string>, headers?: Record<string, string>): Promise<T> {
  if (Capacitor.isNativePlatform()) {
    // 原生平台：直接使用 CapacitorHttp
    const response = await CapacitorHttp.post({
      url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
      data: new URLSearchParams(body).toString(),
      connectTimeout: 15,
      readTimeout: 15,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (typeof response.data === 'string') {
      return JSON.parse(response.data) as T;
    }
    return response.data as T;
  }

  // Web 平台：使用标准 fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 通用 HTTP 文本请求（返回纯文本，用于歌词等）
export async function httpGetText(url: string, headers?: Record<string, string>): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers: headers || {},
      connectTimeout: 15,
      readTimeout: 15,
      responseType: 'text',
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    return typeof response.data === 'string' ? response.data : String(response.data || '');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 默认歌词
export const DEFAULT_LYRIC = '[00:00.00]暂无歌词\n[00:05.00]\n[00:10.00]享受音乐吧~';

// 默认封面图
export const DEFAULT_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';
