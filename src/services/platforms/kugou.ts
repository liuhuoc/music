// 酷狗音乐平台适配器
import { debugLogger } from '../../utils/debugLogger';
import { toHttps, httpGet, DEFAULT_LYRIC, DEFAULT_COVER } from './types';
import type { PlatformAdapter } from './types';
import type { Song } from '../../data/songs';

// 酷狗搜索结果项
interface KugouSearchItem {
  SongName: string;
  SingerName: string;
  AlbumName: string;
  HQFileHash: string;
  HQDuration: number;
  HasImage?: number;
  Image?: string;
}

// 酷狗搜索响应
interface KugouSearchResponse {
  status: number;
  data: {
    lists: KugouSearchItem[];
  };
}

// 酷狗播放信息响应
interface KugouPlayInfoResponse {
  status: number;
  url: string;
  imgUrl: string;
  songName: string;
  timeLength: number;
}

// 去除歌曲名中的高亮标签（如 <em>...</em>）
function stripHighlightTags(name: string): string {
  return name ? name.replace(/<[^>]+>/g, '') : '';
}

export const kugouAdapter: PlatformAdapter = {
  id: 'kugou',
  name: '酷狗音乐',
  canPlay: true,

  async search(keyword: string, limit: number = 30, offset: number = 0): Promise<Song[]> {
    const page = Math.floor(offset / limit) + 1;
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&pagesize=${limit}&page=${page}&showtype=app2`;
    debugLogger.log(`[Kugou] 搜索: ${keyword}, page=${page}, limit=${limit}`);

    try {
      const data = await httpGet<KugouSearchResponse>(url);
      if (data.status !== 1 || !data.data?.lists) {
        debugLogger.warn(`[Kugou] 搜索失败, status=${data.status}`);
        return [];
      }

      const songs: Song[] = data.data.lists.map((item) => {
        const cover = item.Image ? toHttps(item.Image) : DEFAULT_COVER;
        return {
          id: item.HQFileHash,
          title: stripHighlightTags(item.SongName),
          artist: item.SingerName || '未知歌手',
          album: item.AlbumName || '未知专辑',
          cover,
          source: 'kugou',
          duration: item.HQDuration || 0,
          lyrics: DEFAULT_LYRIC,
        };
      });

      debugLogger.log(`[Kugou] 搜索返回 ${songs.length} 首歌曲`);
      return songs;
    } catch (error) {
      debugLogger.error(`[Kugou] 搜索异常: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  },

  async getPlayUrl(song: Song): Promise<string | null> {
    const url = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${song.id}`;
    debugLogger.log(`[Kugou] 获取播放URL: hash=${song.id}`);

    try {
      const data = await httpGet<KugouPlayInfoResponse>(url);
      if (data.status !== 1 || !data.url) {
        debugLogger.warn(`[Kugou] 获取播放URL失败, status=${data.status}`);
        return null;
      }
      const playUrl = toHttps(data.url);
      debugLogger.log(`[Kugou] 播放URL: ${playUrl}`);
      return playUrl;
    } catch (error) {
      debugLogger.error(`[Kugou] 获取播放URL异常: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  },

  async getLyric(song: Song): Promise<string> {
    const keyword = `${song.title} ${song.artist}`;
    const timelength = song.duration * 1000;
    const rawUrl = `http://m.kugou.com/app/i/krc.php?keyword=${encodeURIComponent(keyword)}&hash=${song.id}&timelength=${timelength}&client=mobi&cmd=100`;
    const url = toHttps(rawUrl);
    debugLogger.log(`[Kugou] 获取歌词: ${song.title} - ${song.artist}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      if (text && text.trim()) {
        return text;
      }
      return DEFAULT_LYRIC;
    } catch (error) {
      clearTimeout(timeoutId);
      debugLogger.error(`[Kugou] 获取歌词异常: ${error instanceof Error ? error.message : String(error)}`);
      return DEFAULT_LYRIC;
    }
  },
};

export default kugouAdapter;
