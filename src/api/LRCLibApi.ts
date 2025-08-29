import { LRCLibSearchResponse } from './response/LRCLibGetResponse';

export class LRCLibApi {
    static async get(
        track_name?: string,
        artist_name?: string,
        album_name?: string,
        duration?: number
    ) {
        const params = new URLSearchParams();

        if (track_name) {
            params.append('track_name', track_name);
        }
        if (artist_name) {
            params.append('artist_name', artist_name);
        }
        if (album_name) {
            params.append('album_name', album_name);
        }
        if (duration) {
            params.append('duration', duration.toString());
        }

        const url = `https://lrclib.net/api/get?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'User-Agent': 'LRCGET v0.2.0 (https://github.com/therepanic/spotilyrics)',
            },
        });

        return (await response.json()) as LRCLibSearchResponse;
    }
}
