import * as vscode from 'vscode';
import {WebviewPanel} from 'vscode';
import * as crypto from 'crypto';
import {SpotifyWebApi} from './api/SpotifyWebApi';
import * as http from 'http';
import {IncomingMessage} from 'node:http';
import {SpotifyPreAuthState} from './SpotifyPreAuthState';
import {SpotifyAuthState} from './SpotifyAuthState';
import {clearTimeout} from 'node:timers';
import {SpotifyCurrentPlayingState} from './SpotifyCurrentPlayingState';
import {LRCLibSearchResponse} from './api/response/LRCLibGetResponse';
import {LRCLibApi} from './api/LRCLibApi';
import TreeMap from 'ts-treemap';
import {LyricsEntry} from './LyricsEntry';
import {getAccentColorFromUrl} from "./ColorUtil";

let panel: WebviewPanel;

let preAuthState: SpotifyPreAuthState | null;
let authState: SpotifyAuthState | null;
let currentPlayingState: SpotifyCurrentPlayingState | undefined;

let server: http.Server | null;
let pollingTimeout: NodeJS.Timeout | null;

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('spotilyrics.lyrics', async () => {
        panel = vscode.window.createWebviewPanel(
            'lyrics',
            'Spotify Lyrics',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
            }
        );

        await authorize(context);
        if (!authState) {
            await createServer(context);
        }
        await printFrame(context);

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'signInClicked') {
                const clientId = message.message;

                const codeVerifier = generateCodeVerifier();
                const sha256 = crypto.createHash('sha256').update(codeVerifier).digest();
                const codeChallenge = sha256
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');

                preAuthState = new SpotifyPreAuthState(
                    clientId,
                    codeVerifier,
                    codeChallenge,
                    'authorization_code',
                'http://127.0.0.1:8000/callback'
                );

                vscode.env.openExternal(vscode.Uri.parse(await SpotifyWebApi.getAuthUrl(clientId, codeChallenge)));
            }
        });

        panel.onDidChangeViewState(e => {
            if (!e.webviewPanel.visible) {
                currentPlayingState = undefined;
            }
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('spotilyrics.logout', async () => {
        context.secrets.delete('clientId');
        context.secrets.delete('accessToken');
        context.secrets.delete('refreshToken');
        context.secrets.delete('expiresIn');
        await deactivate();
        await createServer(context);
        await printFrame(context);
    }));
}

export async function deactivate() {
    if (pollingTimeout) {
        clearTimeout(pollingTimeout);
        pollingTimeout = null;
    }
    if (server) {
        server.close();
        server = null;
    }
    authState = null;
    preAuthState = null;
    currentPlayingState = undefined;
}

async function printFrame(context: vscode.ExtensionContext) {
    let htmlName;
    let cssName;
    let scriptName;
    if (!authState) {
        htmlName = 'signInTemplate.html';
        cssName = './styles/signInStyle.css';
        scriptName = './scripts/signInScript.js';
    } else {
        htmlName = 'lyricsTemplate.html';
        cssName = './styles/lyricsStyle.css';
        scriptName = './scripts/lyricsScript.js';
    }
    const html = (await vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, 'media', htmlName)))
        .toString();
    const cssUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'media', cssName)
    );
    const scriptUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'media', scriptName)
    );
    panel.webview.html = html.replace('styles.css', cssUri.toString()).replace('script.js', scriptUri.toString());
}

function generateCodeVerifier(length = 49) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let verifier = '';
    for (let i = 0; i < length; i++) {
        verifier += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return verifier;
}

async function createServer(context: vscode.ExtensionContext) {
    server = http.createServer(async (req: IncomingMessage, res: InstanceType<any>) => {
        const rawUrl = req.url ?? '/';
        const parsedUrl = new URL(rawUrl, 'http://localhost');

        if (parsedUrl.pathname === '/callback') {
            const code = parsedUrl.searchParams.get('code');

            if (code && preAuthState) {
                const response = await SpotifyWebApi.getToken(preAuthState.clientId, preAuthState.codeVerifier,
                    preAuthState.redirectUri, code, preAuthState.grantType);

                const expiresIn = Date.now() + response.expires_in * 1000;

                context.secrets.store('clientId', preAuthState.clientId);
                context.secrets.store('accessToken', response.access_token);
                context.secrets.store('refreshToken', response.refresh_token);
                context.secrets.store('expiresIn', String(expiresIn));

                authState = new SpotifyAuthState(preAuthState.clientId, response.access_token, response.refresh_token, expiresIn);
                preAuthState = null;

                await printFrame(context);

                if (!pollingTimeout) {
                    const loop = async () => {
                        try {
                            await pollSpotifyStat(context);
                        } finally {
                            pollingTimeout = setTimeout(loop, 300);
                        }
                    };
                    loop();
                }

                vscode.window.showInformationMessage(`You have successfully signed in`);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Authorization code received! You can close this page.');

                if (server) {
                    server.close();
                    server = null;
                }

            } else {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Missing code query parameter');
            }
        } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not Found');
        }
    });
    server.listen(8000);
}

async function pollSpotifyStat(context: vscode.ExtensionContext) {
    try {
        if (authState) {
            if (authState.expiresIn <= Date.now()) {
                const response = await SpotifyWebApi.refreshToken(authState.refreshToken, authState.clientId);

                const expiresIn = Date.now() + response.expires_in * 1000;

                context.secrets.store('accessToken', response.access_token);
                context.secrets.store('refreshToken', response.refresh_token);
                context.secrets.store('expiresIn', String(expiresIn));

                authState.refreshToken = response.refresh_token;
                authState.accessToken = response.access_token;
                authState.expiresIn = expiresIn;
            }
            await updateLyrics();
        }
    } catch (err) {
        console.error(`pollSpotifyStat error: ${err}`);
        vscode.window.showErrorMessage(`pollSpotifyStat error: ${err}`)
    }

}

async function updateLyrics() {
    if (authState) {
        const currentlyPlayingResponse = await SpotifyWebApi.getCurrentlyPlaying(authState.accessToken);
        if (!currentlyPlayingResponse) {
            currentPlayingState = undefined;
            panel.webview.postMessage({ command: 'clearLyrics', color: '#333333' });
            return;
        }
        const trackName: string = currentlyPlayingResponse.item.name;
        const albumName: string = currentlyPlayingResponse.item.album.name;
        const artistNames: string[] = [];
        const albumImages = currentlyPlayingResponse.item.album.images;
        const durationInMs: number = currentlyPlayingResponse.item.duration_ms;
        const durationInS: number = Math.floor(durationInMs / 1000);
        for (const artist of currentlyPlayingResponse.item.artists) {
            artistNames.push(artist.name);
        }
        const artists: string = artistNames.join(' ');
        if (!currentPlayingState || currentPlayingState.authors != artists || currentPlayingState.name != trackName) {
            const getLyricsResponse: LRCLibSearchResponse = await LRCLibApi.get(trackName, artists, albumName, durationInS);
            if (!getLyricsResponse.statusCode && !getLyricsResponse.instrumental) {
                const currentlyPlayingPoll = new SpotifyCurrentPlayingState(
                    trackName,
                    artists
                );
                if (getLyricsResponse.plainLyrics) {
                    const plainLyricsStrs: string[] = getLyricsResponse.plainLyrics
                        .split(/\n/).map(s => s.trim()).filter(s => s !== '')
                        .map(line => line + '\n');

                    currentlyPlayingPoll.plainLyricsStrs = plainLyricsStrs;
                }
                // load synchronized lyrics in treemap
                if (getLyricsResponse.syncedLyrics) {
                    const synchronizedLyricsMap = new TreeMap<number, LyricsEntry>();
                    const synchronizedLyricsStrs: string[] = getLyricsResponse.syncedLyrics.split(/(?=\[\d{2}:\d{2}\.\d{2}\])/).filter(s => s.trim() !== '');
                    let id: number = 0;
                    for (const lyricsStr of synchronizedLyricsStrs) {
                        const match = lyricsStr.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)/);
                        if (match) {
                            const minutes = parseInt(match[1], 10);
                            const seconds = parseInt(match[2], 10);
                            const hundredths = parseInt(match[3], 10);
                            const text = match[4];

                            const timeMs = minutes * 60 * 1000 + seconds * 1000 + hundredths * 10;

                            synchronizedLyricsMap.set(timeMs, {id: id, text: text});
                            id++;
                        }
                    }
                    currentlyPlayingPoll.synchronizedLyricsMap = synchronizedLyricsMap;
                }
                currentPlayingState = currentlyPlayingPoll
                if (!currentPlayingState.synchronizedLyricsMap) {
                    panel.webview.postMessage({ command: 'addLyrics', lyrics: currentPlayingState.plainLyricsStrs, color: await getAccentColorFromUrl(albumImages[0].url) });
                } else {
                    const value = currentPlayingState.synchronizedLyricsMap.floorEntry(currentlyPlayingResponse.progress_ms);
                    let pick: number = -1;
                    if (value) {
                        pick = value[1].id;
                    }
                    const synchronizedLyricsStrs: object[] = [];
                    for (const entry of currentPlayingState.synchronizedLyricsMap) {
                        synchronizedLyricsStrs.push({ id: entry[1].id, text: entry[1].text, pick: pick });
                    }
                    panel.webview.postMessage({ command: 'addLyrics', lyrics: synchronizedLyricsStrs, color: await getAccentColorFromUrl(albumImages[0].url) });
                }
            } else {
                currentPlayingState = undefined;
                panel.webview.postMessage({ command: 'clearLyrics', color: '#333333' });
            }
        } else {
            if (currentPlayingState.synchronizedLyricsMap) {
                const value = currentPlayingState.synchronizedLyricsMap.floorEntry(currentlyPlayingResponse.progress_ms);
                if (value) {
                    panel.webview.postMessage({ command: 'pickLyrics', pick: value[1].id });
                }
            }
        }
    }
}

async function authorize(context: vscode.ExtensionContext) {
    const clientId = await context.secrets.get('clientId');
    const accessToken = await context.secrets.get('accessToken');
    const refreshToken = await context.secrets.get('refreshToken');
    const expiresInStr = await context.secrets.get('expiresIn');

    if (clientId && accessToken && refreshToken && expiresInStr) {
        authState = new SpotifyAuthState(
            clientId,
            accessToken,
            refreshToken,
            Number(expiresInStr)
        );

        if (!pollingTimeout) {
            const loop = async () => {
                try {
                    await pollSpotifyStat(context);
                } finally {
                    pollingTimeout = setTimeout(loop, 300);
                }
            };
            loop();
        }
    }
}