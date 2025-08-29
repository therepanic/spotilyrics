export class SpotifyAuthState {
    clientId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;

    constructor(clientId: string, accessToken: string, refreshToken: string, expiresIn: number) {
        this.clientId = clientId;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresIn = expiresIn;
    }
}
