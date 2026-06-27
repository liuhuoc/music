// 网易云音乐 API 服务层
// 使用网易云音乐官方公开 API
import { debugLogger } from '../utils/debugLogger';

const API_BASE = 'https://music.163.com/api';

export interface NeteaseSong {
  id: number;
  name: string;
  artists: { name: string }[];
  album: { name: string; picUrl: string };
  duration: number;
}

export interface SearchResult {
  songs: NeteaseSong[];
  songCount: number;
}

export interface SongUrl {
  id: number;
  url: string;
  type: string;
  size: number;
  time: number;
}

export interface ToplistItem {
  id: number;
  name: string;
  coverImgUrl: string;
  description: string;
}

// 将 http URL 转为 https
function toHttps(url: string): string {
  return url ? url.replace(/^http:\/\//i, 'https://') : '';
}

// 通用 GET 请求封装
async function apiGet<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  debugLogger.log(`[API] GET 请求: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    debugLogger.log(`[API] 响应状态: ${response.status} ${response.ok}`);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    debugLogger.log(`[API] 响应数据 code: ${data.code}`);

    if (data.code !== 200) {
      throw new Error(`API错误: code=${data.code}`);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    debugLogger.error(`[API] 请求失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// 通用 POST 请求封装
async function apiPost<T>(endpoint: string, body: Record<string, string>): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  debugLogger.log(`[API] POST 请求: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    debugLogger.log(`[API] 响应状态: ${response.status} ${response.ok}`);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    debugLogger.log(`[API] 响应数据 code: ${data.code}`);

    if (data.code !== 200) {
      throw new Error(`API错误: code=${data.code}`);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    debugLogger.error(`[API] 请求失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// 搜索歌曲
export async function searchSongs(keywords: string, limit: number = 30, offset: number = 0): Promise<SearchResult> {
  const data = await apiPost<{
    result: {
      songs: Array<{
        id: number;
        name: string;
        artists: Array<{ name: string }>;
        album: { name: string; picUrl?: string };
        duration: number;
      }>;
      songCount: number;
    }
  }>('/search/get', {
    s: keywords,
    limit: String(limit),
    offset: String(offset),
    type: '1',
  });

  const songs = (data.result?.songs || []).map(s => ({
    id: s.id,
    name: s.name,
    artists: (s.artists || []).map(a => ({ name: a.name })),
    album: { name: s.album?.name || '未知专辑', picUrl: toHttps(s.album?.picUrl || '') },
    duration: s.duration || 0,
  }));

  return {
    songs,
    songCount: data.result?.songCount || 0,
  };
}

// 获取歌曲播放URL
// 使用网易云官方外链地址，支持 302 重定向到实际音频
export async function getSongUrl(id: number): Promise<SongUrl | null> {
  const url = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
  debugLogger.log(`[API] 歌曲外链: ${url}`);
  return {
    id,
    url,
    type: 'mp3',
    size: 0,
    time: 0,
  };
}

// 获取歌曲详情
export async function getSongDetail(ids: number[]): Promise<NeteaseSong[]> {
  const idsParam = encodeURIComponent(`[${ids.join(',')}]`);
  const data = await apiGet<{
    songs: Array<{
      id: number;
      name: string;
      artists: Array<{ name: string }>;
      album: { name: string; picUrl?: string };
      duration: number;
    }>;
  }>(`/song/detail?ids=${idsParam}`);

  return (data.songs || []).map(s => ({
    id: s.id,
    name: s.name,
    artists: (s.artists || []).map(a => ({ name: a.name })),
    album: { name: s.album?.name || '未知专辑', picUrl: toHttps(s.album?.picUrl || '') },
    duration: s.duration || 0,
  }));
}

// 获取歌词
export async function getLyric(id: number): Promise<string> {
  try {
    const data = await apiGet<{
      lrc: { lyric: string };
    }>(`/song/lyric?id=${id}&lv=1`);

    if (data.lrc?.lyric) {
      return data.lrc.lyric;
    }
  } catch {
    // 使用默认歌词
  }

  return '[00:00.00]暂无歌词\n[00:05.00]\n[00:10.00]享受音乐吧~';
}

// 获取排行榜详情
export async function getToplistDetail(id: number): Promise<NeteaseSong[]> {
  const data = await apiGet<{
    result: {
      tracks: Array<{
        id: number;
        name: string;
        artists: Array<{ name: string }>;
        album: { name: string; picUrl?: string };
        duration: number;
      }>;
    };
  }>(`/playlist/detail?id=${id}`);

  const tracks = data.result?.tracks || [];
  debugLogger.log(`[API] 排行榜返回 ${tracks.length} 首歌曲`);

  return tracks.map(t => ({
    id: t.id,
    name: t.name,
    artists: (t.artists || []).map(a => ({ name: a.name })),
    album: { name: t.album?.name || '未知专辑', picUrl: toHttps(t.album?.picUrl || '') },
    duration: t.duration || 0,
  }));
}

// 获取热门搜索
export async function getHotSearch(): Promise<string[]> {
  return [];
}

// 将网易云歌曲转换为应用内 Song 格式
export function convertToAppSong(neteaseSong: NeteaseSong): import('../data/songs').Song {
  const duration = Math.floor(neteaseSong.duration / 1000);
  return {
    id: String(neteaseSong.id),
    title: neteaseSong.name,
    artist: neteaseSong.artists?.map(a => a.name).join('、') || '未知歌手',
    album: neteaseSong.album?.name || '未知专辑',
    cover: neteaseSong.album?.picUrl
      ? `${neteaseSong.album.picUrl}?param=400y400`
      : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    source: '网易云',
    duration,
    lyrics: '[00:00.00]歌词加载中...',
  };
}

// 搜索并获取完整歌曲信息（含歌词）
export async function searchAndGetFullSongs(keywords: string, limit: number = 20): Promise<import('../data/songs').Song[]> {
  const result = await searchSongs(keywords, limit);
  if (!result.songs || result.songs.length === 0) return [];

  const songs = result.songs.map(convertToAppSong);

  // 异步加载歌词（不阻塞）
  songs.forEach(async (song) => {
    try {
      const lyric = await getLyric(Number(song.id));
      song.lyrics = lyric;
    } catch {
      // 保持默认歌词
    }
  });

  return songs;
}

// 获取歌曲播放URL（带重试）
export async function getPlayUrlWithRetry(id: number, retries: number = 2): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const songUrl = await getSongUrl(id);
      if (songUrl?.url) {
        return songUrl.url;
      }
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}
