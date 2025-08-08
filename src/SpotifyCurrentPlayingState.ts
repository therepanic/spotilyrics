export class SpotifyCurrentPlayingState {
    name: string;
    authors: string;
    plainLyrics?: string;
    synchronizedLyrics?: string;

    constructor(name: string, authors: string, plainLyrics?: string, synchronizedLyrics?: string) {
        this.name = name;
        this.authors = authors;
        this.plainLyrics = plainLyrics;
        this.synchronizedLyrics = synchronizedLyrics;
    }

}