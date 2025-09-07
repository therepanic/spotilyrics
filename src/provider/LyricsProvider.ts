import { LyricsResult } from './LyricsResult';

export interface LyricsProvider {
    getLyrics(
        track_name?: string,
        artist_name?: string,
        album_name?: string,
        duration?: number
    ): Promise<LyricsResult | null>;
}
