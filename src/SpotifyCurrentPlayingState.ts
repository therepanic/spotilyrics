import TreeMap from 'ts-treemap';
import { LyricsEntry } from './LyricsEntry';

export class SpotifyCurrentPlayingState {
    name: string;
    authors: string;
    plainLyricsStrs?: string[];
    synchronizedLyricsMap?: TreeMap<number, LyricsEntry>;

    constructor(
        name: string,
        authors: string,
        plainLyricsStrs?: string[],
        synchronizedLyricsMap?: TreeMap<number, LyricsEntry>
    ) {
        this.name = name;
        this.authors = authors;
        this.plainLyricsStrs = plainLyricsStrs;
        this.synchronizedLyricsMap = synchronizedLyricsMap;
    }
}
