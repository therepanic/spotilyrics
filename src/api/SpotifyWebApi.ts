import {SpotifyGetTokenResponse} from "./response/SpotifyGetTokenResponse";

export class SpotifyWebApi {

    static async getAuthUrl(clientId: string, codeChallenge: string) {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            scope: 'user-read-currently-playing',
            redirect_uri: 'http://127.0.0.1:8000/callback',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        return `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    static async getToken(clientId: string, codeVerifier: string, redirectUri: string, code: string, grantType: string) {
        const params = new URLSearchParams();
        params.append('grant_type', grantType);
        params.append('code', code);
        params.append('redirect_uri', redirectUri);
        params.append('code_verifier', codeVerifier);
        params.append('client_id', clientId);

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        return await response.json() as SpotifyGetTokenResponse;
    }

}