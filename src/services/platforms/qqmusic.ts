import { debugLogger } from '../../utils/debugLogger';
import { httpGet, DEFAULT_LYRIC, DEFAULT_COVER, toHttps } from './types';
import type { PlatformAdapter } from './types';
import type { Song } from '../../data/songs';

// QQ音乐适配器（仅搜索，不支持播放）
export const qqAdapter: PlatformAdapter = {
  id: 'qq',
  name: 'QQ音乐',
  canPlay: false,

  async search(keyword: string, limit: number = 30, offset: number = 0): Promise<Song[]> {
    const page = Math.floor(offset / limit) + 1;
    const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(keyword)}&format=json&n=${limit}&p=${page}`;
    debugLogger.log(`[QQ] 搜索: ${keyword}, page=${page}`);

    try {
      const data = await httpGet<{
        code: number;
        data: {
          song: {
            list: Array<{
              songmid: string;
              songname: string;
              singer: Array<{ name: string }>;
              albumname: string;
              albummid: string;
              interval: number;
              songid: number;
            }>;
          };
        };
      }>(url, { Referer: 'https://y.qq.com' });

      if (data.code !== 0) {
        debugLogger.log(`[QQ] 搜索失败: code=${data.code}`);
        return [];
      }

      const songs = (data.data?.song?.list || []).map(s => {
        const cover = s.albummid
          ? `https://y.gtimg.cn/music/photo_new/T002R400x400M000${s.albummid}.jpg`
          : DEFAULT_COVER;
        return {
          id: s.songmid,
          title: s.songname || '未知',
          artist: (s.singer || []).map(a => a.name).join('、') || '未知歌手',
          album: s.albumname || '未知专辑',
          cover: toHttps(cover),
          source: 'qq',
          duration: s.interval || 0,
          lyrics: DEFAULT_LYRIC,
        } as Song;
      });

      debugLogger.log(`[QQ] 搜索返回 ${songs.length} 首`);
      return songs;
    } catch (error) {
      debugLogger.error(`[QQ] 搜索失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  },

  async getPlayUrl(): Promise<string | null> {
    debugLogger.log('[QQ] 不支持播放');
    return null;
  },

  async getLyric(): Promise<string> {
    return DEFAULT_LYRIC;
  },
};

export default qqAdapter;
