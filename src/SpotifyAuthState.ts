export class SpotifyAuthState {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;

    constructor(accessToken: string, refreshToken: string, expiresIn: number) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresIn = expiresIn;
    }
}