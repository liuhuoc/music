// 网易云音乐 API 服务层
// 使用公共 API: https://api.bugpk.com/api/163_music
// 如果 API 不可用，自动降级为模拟数据

const API_BASE = 'https://api.bugpk.com/api/163_music';

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
async function apiGet<T>(params: Record<string, string>): Promise<T> {
  const queryString = new URLSearchParams(params).toString();
  const url = `${API_BASE}?${queryString}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
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
  const data = await apiGet<{
    data: {
      songs: Array<{
        id: number;
        name: string;
        artists: string;
        album: string;
        picUrl: string;
        duration: number;
      }>;
      total: number;
    }
  }>({
    type: 'search',
    s: keywords,
    limit: String(limit),
    offset: String(offset),
  });

  // 转换为标准格式
  const songs = data.data.songs.map(s => ({
    id: s.id,
    name: s.name,
    artists: s.artists.split(/[,、]/).map(name => ({ name: name.trim() })),
    album: { name: s.album, picUrl: s.picUrl },
    duration: s.duration,
  }));

  return {
    songs,
    songCount: data.data.total,
  };
}

// 获取歌曲播放URL
export async function getSongUrl(id: number): Promise<SongUrl | null> {
  const data = await apiGet<{
    data: {
      url: string;
      size: number;
      type: string;
      time: number;
    }
  }>({
    type: 'url',
    id: String(id),
    level: 'exhigh',
  });

  if (!data.data?.url) return null;

  return {
    id,
    url: data.data.url,
    type: data.data.type || 'mp3',
    size: data.data.size || 0,
    time: data.data.time || 0,
  };
}

// 获取歌曲详情
export async function getSongDetail(ids: number[]): Promise<NeteaseSong[]> {
  const results: NeteaseSong[] = [];

  for (const id of ids) {
    try {
      const data = await apiGet<{
        data: {
          id: number;
          name: string;
          album: string;
          singer: string;
          picimg: string;
        }
      }>({
        type: 'song',
        id: String(id),
      });

      if (data.data) {
        results.push({
          id: data.data.id,
          name: data.data.name,
          artists: data.data.singer.split(/[,、]/).map(name => ({ name: name.trim() })),
          album: { name: data.data.album, picUrl: data.data.picimg },
          duration: 0,
        });
      }
    } catch {
      // 忽略单个歌曲错误
    }
  }

  return results;
}

// 获取歌词
export async function getLyric(id: number): Promise<string> {
  try {
    const data = await apiGet<{
      data: {
        lyric: string;
      }
    }>({
      type: 'lyric',
      id: String(id),
    });

    if (data.data?.lyric) {
      return data.data.lyric;
    }
  } catch {
    // 使用默认歌词
  }

  return '[00:00.00]暂无歌词\n[00:05.00]\n[00:10.00]享受音乐吧~';
}

// 获取排行榜列表
export async function getToplists(): Promise<ToplistItem[]> {
  const data = await apiGet<{
    data: Array<{
      id: number;
      name: string;
      coverImgUrl: string;
      description: string;
    }>
  }>({
    type: 'playlist',
  });

  return data.data.map(item => ({
    id: item.id,
    name: item.name,
    coverImgUrl: item.coverImgUrl,
    description: item.description,
  }));
}

// 获取排行榜详情
export async function getToplistDetail(id: number): Promise<NeteaseSong[]> {
  try {
    const data = await apiGet<{
      data: {
        songs?: Array<{
          id: number;
          name: string;
          artists?: string;
          artist?: string;
          album?: string;
          picUrl?: string;
          duration?: number;
        }>;
        tracks?: Array<{
          id: number;
          name: string;
          artists?: string;
          artist?: string;
          album?: string;
          picUrl?: string;
          duration?: number;
        }>;
      }
    }>({
      type: 'playlist',
      id: String(id),
    });

    const songs = data.data?.songs || data.data?.tracks || [];
    return songs.map(s => ({
      id: s.id,
      name: s.name,
      artists: (s.artists || s.artist || '未知').split(/[,、]/).map(name => ({ name: name.trim() })),
      album: { name: s.album || '未知专辑', picUrl: s.picUrl || '' },
      duration: s.duration || 0,
    }));
  } catch {
    return [];
  }
}

// 获取热门搜索
export async function getHotSearch(): Promise<string[]> {
  try {
    const data = await apiGet<{
      data: Array<{
        searchWord: string;
        keyword?: string;
      }>
    }>({
      type: 'json',
    });

    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      return data.data.slice(0, 10).map(item =>
        item.searchWord || (item as Record<string, string>).keyword || ''
      ).filter(Boolean);
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
