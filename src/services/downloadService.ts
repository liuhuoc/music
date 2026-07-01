// 真实文件下载服务
// Android: 使用 CapacitorHttp + Filesystem 下载到本地
// Web: 使用 fetch + Blob URL 模拟下载

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getPlayUrlWithRetry } from './musicApi';
import type { Song } from '../data/songs';

const isNative = Capacitor.isNativePlatform();
const DOWNLOAD_DIR = 'Music/MusicPlayer';

export interface DownloadProgress {
  songId: string;
  progress: number; // 0-100
  status: 'downloading' | 'completed' | 'paused' | 'failed';
  receivedBytes: number;
  totalBytes: number;
  filePath?: string;
  fileSize: string;
  sizeBytes: number;
}

type ProgressCallback = (progress: DownloadProgress) => void;

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 确保下载目录存在
async function ensureDownloadDir(): Promise<void> {
  if (!isNative) return;
  try {
    await Filesystem.mkdir({
      path: DOWNLOAD_DIR,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch (e: unknown) {
    // 目录可能已存在，忽略错误
    const err = e as { message?: string };
    if (!err.message?.includes('exists')) {
      console.warn('Failed to create download dir:', err.message);
    }
  }
}

// 获取安全的文件名
function getSafeFileName(song: Song): string {
  const safeName = song.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  return `${safeName}-${song.id}.mp3`;
}

// 获取文件的本地路径
export function getLocalFilePath(song: Song): string {
  return `${DOWNLOAD_DIR}/${getSafeFileName(song)}`;
}

// 检查文件是否已下载
export async function isFileDownloaded(song: Song): Promise<boolean> {
  if (!isNative) return false;

  try {
    const result = await Filesystem.stat({
      path: `${DOWNLOAD_DIR}/${getSafeFileName(song)}`,
      directory: Directory.Documents,
    });
    return !!result;
  } catch {
    return false;
  }
}

// 下载音频文件（真实下载）
export async function downloadSong(
  song: Song,
  onProgress: ProgressCallback
): Promise<string | null> {
  await ensureDownloadDir();

  // 获取播放 URL
  const url = await getPlayUrlWithRetry(song, 2);
  if (!url) {
    onProgress({
      songId: song.id,
      progress: 0,
      status: 'failed',
      receivedBytes: 0,
      totalBytes: 0,
      fileSize: '0 B',
      sizeBytes: 0,
    });
    return null;
  }

  const fileName = getSafeFileName(song);
  const filePath = `${DOWNLOAD_DIR}/${fileName}`;

  if (isNative) {
    return downloadNative(url, song, filePath, fileName, onProgress);
  } else {
    return downloadWeb(url, song, onProgress);
  }
}

// Android 原生下载（使用 CapacitorHttp 获取数据 + Filesystem 写入）
// CapacitorHttp 不支持流式进度，但能绕过 CORS 限制
async function downloadNative(
  url: string,
  song: Song,
  filePath: string,
  _fileName: string,
  onProgress: ProgressCallback
): Promise<string | null> {
  try {
    onProgress({
      songId: song.id,
      progress: 10,
      status: 'downloading',
      receivedBytes: 0,
      totalBytes: 0,
      filePath,
      fileSize: '0 B',
      sizeBytes: 0,
    });

    // 使用 CapacitorHttp 直接下载，responseType=arraybuffer 返回 base64
    // 注意：CapacitorHttp 在 Android 上的超时单位是毫秒
    const response = await CapacitorHttp.request({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      connectTimeout: 30000,
      readTimeout: 60000,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    // CapacitorHttp 对于 arraybuffer 响应返回 base64 编码的字符串
    const base64Data = typeof response.data === 'string'
      ? response.data
      : String(response.data || '');

    if (!base64Data) {
      throw new Error('下载数据为空');
    }

    // 估算文件大小（base64 长度 * 3/4 ≈ 原始字节数）
    const estimatedBytes = Math.floor(base64Data.length * 3 / 4);

    onProgress({
      songId: song.id,
      progress: 80,
      status: 'downloading',
      receivedBytes: estimatedBytes,
      totalBytes: estimatedBytes,
      filePath,
      fileSize: formatFileSize(estimatedBytes),
      sizeBytes: estimatedBytes,
    });

    // 直接将 base64 数据写入文件
    await Filesystem.writeFile({
      path: filePath,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });

    onProgress({
      songId: song.id,
      progress: 100,
      status: 'completed',
      receivedBytes: estimatedBytes,
      totalBytes: estimatedBytes,
      filePath,
      fileSize: formatFileSize(estimatedBytes),
      sizeBytes: estimatedBytes,
    });

    return filePath;
  } catch (e) {
    console.error('Download failed:', e);
    onProgress({
      songId: song.id,
      progress: 0,
      status: 'failed',
      receivedBytes: 0,
      totalBytes: 0,
      fileSize: '0 B',
      sizeBytes: 0,
    });
    return null;
  }
}

// Web 端下载（使用 fetch + Blob URL）
async function downloadWeb(
  url: string,
  song: Song,
  onProgress: ProgressCallback
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const totalBytes = contentLength || 5 * 1024 * 1024;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedBytes += value.length;

      const progress = Math.min(100, (receivedBytes / totalBytes) * 100);
      onProgress({
        songId: song.id,
        progress,
        status: 'downloading',
        receivedBytes,
        totalBytes,
        fileSize: formatFileSize(receivedBytes),
        sizeBytes: receivedBytes,
      });
    }

    // 创建 Blob URL
    const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
    const blobUrl = URL.createObjectURL(blob);

    // 存储到 sessionStorage（Web 端简易持久化）
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    onProgress({
      songId: song.id,
      progress: 100,
      status: 'completed',
      receivedBytes: totalLength,
      totalBytes,
      filePath: blobUrl,
      fileSize: formatFileSize(totalLength),
      sizeBytes: totalLength,
    });

    return blobUrl;
  } catch (e) {
    console.error('Download failed:', e);
    onProgress({
      songId: song.id,
      progress: 0,
      status: 'failed',
      receivedBytes: 0,
      totalBytes: 0,
      fileSize: '0 B',
      sizeBytes: 0,
    });
    return null;
  }
}

// 删除已下载的文件
export async function deleteDownloadedFile(song: Song): Promise<boolean> {
  if (!isNative) return true;

  try {
    await Filesystem.deleteFile({
      path: `${DOWNLOAD_DIR}/${getSafeFileName(song)}`,
      directory: Directory.Documents,
    });
    return true;
  } catch {
    return false;
  }
}

// 获取已下载文件的大小
export async function getDownloadedFileSize(song: Song): Promise<string> {
  if (!isNative) return '0 B';

  try {
    const stat = await Filesystem.stat({
      path: `${DOWNLOAD_DIR}/${getSafeFileName(song)}`,
      directory: Directory.Documents,
    });
    return formatFileSize(stat.size || 0);
  } catch {
    return '0 B';
  }
}

// 获取已下载文件的本地文件路径（用于原生播放）
// NativeAudio 支持 file:// 协议，不支持 blob://
export async function readDownloadedFile(song: Song): Promise<string | null> {
  if (!isNative) return null;

  try {
    const filePath = `${DOWNLOAD_DIR}/${getSafeFileName(song)}`;
    const result = await Filesystem.getUri({
      path: filePath,
      directory: Directory.Documents,
    });
    return result.uri;
  } catch {
    return null;
  }
}
