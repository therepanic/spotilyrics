export interface LRCLibSearchResponse {
    statusCode?: number;
    name: string;
    trackName: string;
    artistName: string;
    albumName: string;
    plainLyrics?: string;
    syncedLyrics?: string;
    instrumental?: boolean;
}
