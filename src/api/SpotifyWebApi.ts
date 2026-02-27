import { SpotifyGetCurrentlyPlayingResponse } from './response/SpotifyGetCurrentlyPlayingResponse';
import { SpotifyGetTokenResponse } from './response/SpotifyGetTokenResponse';
import { SpotifyRefreshTokenResponse } from './response/SpotifyRefreshTokenResponse';
import fetch from 'node-fetch';

export class SpotifyWebApi {
    static async getAuthUrl(port: number, clientId: string, codeChallenge: string) {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            scope: 'user-read-currently-playing',
            redirect_uri: `http://127.0.0.1:${port}/callback`,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        return `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    static async getToken(
        clientId: string,
        codeVerifier: string,
        redirectUri: string,
        code: string,
        grantType: string
    ) {
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

        return (await response.json()) as SpotifyGetTokenResponse;
    }

    static async refreshToken(refreshToken: string, clientId: string) {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);
        params.append('client_id', clientId);

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        return (await response.json()) as SpotifyRefreshTokenResponse;
    }

    static async getCurrentlyPlaying(accessToken: string) {
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (response.status === 204) {
            return null;
        }

        return (await response.json()) as SpotifyGetCurrentlyPlayingResponse;
    }
}
