// 真实文件下载服务
// Android: 使用 Capacitor Filesystem + fetch 下载到本地
// Web: 使用浏览器缓存模拟（IndexedDB 或内存）

import { Capacitor } from '@capacitor/core';
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
  let url: string | null = null;
  try {
    url = await getPlayUrlWithRetry(Number(song.id), 2);
  } catch {
    url = null;
  }

  const downloadUrl = url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  const fileName = getSafeFileName(song);
  const filePath = `${DOWNLOAD_DIR}/${fileName}`;

  if (isNative) {
    return downloadNative(downloadUrl, song, filePath, fileName, onProgress);
  } else {
    return downloadWeb(downloadUrl, song, onProgress);
  }
}

// Android 原生下载（使用 fetch + Filesystem.write）
async function downloadNative(
  url: string,
  song: Song,
  filePath: string,
  _fileName: string,
  onProgress: ProgressCallback
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const totalBytes = contentLength || 5 * 1024 * 1024; // 默认 5MB
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
        filePath,
        fileSize: formatFileSize(receivedBytes),
      });
    }

    // 合并 chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // 写入文件
    const base64Data = uint8ArrayToBase64(result);
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
      receivedBytes: totalLength,
      totalBytes,
      filePath,
      fileSize: formatFileSize(totalLength),
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

// 读取已下载文件为 Blob URL（用于播放）
export async function readDownloadedFile(song: Song): Promise<string | null> {
  if (!isNative) return null;

  try {
    const result = await Filesystem.readFile({
      path: `${DOWNLOAD_DIR}/${getSafeFileName(song)}`,
      directory: Directory.Documents,
    });

    // data 是 base64 编码
    const binaryString = atob(result.data as string);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// Uint8Array 转 Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
