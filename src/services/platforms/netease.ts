// 网易云音乐平台适配器
// 实现 PlatformAdapter 接口，对接网易云音乐公开 API
import { Capacitor, CapacitorHttp } from '@capacitor/core';
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

  // 获取播放 URL
  // 网易云外链会 302 重定向到实际音频地址
  // NativeAudio/MediaPlayer 可能不跟随 HTTPS→HTTP 重定向，需提前解析
  async getPlayUrl(song: Song): Promise<string | null> {
    const outerUrl = `https://music.163.com/song/media/outer/url?id=${song.id}.mp3`;
    debugLogger.log(`[Netease] 播放外链: ${outerUrl}`);

    // 原生平台：用 CapacitorHttp 直接解析重定向
    if (Capacitor.isNativePlatform()) {
      try {
        const response = await CapacitorHttp.request({
          url: outerUrl,
          method: 'GET',
          responseType: 'text',
          connectTimeout: 10000,
          readTimeout: 10000,
        });
        // CapacitorHttp 跟随重定向后，response.url 是最终 URL
        if (response.url && response.url !== outerUrl) {
          const finalUrl = toHttps(response.url);
          debugLogger.log(`[Netease] CapacitorHttp 解析重定向成功: ${finalUrl.substring(0, 80)}...`);
          return finalUrl;
        }
        // 检查 headers 中的 Location
        const location = response.headers?.['Location'] || response.headers?.['location'];
        if (location) {
          const finalUrl = toHttps(location);
          debugLogger.log(`[Netease] Location header 解析成功: ${finalUrl.substring(0, 80)}...`);
          return finalUrl;
        }
        debugLogger.warn(`[Netease] CapacitorHttp 未解析到重定向 URL`);
      } catch (e) {
        debugLogger.error(`[Netease] CapacitorHttp 解析失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Web 平台：用 fetch 解析重定向
    try {
      const response = await fetch(outerUrl, { redirect: 'follow' });
      if (response.url && response.url !== outerUrl) {
        const finalUrl = toHttps(response.url);
        debugLogger.log(`[Netease] fetch 解析重定向成功: ${finalUrl.substring(0, 80)}...`);
        return finalUrl;
      }
    } catch (e) {
      debugLogger.error(`[Netease] fetch 解析失败: ${e instanceof Error ? e.message : String(e)}`);
    }

    debugLogger.warn(`[Netease] 使用原始外链（可能无法播放）`);
    return outerUrl;
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

// 热搜接口响应
interface NeteaseHotSearchResponse {
  code: number;
  data?: Array<{ searchWord: string }>;
}

// 获取热门搜索
export async function getHotSearch(limit: number = 20): Promise<string[]> {
  debugLogger.log('[Netease] 获取热门搜索');
  try {
    const data = await httpGet<NeteaseHotSearchResponse>(
      'https://music.163.com/api/search/hot/detail'
    );

    if (data.code !== 200) {
      debugLogger.warn(`[Netease] 热搜返回非 200: code=${data.code}`);
      return [];
    }

    const list = data.data || [];
    const hotWords = list.slice(0, limit).map(item => item.searchWord);
    debugLogger.log(`[Netease] 热搜返回 ${hotWords.length} 个关键词`);
    return hotWords;
  } catch (error) {
    debugLogger.error(`[Netease] 热搜获取失败: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// 评论接口响应
interface NeteaseCommentUser {
  nickname: string;
  avatarUrl: string;
  userId: number;
  avatarDetail?: { identityIconUrl: string };
}

interface NeteaseComment {
  commentId: number;
  content: string;
  user: NeteaseCommentUser;
  time: number;
  likedCount: number;
  ipLocation?: { location: string };
}

interface NeteaseCommentResponse {
  code: number;
  hotComments?: NeteaseComment[];
  comments?: NeteaseComment[];
  total?: number;
}

export interface CommentItem {
  id: string;
  user: string;
  avatar: string;
  content: string;
  date: string;
  location: string;
  likes: number;
}

// 获取歌曲评论
export async function getComments(songId: string, limit: number = 20): Promise<CommentItem[]> {
  debugLogger.log(`[Netease] 获取评论: id=${songId}`);
  try {
    const data = await httpPost<NeteaseCommentResponse>(
      'https://music.163.com/api/v1/resource/comments/R_SO_4_' + songId,
      {
        limit: String(limit),
        offset: '0',
      }
    );

    if (data.code !== 200) {
      debugLogger.warn(`[Netease] 评论返回非 200: code=${data.code}`);
      return [];
    }

    const rawComments = data.hotComments && data.hotComments.length > 0
      ? [...data.hotComments, ...(data.comments || []).slice(0, limit - data.hotComments.length)]
      : (data.comments || []);

    const result = rawComments.slice(0, limit).map(c => ({
      id: String(c.commentId),
      user: c.user.nickname,
      avatar: toHttps(c.user.avatarUrl),
      content: c.content,
      date: formatCommentTime(c.time),
      location: c.ipLocation?.location || '未知',
      likes: c.likedCount,
    }));

    debugLogger.log(`[Netease] 评论返回 ${result.length} 条`);
    return result;
  } catch (error) {
    debugLogger.error(`[Netease] 评论获取失败: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function formatCommentTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const mins = Math.floor(diff / (1000 * 60));
      return `${mins}分钟前`;
    }
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
