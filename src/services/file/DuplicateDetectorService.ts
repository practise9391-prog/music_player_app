import { Track } from '../../types';
import { DuplicateGroupDetail } from '../../types/fileManagement';
import { TrackRepository } from '../../database/repository';

export class DuplicateDetectorService {
  private static instance: DuplicateDetectorService | null = null;

  private constructor() {}

  public static getInstance(): DuplicateDetectorService {
    if (!this.instance) {
      this.instance = new DuplicateDetectorService();
    }
    return this.instance;
  }

  /**
   * Normalizes strings for robust fuzzy metadata matching (lowercased, punctuation-trimmed).
   */
  private normalizeString(str?: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[\(\[\{].*?[\)\]\}]/g, '') // strip (feat. ...), [Remastered] for base matching
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Computes the recommended track to keep within a group based on verified audio quality
   * and user preference data.
   */
  private pickRecommendedTrack(tracks: Track[]): string {
    if (tracks.length === 0) return '';
    if (tracks.length === 1) return tracks[0].id;

    let bestScore = -1;
    let bestId = tracks[0].id;

    for (const t of tracks) {
      let score = 0;
      // Audio quality weight: higher bitrate preferred
      score += (t.bitrate || 128);
      // Sample rate weight
      if (t.sampleRate && t.sampleRate >= 48000) score += 50;
      // Lossless formats preferred
      if (['flac', 'wav', 'alac'].includes((t.format || '').toLowerCase())) score += 200;
      // User engagement: favorite and rating boost
      if (t.isFavorite) score += 100;
      if (t.rating) score += t.rating * 30;
      if (t.playCount) score += Math.min(50, t.playCount * 2);

      if (score > bestScore) {
        bestScore = score;
        bestId = t.id;
      }
    }

    return bestId;
  }

  /**
   * Scans the complete local music library and groups potential duplicate tracks.
   */
  public async findDuplicates(): Promise<DuplicateGroupDetail[]> {
    const allTracks = await TrackRepository.getAllIncludingUnavailable();
    const groups: DuplicateGroupDetail[] = [];
    const visitedTrackIds = new Set<string>();

    // 1. Level 1: Exact Hash / Identical Content Matches
    const hashBuckets = new Map<string, Track[]>();
    for (const t of allTracks) {
      const hash = t.fileHash || (t as any).contentHash;
      if (hash) {
        const list = hashBuckets.get(hash) || [];
        list.push(t);
        hashBuckets.set(hash, list);
      }
    }

    for (const [hash, group] of hashBuckets.entries()) {
      if (group.length > 1) {
        group.forEach((t) => visitedTrackIds.add(t.id));
        const bestId = this.pickRecommendedTrack(group);
        const originalTrack = group.find((t) => t.id === bestId) || group[0];
        const duplicateTracks = group.filter((t) => t.id !== bestId);
        const recReason = originalTrack.bitrate && duplicateTracks.some((d) => (d.bitrate || 0) < originalTrack.bitrate!)
          ? `Higher audio bitrate (${originalTrack.bitrate} kbps)`
          : (originalTrack.isFavorite ? 'User favorite track' : 'Verified highest audio quality');

        groups.push({
          id: `hash_${hash}`,
          matchType: 'exact_hash',
          reason: 'Identical content hash & audio checksum',
          tracks: group,
          allTracks: group,
          originalTrack,
          duplicateTracks,
          recommendedToKeepId: bestId,
          recommendedKeepId: bestId,
          recommendationReason: recReason,
        });
      }
    }

    // 2. Level 2: Exact File Size + Duration match (strong binary similarity)
    const sizeDurationBuckets = new Map<string, Track[]>();
    for (const t of allTracks) {
      if (visitedTrackIds.has(t.id) || !t.fileSize || !t.duration) continue;
      const key = `${t.fileSize}::${Math.round(t.duration)}`;
      const list = sizeDurationBuckets.get(key) || [];
      list.push(t);
      sizeDurationBuckets.set(key, list);
    }

    for (const [key, group] of sizeDurationBuckets.entries()) {
      if (group.length > 1) {
        group.forEach((t) => visitedTrackIds.add(t.id));
        const bestId = this.pickRecommendedTrack(group);
        const originalTrack = group.find((t) => t.id === bestId) || group[0];
        const duplicateTracks = group.filter((t) => t.id !== bestId);

        groups.push({
          id: `size_dur_${key}`,
          matchType: 'size_duration',
          reason: 'Identical file size and audio duration',
          tracks: group,
          allTracks: group,
          originalTrack,
          duplicateTracks,
          recommendedToKeepId: bestId,
          recommendedKeepId: bestId,
          recommendationReason: 'Identical binary byte size and audio duration',
        });
      }
    }

    // 3. Level 3: Normalized Title + Artist + Close Duration (±2.5 seconds)
    const titleArtistBuckets = new Map<string, Track[]>();
    for (const t of allTracks) {
      if (visitedTrackIds.has(t.id)) continue;
      const normTitle = this.normalizeString(t.title);
      const normArtist = this.normalizeString(t.artist);
      if (!normTitle) continue;

      const key = `${normTitle}:::${normArtist}`;
      const list = titleArtistBuckets.get(key) || [];
      list.push(t);
      titleArtistBuckets.set(key, list);
    }

    for (const [key, group] of titleArtistBuckets.entries()) {
      if (group.length > 1) {
        // Group by duration within ±2.5s tolerance
        const subBuckets: Track[][] = [];
        for (const track of group) {
          let placed = false;
          for (const sub of subBuckets) {
            if (Math.abs(sub[0].duration - track.duration) <= 2.5) {
              sub.push(track);
              placed = true;
              break;
            }
          }
          if (!placed) {
            subBuckets.push([track]);
          }
        }

        for (const sub of subBuckets) {
          if (sub.length > 1) {
            sub.forEach((t) => visitedTrackIds.add(t.id));
            const bestId = this.pickRecommendedTrack(sub);
            const originalTrack = sub.find((t) => t.id === bestId) || sub[0];
            const duplicateTracks = sub.filter((t) => t.id !== bestId);
            const recReason = originalTrack.bitrate && duplicateTracks.some((d) => (d.bitrate || 0) < originalTrack.bitrate!)
              ? `Higher audio bitrate (${originalTrack.bitrate} kbps)`
              : (originalTrack.isFavorite ? 'User favorite track' : 'Matching metadata with best quality');

            groups.push({
              id: `meta_${key}_${Math.round(sub[0].duration)}`,
              matchType: 'metadata_match',
              reason: 'Matching title, artist and duration',
              tracks: sub,
              allTracks: sub,
              originalTrack,
              duplicateTracks,
              recommendedToKeepId: bestId,
              recommendedKeepId: bestId,
              recommendationReason: recReason,
            });
          }
        }
      }
    }

    return groups;
  }
}

export const duplicateDetectorService = DuplicateDetectorService.getInstance();
