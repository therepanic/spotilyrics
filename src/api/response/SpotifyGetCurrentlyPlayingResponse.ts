export interface SpotifyGetCurrentlyPlayingResponse {
    progress_ms: number;
    item: Item;
}

interface Item {
    album: Album;
    artists: Artist[];
    name: string;
    duration_ms: number;
}

interface Artist {
    name: string;
}

interface Album {
    name: string;
    images: Image[];
}

interface Image {
    url: string;
}
