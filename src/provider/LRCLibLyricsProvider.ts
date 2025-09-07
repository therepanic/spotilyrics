import { LyricsProvider } from './LyricsProvider';
import { LyricsResult } from './LyricsResult';
import { LRCLibApi } from '../api/LRCLibApi';

export class LRCLibLyricsProvider implements LyricsProvider {
    async getLyrics(
        track_name?: string,
        artist_name?: string,
        album_name?: string,
        duration?: number
    ): Promise<LyricsResult | null> {
        const result = await LRCLibApi.get(track_name, artist_name, album_name, duration);
        if (result.statusCode) {
            return null;
        }
        return {
            name: result.name,
            trackName: result.trackName,
            artistName: result.artistName,
            albumName: result.albumName,
            plainLyrics: result.plainLyrics,
            syncedLyrics: result.syncedLyrics,
            instrumental: result.instrumental,
        };
    }
}
