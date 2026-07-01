// 多平台统一音乐服务层
// 作为所有平台适配器的统一入口，提供搜索、播放、歌词等聚合能力
import { debugLogger } from '../utils/debugLogger';
import type { Song } from '../data/songs';
import type { PlatformAdapter, Platform } from './platforms/types';
import { DEFAULT_LYRIC } from './platforms/types';
import { neteaseAdapter } from './platforms/netease';
import { kuwoAdapter } from './platforms/kuwo';
import { kugouAdapter } from './platforms/kugou';
import { qqAdapter } from './platforms/qqmusic';

// 平台注册表：source -> 适配器
const adapters: Record<string, PlatformAdapter> = {
  netease: neteaseAdapter,
  kuwo: kuwoAdapter,
  kugou: kugouAdapter,
  qq: qqAdapter,
};

// 平台列表（用于 UI 展示与过滤）
export const PLATFORMS: ReadonlyArray<{ id: Platform; name: string; canPlay: boolean }> = [
  { id: 'netease', name: '网易云音乐', canPlay: true },
  { id: 'kuwo', name: '酷我音乐', canPlay: true },
  { id: 'kugou', name: '酷狗音乐', canPlay: true },
  { id: 'qq', name: 'QQ音乐', canPlay: false },
];

// 根据 source 获取适配器
export function getAdapter(source: string): PlatformAdapter | undefined {
  const adapter = adapters[source];
  if (!adapter) {
    debugLogger.warn(`[musicApi] 未找到平台适配器: source="${source}"`);
  }
  return adapter;
}

// 单平台搜索
export async function searchByPlatform(
  platform: string,
  keyword: string,
  limit: number = 30,
  offset: number = 0,
): Promise<Song[]> {
  const adapter = getAdapter(platform);
  if (!adapter) {
    debugLogger.warn(`[musicApi] 单平台搜索失败，未知平台: ${platform}`);
    return [];
  }
  debugLogger.log(`[musicApi] 单平台搜索: platform=${platform}, keyword="${keyword}", limit=${limit}, offset=${offset}`);
  try {
    const songs = await adapter.search(keyword, limit, offset);
    debugLogger.log(`[musicApi] 平台 ${platform} 返回 ${songs.length} 首歌曲`);
    return songs;
  } catch (error) {
    debugLogger.error(`[musicApi] 平台 ${platform} 搜索异常: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// 多平台聚合搜索，使用 Promise.allSettled 并行搜索所有平台，合并结果
export async function searchAll(keyword: string, limit: number = 20): Promise<Song[]> {
  debugLogger.log(`[musicApi] 聚合搜索: keyword="${keyword}", limit=${limit}`);
  const entries = Object.values(adapters);
  const results = await Promise.allSettled(
    entries.map((adapter) => adapter.search(keyword, limit)),
  );

  const merged: Song[] = [];
  results.forEach((result, index) => {
    const adapter = entries[index];
    if (result.status === 'fulfilled') {
      debugLogger.log(`[musicApi] 平台 ${adapter.id} 搜索成功: ${result.value.length} 首`);
      merged.push(...result.value);
    } else {
      debugLogger.error(`[musicApi] 平台 ${adapter.id} 搜索失败: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });

  debugLogger.log(`[musicApi] 聚合搜索完成，共 ${merged.length} 首歌曲`);
  return merged;
}

// 根据歌曲 source 路由到正确适配器获取播放 URL
export async function getPlayUrlForSong(song: Song): Promise<string | null> {
  const adapter = getAdapter(song.source);
  if (!adapter) {
    debugLogger.warn(`[musicApi] 获取播放URL失败，未知平台: source="${song.source}"`);
    return null;
  }
  if (!adapter.canPlay) {
    debugLogger.warn(`[musicApi] 平台 ${adapter.id} 不支持播放: ${song.title}`);
    return null;
  }
  debugLogger.log(`[musicApi] 获取播放URL: platform=${adapter.id}, id=${song.id}, title="${song.title}"`);
  try {
    const url = await adapter.getPlayUrl(song);
    if (url) {
      debugLogger.log(`[musicApi] 播放URL获取成功: platform=${adapter.id}`);
    } else {
      debugLogger.warn(`[musicApi] 播放URL为空: platform=${adapter.id}, id=${song.id}`);
    }
    return url;
  } catch (error) {
    debugLogger.error(`[musicApi] 获取播放URL异常: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// 根据歌曲 source 路由到正确适配器获取歌词
export async function getLyricForSong(song: Song): Promise<string> {
  const adapter = getAdapter(song.source);
  if (!adapter) {
    debugLogger.warn(`[musicApi] 获取歌词失败，未知平台: source="${song.source}"`);
    return DEFAULT_LYRIC;
  }
  debugLogger.log(`[musicApi] 获取歌词: platform=${adapter.id}, id=${song.id}, title="${song.title}"`);
  try {
    return await adapter.getLyric(song);
  } catch (error) {
    debugLogger.error(`[musicApi] 获取歌词异常: ${error instanceof Error ? error.message : String(error)}`);
    return DEFAULT_LYRIC;
  }
}

// 向后兼容：搜索并获取完整歌曲信息（含歌词）
// 若指定 platform 则单平台搜索，否则使用 searchAll 聚合搜索
// 歌词异步加载，不阻塞主流程
export async function searchAndGetFullSongs(
  keywords: string,
  limit: number = 20,
  platform?: string,
): Promise<Song[]> {
  debugLogger.log(`[musicApi] searchAndGetFullSongs: keywords="${keywords}", limit=${limit}, platform=${platform ?? '(all)'}`);
  const songs = platform
    ? await searchByPlatform(platform, keywords, limit)
    : await searchAll(keywords, limit);

  if (songs.length === 0) {
    debugLogger.log('[musicApi] searchAndGetFullSongs 未返回任何歌曲');
    return [];
  }

  // 异步加载歌词（不阻塞主流程）
  songs.forEach(async (song) => {
    try {
      const lyric = await getLyricForSong(song);
      song.lyrics = lyric;
    } catch {
      // 保持默认歌词
    }
  });

  debugLogger.log(`[musicApi] searchAndGetFullSongs 返回 ${songs.length} 首歌曲，歌词异步加载中`);
  return songs;
}

// 向后兼容：获取播放 URL（带重试）
// 参数从 (id: number, retries) 改为 (song: Song, retries)
export async function getPlayUrlWithRetry(song: Song, retries: number = 2): Promise<string | null> {
  debugLogger.log(`[musicApi] 获取播放URL（带重试）: id=${song.id}, retries=${retries}`);
  try {
    return await getPlayUrlForSong(song);
  } catch (error) {
    if (retries > 0) {
      debugLogger.warn(`[musicApi] 播放URL获取失败，${retries} 次重试机会剩余: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return getPlayUrlWithRetry(song, retries - 1);
    }
    debugLogger.error(`[musicApi] 播放URL重试耗尽: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// 向后兼容：获取歌词
// 参数从 (id: number) 改为 (song: Song)
export async function getLyric(song: Song): Promise<string> {
  return getLyricForSong(song);
}

// 向后兼容：获取排行榜详情，委托给 neteaseAdapter.getToplist
// 带重试机制（最多 3 次），返回 Song[]
export async function getToplistDetail(id: number): Promise<Song[]> {
  debugLogger.log(`[musicApi] 获取排行榜: id=${id}`);
  if (!neteaseAdapter.getToplist) {
    debugLogger.warn('[musicApi] netease 适配器未实现 getToplist');
    return [];
  }
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const songs = await neteaseAdapter.getToplist(id);
      if (songs.length > 0) {
        debugLogger.log(`[musicApi] 排行榜返回 ${songs.length} 首歌曲 (第 ${attempt} 次尝试)`);
        return songs;
      }
      debugLogger.warn(`[musicApi] 排行榜返回空 (第 ${attempt}/${maxRetries} 次)`);
    } catch (error) {
      debugLogger.error(`[musicApi] 排行榜异常 (第 ${attempt}/${maxRetries} 次): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  debugLogger.warn(`[musicApi] 排行榜 ${maxRetries} 次重试均失败`);
  return [];
}

// 向后兼容：转换为应用内 Song 格式
// 适配器已经返回 Song 格式，直接返回原对象
export function convertToAppSong(song: Song): Song {
  return song;
}

// 获取热门搜索（暂未实现，返回空数组）
export async function getHotSearch(): Promise<string[]> {
  return [];
}
