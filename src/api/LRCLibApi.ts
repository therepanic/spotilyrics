import { LRCLibSearchResponse } from "./response/LRCLibSearchResponse";

export class LRCLibApi {

    static async search(q?: string, trackName?: string, artistName?: string, albumName?: string) {
        const params = new URLSearchParams();

        if (q) params.append('q', q);
        if (trackName) params.append('track_name', trackName);
        if (artistName) params.append('artist_name', artistName);
        if (albumName) params.append('album_name', albumName);

        const url = `https://lrclib.net/api/search?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'LRCGET v0.2.0 (https://github.com/therepanic/spotilyrics)'
            },
        });

        return await response.json() as LRCLibSearchResponse[];
    }

}