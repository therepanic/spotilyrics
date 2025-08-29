export class SpotifyPreAuthState {
    readonly clientId: string;
    readonly codeVerifier: string;
    readonly codeChallenge: string;
    readonly grantType: string;
    readonly redirectUri: string;

    constructor(
        clientId: string,
        codeVerifier: string,
        codeChallenge: string,
        grantType: string,
        redirectUri: string
    ) {
        this.clientId = clientId;
        this.codeVerifier = codeVerifier;
        this.codeChallenge = codeChallenge;
        this.grantType = grantType;
        this.redirectUri = redirectUri;
    }
}
