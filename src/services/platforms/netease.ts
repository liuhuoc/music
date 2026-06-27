// 网易云音乐平台适配器
// 实现 PlatformAdapter 接口，对接网易云音乐公开 API
import type { Song } from '../../data/songs';
import type { PlatformAdapter } from './types';
import { httpGet, httpPost, toHttps, DEFAULT_LYRIC, DEFAULT_COVER } from './types';
import { debugLogger } from '../../utils/debugLogger';

// 网易云音乐 API 基础地址
const API_BASE = 'https://music.163.com/api';

// 排行榜 ID 映射
const TOPLIST_ID_MAP: Record<string, number> = {
  hot: 3778678,
  rising: 19723756,
  new: 3779629,
};

// 搜索/排行榜返回的占位歌词（待播放时再加载）
const LOADING_LYRIC = '[00:00.00]歌词加载中...';

// 网易云歌曲原始字段
interface NeteaseRawSong {
  id: number;
  name: string;
  artists: Array<{ name: string }>;
  album: { name?: string; picUrl?: string };
  duration: number;
}

// 搜索接口响应
interface NeteaseSearchResponse {
  code: number;
  result?: {
    songs?: NeteaseRawSong[];
    songCount?: number;
  };
}

// 排行榜接口响应
interface NeteasePlaylistResponse {
  code: number;
  result?: {
    tracks?: NeteaseRawSong[];
  };
}

// 歌词接口响应
interface NeteaseLyricResponse {
  code: number;
  lrc?: { lyric?: string };
}

// 将网易云原始歌曲转换为应用内 Song 格式
function convertToSong(raw: NeteaseRawSong): Song {
  const picUrl = raw.album?.picUrl ? toHttps(raw.album.picUrl) : '';
  return {
    id: String(raw.id),
    title: raw.name,
    artist: raw.artists?.map(a => a.name).join('、') || '未知歌手',
    album: raw.album?.name || '未知专辑',
    cover: picUrl ? `${picUrl}?param=400y400` : DEFAULT_COVER,
    source: 'netease',
    duration: Math.floor((raw.duration || 0) / 1000),
    lyrics: LOADING_LYRIC,
  };
}

export const neteaseAdapter: PlatformAdapter = {
  id: 'netease',
  name: '网易云音乐',
  canPlay: true,

  // 搜索歌曲
  async search(keyword: string, limit: number = 30, offset: number = 0): Promise<Song[]> {
    debugLogger.log(`[Netease] 搜索: keyword="${keyword}", limit=${limit}, offset=${offset}`);
    try {
      const data = await httpPost<NeteaseSearchResponse>(`${API_BASE}/search/get`, {
        s: keyword,
        limit: String(limit),
        offset: String(offset),
        type: '1',
      });

      if (data.code !== 200) {
        debugLogger.warn(`[Netease] 搜索返回非 200: code=${data.code}`);
        return [];
      }

      const songs = data.result?.songs || [];
      debugLogger.log(`[Netease] 搜索返回 ${songs.length} 首歌曲 (共 ${data.result?.songCount ?? 0})`);
      return songs.map(convertToSong);
    } catch (error) {
      debugLogger.error(`[Netease] 搜索失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  },

  // 获取播放 URL（直接使用网易云外链，302 重定向到实际音频）
  async getPlayUrl(song: Song): Promise<string | null> {
    const url = `https://music.163.com/song/media/outer/url?id=${song.id}.mp3`;
    debugLogger.log(`[Netease] 播放外链: ${url}`);
    return url;
  },

  // 获取 LRC 格式歌词
  async getLyric(song: Song): Promise<string> {
    debugLogger.log(`[Netease] 获取歌词: id=${song.id}`);
    try {
      const data = await httpGet<NeteaseLyricResponse>(
        `${API_BASE}/song/lyric?id=${song.id}&lv=1`,
      );

      if (data.code === 200 && data.lrc?.lyric) {
        return data.lrc.lyric;
      }
      debugLogger.warn(`[Netease] 歌词返回异常: code=${data.code}`);
    } catch (error) {
      debugLogger.error(`[Netease] 获取歌词失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    return DEFAULT_LYRIC;
  },

  // 获取排行榜歌曲
  async getToplist(id: string | number): Promise<Song[]> {
    const toplistId =
      typeof id === 'number' ? id : TOPLIST_ID_MAP[id] ?? Number(id);
    debugLogger.log(`[Netease] 获取排行榜: id=${id}, resolvedId=${toplistId}`);
    try {
      const data = await httpGet<NeteasePlaylistResponse>(
        `${API_BASE}/playlist/detail?id=${toplistId}`,
      );

      if (data.code !== 200) {
        debugLogger.warn(`[Netease] 排行榜返回非 200: code=${data.code}`);
        return [];
      }

      const tracks = data.result?.tracks || [];
      debugLogger.log(`[Netease] 排行榜返回 ${tracks.length} 首歌曲`);
      return tracks.map(convertToSong);
    } catch (error) {
      debugLogger.error(`[Netease] 排行榜获取失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  },
};

export default neteaseAdapter;
