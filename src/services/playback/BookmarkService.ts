import { BookmarkRepository } from '../../database/repository';
import { BookmarkRecord } from '../../types';
import { audioEngineInstance } from '../../audio/AudioEngine';

export class BookmarkService {
  private static instance: BookmarkService | null = null;

  public static getInstance(): BookmarkService {
    if (!BookmarkService.instance) {
      BookmarkService.instance = new BookmarkService();
    }
    return BookmarkService.instance;
  }

  public async addBookmark(
    trackId: string,
    position: number,
    title?: string,
    notes?: string
  ): Promise<BookmarkRecord> {
    const formattedMinutes = Math.floor(position / 60);
    const formattedSeconds = Math.floor(position % 60);
    const timeLabel = `${formattedMinutes}:${formattedSeconds < 10 ? '0' : ''}${formattedSeconds}`;

    const defaultTitle = title?.trim() || `Bookmark at ${timeLabel}`;
    const record: Omit<BookmarkRecord, 'id'> = {
      trackId,
      position: Math.round(position * 10) / 10,
      title: defaultTitle,
      notes: notes?.trim(),
      createdAt: Date.now(),
    };

    const id = await BookmarkRepository.add(record);
    return { ...record, id };
  }

  public async getBookmarksForTrack(trackId: string): Promise<BookmarkRecord[]> {
    return await BookmarkRepository.getByTrackId(trackId);
  }

  public async getAllBookmarks(): Promise<BookmarkRecord[]> {
    return await BookmarkRepository.getAll();
  }

  public async removeBookmark(id: number): Promise<void> {
    await BookmarkRepository.remove(id);
  }

  public async updateBookmark(id: number, updates: Partial<BookmarkRecord>): Promise<void> {
    await BookmarkRepository.update(id, updates);
  }

  public seekToBookmark(bookmark: BookmarkRecord): void {
    audioEngineInstance.seek(bookmark.position);
  }
}

export const bookmarkService = BookmarkService.getInstance();

