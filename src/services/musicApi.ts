// 网易云音乐 API 服务层
// 使用网易云官方 API: https://music.163.com/api

const API_BASE = 'https://music.163.com/api';
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://music.163.com/',
};

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

// 通用请求封装
async function apiFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`API错误: ${data.msg || data.message || '未知错误'}`);
  }

  return data;
}

// 搜索歌曲
export async function searchSongs(keywords: string, limit: number = 30, offset: number = 0): Promise<SearchResult> {
  const url = `${API_BASE}/search/get/web?csrf_token=&s=${encodeURIComponent(keywords)}&type=1&offset=${offset}&total=true&limit=${limit}`;
  const data = await apiFetch<{
    result: {
      songs: Array<{
        id: number;
        name: string;
        artists: Array<{ name: string }>;
        album: { name: string; picUrl: string };
        duration: number;
      }>;
      songCount: number;
    }
  }>(url);

  const songs = (data.result?.songs || []).map(s => ({
    id: s.id,
    name: s.name,
    artists: s.artists.map(a => ({ name: a.name })),
    album: { name: s.album.name, picUrl: s.album.picUrl },
    duration: s.duration,
  }));

  return {
    songs,
    songCount: data.result?.songCount || 0,
  };
}

// 获取歌曲播放URL（使用网易云外链）
export async function getSongUrl(id: number): Promise<SongUrl | null> {
  try {
    // 网易云外链播放地址
    const url = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
    // 验证链接是否可用
    const check = await fetch(url, {
      method: 'HEAD',
      headers: COMMON_HEADERS,
      redirect: 'manual',
    });
    if (check.status === 302 || check.status === 200) {
      return {
        id,
        url,
        type: 'mp3',
        size: 0,
        time: 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 获取歌曲详情
export async function getSongDetail(ids: number[]): Promise<NeteaseSong[]> {
  const url = `${API_BASE}/song/detail?ids=[${ids.join(',')}]`;
  const data = await apiFetch<{
    songs: Array<{
      id: number;
      name: string;
      artists: Array<{ name: string }>;
      album: { name: string; picUrl: string };
      duration: number;
    }>
  }>(url);

  return (data.songs || []).map(s => ({
    id: s.id,
    name: s.name,
    artists: s.artists.map(a => ({ name: a.name })),
    album: { name: s.album.name, picUrl: s.album.picUrl },
    duration: s.duration,
  }));
}

// 获取歌词
export async function getLyric(id: number): Promise<string> {
  try {
    const url = `${API_BASE}/song/lyric?id=${id}&lv=1&kv=1&tv=-1`;
    const data = await apiFetch<{
      lrc?: { lyric: string };
      tlyric?: { lyric: string };
    }>(url);

    if (data.lrc?.lyric) {
      return data.lrc.lyric;
    }
  } catch {
    // 使用默认歌词
  }

  return '[00:00.00]暂无歌词\n[00:05.00]\n[00:10.00]享受音乐吧~';
}

// 获取排行榜列表
export async function getToplists(): Promise<ToplistItem[]> {
  const url = `${API_BASE}/toplist`;
  const data = await apiFetch<{
    list: Array<{
      id: number;
      name: string;
      coverImgUrl: string;
      description: string;
    }>
  }>(url);

  return (data.list || []).map(item => ({
    id: item.id,
    name: item.name,
    coverImgUrl: item.coverImgUrl,
    description: item.description,
  }));
}

// 获取排行榜详情
export async function getToplistDetail(id: number): Promise<NeteaseSong[]> {
  const url = `${API_BASE}/playlist/detail?id=${id}`;
  const data = await apiFetch<{
    result: {
      tracks: Array<{
        id: number;
        name: string;
        artists: Array<{ name: string }>;
        album: { name: string; picUrl: string };
        duration: number;
      }>
    }
  }>(url);

  const tracks = data.result?.tracks || [];
  return tracks.map(t => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map(a => ({ name: a.name })),
    album: { name: t.album.name, picUrl: t.album.picUrl },
    duration: t.duration,
  }));
}

// 获取热门搜索
export async function getHotSearch(): Promise<string[]> {
  try {
    const url = `${API_BASE}/search/hot`;
    const data = await apiFetch<{
      result: {
        hots: Array<{
          first: string;
        }>
      }
    }>(url);

    if (data.result?.hots) {
      return data.result.hots.slice(0, 10).map(h => h.first);
    }
    return [];
  } catch {
    return [];
  }
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
