// 网易云音乐 API 服务层
// 开发环境通过 Vite 代理访问本地 NeteaseCloudMusicApi 服务
// 如果 API 不可用，自动降级为模拟数据

const USE_MOCK = false; // 设为 true 强制使用模拟数据

// 检测是否在支持真实 API 的环境
function isRealApiAvailable(): boolean {
  // 在浏览器环境中，如果代理可用则使用真实 API
  return !USE_MOCK && typeof window !== 'undefined';
}

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
async function apiGet<T>(endpoint: string): Promise<T> {
  const url = `/ncm${endpoint}`;
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
    throw new Error(`API错误: ${data.message || data.msg || '未知错误'}`);
  }

  return data;
}

// 搜索歌曲
export async function searchSongs(keywords: string, limit: number = 30, offset: number = 0): Promise<SearchResult> {
  if (!isRealApiAvailable()) {
    throw new Error('API not available');
  }
  const data = await apiGet<{ result: SearchResult }>(
    `/search?keywords=${encodeURIComponent(keywords)}&limit=${limit}&offset=${offset}`
  );
  return data.result;
}

// 获取歌曲播放URL
export async function getSongUrl(id: number): Promise<SongUrl | null> {
  if (!isRealApiAvailable()) {
    throw new Error('API not available');
  }
  const data = await apiGet<{ data: SongUrl[] }>(
    `/song/url?id=${id}`
  );
  const url = data.data?.[0];
  return url && url.url ? url : null;
}

// 获取歌曲详情
export async function getSongDetail(ids: number[]): Promise<NeteaseSong[]> {
  if (!isRealApiAvailable()) {
    throw new Error('API not available');
  }
  const data = await apiGet<{ songs: NeteaseSong[] }>(
    `/song/detail?ids=${ids.join(',')}`
  );
  return data.songs || [];
}

// 获取歌词
export async function getLyric(id: number): Promise<string> {
  if (!isRealApiAvailable()) {
    throw new Error('API not available');
  }
  try {
    const data = await apiGet<{ lrc?: { lyric: string }; nolyric?: boolean; uncollected?: boolean }>(
      `/lyric?id=${id}`
    );

    if (data.nolyric || data.uncollected || !data.lrc?.lyric) {
      return '[00:00.00]暂无歌词\n[00:05.00]\n[00:10.00]享受音乐吧~';
    }

    return data.lrc.lyric;
  } catch {
    return '[00:00.00]暂无歌词\n[00:05.00]\n[00:10.00]享受音乐吧~';
  }
}

// 获取排行榜列表
export async function getToplists(): Promise<ToplistItem[]> {
  if (!isRealApiAvailable()) {
    throw new Error('API not available');
  }
  const data = await apiGet<{ list: ToplistItem[] }>(`/toplist`);
  return data.list || [];
}

// 获取排行榜详情
export async function getToplistDetail(id: number): Promise<NeteaseSong[]> {
  if (!isRealApiAvailable()) {
    throw new Error('API not available');
  }
  const data = await apiGet<{ playlist: { tracks: NeteaseSong[] } }>(
    `/playlist/detail?id=${id}`
  );
  return data.playlist?.tracks || [];
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
