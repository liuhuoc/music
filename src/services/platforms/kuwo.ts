import { debugLogger } from '../../utils/debugLogger';
import { toHttps, httpGet, DEFAULT_LYRIC, DEFAULT_COVER } from './types';
import type { PlatformAdapter } from './types';
import type { Song } from '../../data/songs';

// 酷我搜索结果原始条目
interface KuwoSearchItem {
  DC_TARGETID: string;
  SONGNAME: string;
  ARTIST: string;
  ALBUM: string;
  DURATION: string;
  web_alph_pic: string;
  MUSICRID: string;
}

interface KuwoSearchResponse {
  TOTAL: string;
  abslist: KuwoSearchItem[];
}

// 酷我歌词条目
interface KuwoLrcLine {
  lineLyric: string;
  time: string;
}

interface KuwoLyricResponse {
  status: number;
  data: {
    lrclist: KuwoLrcLine[];
  };
}

// 将秒数时间字符串格式化为 LRC 时间戳 [mm:ss.xx]
function formatLrcTime(time: string): string {
  const seconds = parseFloat(time);
  if (isNaN(seconds) || seconds < 0) return '[00:00.00]';
  const totalMs = Math.floor(seconds * 1000);
  const mm = Math.floor(totalMs / 60000);
  const ss = Math.floor((totalMs % 60000) / 1000);
  const xx = totalMs % 1000;
  const pad = (n: number, len: number) => String(n).padStart(len, '0');
  return `[${pad(mm, 2)}:${pad(ss, 2)}.${pad(xx, 2)}]`;
}

export const kuwoAdapter: PlatformAdapter = {
  id: 'kuwo',
  name: '酷我音乐',
  canPlay: true,

  async search(keyword: string, limit = 30, offset = 0): Promise<Song[]> {
    const pn = Math.floor(offset / limit);
    const rn = limit;
    const url = `https://search.kuwo.cn/r.s?all=${encodeURIComponent(keyword)}&pn=${pn}&rn=${rn}&enc=json&ft=music&rformat=json&encoding=utf8&mobi=1`;
    debugLogger.log(`[Kuwo] 搜索: ${keyword} (pn=${pn}, rn=${rn})`);
    try {
      const data = await httpGet<KuwoSearchResponse>(url);
      const list = data?.abslist;
      if (!Array.isArray(list)) {
        debugLogger.warn('[Kuwo] 搜索结果为空');
        return [];
      }
      const songs: Song[] = list.map((item) => {
        const rawName = item.SONGNAME || '';
        const name = rawName.replace(/<\/?font[^>]*>/g, '');
        const artist = (item.ARTIST || '').replace(/<\/?font[^>]*>/g, '');
        const album = (item.ALBUM || '').replace(/<\/?font[^>]*>/g, '');
        const cover = item.web_alph_pic ? toHttps(item.web_alph_pic) : DEFAULT_COVER;
        const duration = parseInt(item.DURATION, 10) || 0;
        return {
          id: item.DC_TARGETID,
          title: name,
          artist,
          album,
          cover,
          source: 'kuwo',
          duration,
          lyrics: '',
        };
      });
      debugLogger.log(`[Kuwo] 搜索到 ${songs.length} 首歌曲`);
      return songs;
    } catch (error) {
      debugLogger.error(`[Kuwo] 搜索失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  },

  async getPlayUrl(song: Song): Promise<string | null> {
    const rid = song.id;
    const url = `https://antiserver.kuwo.cn/anti.s?format=mp3&rid=${rid}&type=convert_url&response=url`;
    debugLogger.log(`[Kuwo] 获取播放URL: rid=${rid}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        debugLogger.error(`[Kuwo] 获取播放URL失败: HTTP ${response.status}`);
        return null;
      }
      const text = (await response.text()).trim();
      if (!text) {
        debugLogger.warn('[Kuwo] 播放URL为空');
        return null;
      }
      const httpsUrl = toHttps(text);
      debugLogger.log(`[Kuwo] 播放URL: ${httpsUrl}`);
      return httpsUrl;
    } catch (error) {
      debugLogger.error(`[Kuwo] 获取播放URL失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  },

  async getLyric(song: Song): Promise<string> {
    const musicId = song.id;
    const url = `https://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${musicId}`;
    debugLogger.log(`[Kuwo] 获取歌词: musicId=${musicId}`);
    try {
      const data = await httpGet<KuwoLyricResponse>(url, {
        Referer: 'https://m.kuwo.cn/newh5/singles/songinfoandlrc',
      });
      const lrclist = data?.data?.lrclist;
      if (!Array.isArray(lrclist) || lrclist.length === 0) {
        debugLogger.warn('[Kuwo] 歌词为空');
        return DEFAULT_LYRIC;
      }
      const lrc = lrclist
        .map((line) => `${formatLrcTime(line.time)}${line.lineLyric || ''}`)
        .join('\n');
      debugLogger.log(`[Kuwo] 歌词获取成功, 共 ${lrclist.length} 行`);
      return lrc || DEFAULT_LYRIC;
    } catch (error) {
      debugLogger.error(`[Kuwo] 获取歌词失败: ${error instanceof Error ? error.message : String(error)}`);
      return DEFAULT_LYRIC;
    }
  },
};

export default kuwoAdapter;
