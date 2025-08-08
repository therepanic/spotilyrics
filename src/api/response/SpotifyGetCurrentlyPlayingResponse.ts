export interface SpotifyGetCurrentlyPlayingResponse {
    progress_ms: number;
    item: Item;
}

interface Item {
    artists: Artist[];
    name: string;
}

interface Artist {
    name: string;
}
