import * as vscode from 'vscode';
import { WebviewPanel } from 'vscode';
import * as crypto from 'crypto';
import { SpotifyWebApi } from './api/SpotifyWebApi';
import * as http from 'http';
import { IncomingMessage } from 'node:http';
import { SpotifyPreAuthState } from './SpotifyPreAuthState';
import { SpotifyAuthState } from './SpotifyAuthState';
import { clearTimeout } from 'node:timers';
import { SpotifyCurrentPlayingState } from './SpotifyCurrentPlayingState';
import TreeMap from 'ts-treemap';
import { LyricsEntry } from './LyricsEntry';
import { generateTextColor, getAccentColorFromUrl } from './ColorUtil';
import path from 'node:path';
import LRUCache from 'lru-cache';
import { LRCLibLyricsProvider } from './provider/LRCLibLyricsProvider';
import { LyricsProvider } from './provider/LyricsProvider';

let panel: WebviewPanel | undefined;

let preAuthState: SpotifyPreAuthState | null;
let authState: SpotifyAuthState | null;
let currentPlayingState: SpotifyCurrentPlayingState | undefined;
let tracksCache: LRUCache<string, SpotifyCurrentPlayingState>;

let server: http.Server | null;
let pollingTimeout: NodeJS.Timeout | null;

const provider: LyricsProvider = new LRCLibLyricsProvider();

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('spotilyrics.lyrics', async () => {
            if (panel) {
                panel.reveal(vscode.ViewColumn.Two);
                return;
            } else {
                panel = vscode.window.createWebviewPanel(
                    'lyrics',
                    'Spotify Lyrics',
                    vscode.ViewColumn.Two,
                    {
                        enableScripts: true,
                        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
                    }
                );
                panel.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
                const tracksCacheMaxSize: number = Number(
                    vscode.workspace.getConfiguration('spotilyrics').get('tracksCacheMaxSize')
                );
                if (tracksCacheMaxSize) {
                    tracksCache = new LRUCache({
                        maxSize: tracksCacheMaxSize,
                        sizeCalculation: () => 1,
                    });
                } else {
                    tracksCache = new LRUCache({ maxSize: 10, sizeCalculation: () => 1 });
                }
            }
            await authorize(context);
            if (!authState) {
                await createServer(context);
            }
            await printFrame(context);

            panel.webview.onDidReceiveMessage(async (message) => {
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
                        `http://127.0.0.1:${vscode.workspace.getConfiguration('spotilyrics').get('port')}/callback`
                    );

                    vscode.env.openExternal(
                        vscode.Uri.parse(
                            await SpotifyWebApi.getAuthUrl(
                                vscode.workspace.getConfiguration('spotilyrics').get('port')!,
                                clientId,
                                codeChallenge
                            )
                        )
                    );
                }
            });
            panel.onDidChangeViewState(async (e) => {
                if (!e.webviewPanel.visible) {
                    currentPlayingState = undefined;
                }
            });
            panel.onDidDispose((e) => {
                panel = undefined;
                deactivate();
            });
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('spotilyrics.logout', async () => {
            context.secrets.delete('clientId');
            context.secrets.delete('accessToken');
            context.secrets.delete('refreshToken');
            context.secrets.delete('expiresIn');
            await deactivate();
            if (panel) {
                await createServer(context);
                await printFrame(context);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('spotilyrics.setTracksCacheMaxSize', async () => {
            const MIN = 1,
                MAX = Number.MAX_SAFE_INTEGER,
                DEFAULT = 10;
            const input = await vscode.window.showInputBox({
                prompt: `Maximum tracks cache size. Enter an integer ${MIN}–${MAX}`,
                value: String(DEFAULT),
                validateInput: (v) => {
                    if (!/^\d+$/.test(v)) {
                        return 'Please enter an integer';
                    }
                    const n = Number(v);
                    if (n < MIN) {
                        return `Minimum is ${MIN}`;
                    }
                    if (n > MAX) {
                        return `Maximum is ${MAX}`;
                    }
                    return null;
                },
                ignoreFocusOut: true,
            });
            if (!input) {
                return;
            }
            const value = Math.max(MIN, Math.min(MAX, parseInt(input, 10)));
            await vscode.workspace
                .getConfiguration('spotilyrics')
                .update('tracksCacheMaxSize', value, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Maximum tracks cache size set to ${value}`);
            tracksCache = new LRUCache({ maxSize: value, sizeCalculation: () => 1 });
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('spotilyrics.toggleMobileMode', async () => {
            const config = vscode.workspace.getConfiguration('spotilyrics');
            const currentValue = config.get<boolean>('mobileMode') ?? false;
            const newValue = !currentValue;
            await config.update('mobileMode', newValue, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(
                `Mobile mode ${newValue ? 'enabled' : 'disabled'}`
            );
            if (panel && currentPlayingState) {
                await updateLyrics();
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('spotilyrics.setPort', async () => {
            const MIN = 1024,
                MAX = 65535,
                DEFAULT = 8000;
            const config = vscode.workspace.getConfiguration('spotilyrics');
            const input = await vscode.window.showInputBox({
                prompt: `Port used for the Spotify OAuth callback. Enter an integer ${MIN}–${MAX}`,
                value: String(config.get<number>('port') ?? DEFAULT),
                validateInput: (v) => {
                    if (!/^\d+$/.test(v)) {
                        return 'Please enter an integer';
                    }
                    const n = Number(v);
                    if (n < MIN) {
                        return `Minimum is ${MIN}`;
                    }
                    if (n > MAX) {
                        return `Maximum is ${MAX}`;
                    }
                    return null;
                },
                ignoreFocusOut: true,
            });
            if (!input) {
                return;
            }
            const value = Math.max(MIN, Math.min(MAX, parseInt(input, 10)));
            await config.update('port', value, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Spotify OAuth callback port set to ${value}`);
            if (panel) {
                await deactivate();
                await createServer(context);
                await printFrame(context);
            }
        })
    );
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
    const html = (
        await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(context.extensionUri, 'media', htmlName)
        )
    ).toString();
    if (panel) {
        const cssUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'media', cssName)
        );
        const scriptUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'media', scriptName)
        );
        const port = vscode.workspace.getConfiguration('spotilyrics').get<number>('port') ?? 8000;
        panel.webview.html = html
            .replace('{{PORT}}', String(port))
            .replace('styles.css', cssUri.toString())
            .replace('script.js', scriptUri.toString());
    }
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
                const response = await SpotifyWebApi.getToken(
                    preAuthState.clientId,
                    preAuthState.codeVerifier,
                    preAuthState.redirectUri,
                    code,
                    preAuthState.grantType
                );

                const expiresIn = Date.now() + response.expires_in * 1000;

                context.secrets.store('clientId', preAuthState.clientId);
                context.secrets.store('accessToken', response.access_token);
                context.secrets.store('refreshToken', response.refresh_token);
                context.secrets.store('expiresIn', String(expiresIn));

                authState = new SpotifyAuthState(
                    preAuthState.clientId,
                    response.access_token,
                    response.refresh_token,
                    expiresIn
                );
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
    server.listen(vscode.workspace.getConfiguration('spotilyrics').get('port'));
}

async function pollSpotifyStat(context: vscode.ExtensionContext) {
    try {
        if (authState) {
            if (authState.expiresIn <= Date.now()) {
                const response = await SpotifyWebApi.refreshToken(
                    authState.refreshToken,
                    authState.clientId
                );

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
        vscode.window.showErrorMessage(`pollSpotifyStat error: ${err}`);
    }
}

async function updateLyrics() {
    if (authState) {
        const mobileMode: boolean =
            vscode.workspace.getConfiguration('spotilyrics').get('mobileMode') ?? false;
        const currentlyPlayingResponse = await SpotifyWebApi.getCurrentlyPlaying(
            authState.accessToken
        );
        if (!currentlyPlayingResponse) {
            currentPlayingState = undefined;
            if (panel) {
                panel.webview.postMessage({ command: 'clearLyrics', color: '#333333' });
            }
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
        if (
            !currentPlayingState ||
            currentPlayingState.authors !== artists ||
            currentPlayingState.name !== trackName
        ) {
            const trackCache: SpotifyCurrentPlayingState | undefined = tracksCache.get(
                makeTrackKey(trackName, artists)
            );
            if (trackCache) {
                currentPlayingState = trackCache;
                if (panel) {
                    if (!trackCache.synchronizedLyricsMap) {
                        panel.webview.postMessage({
                            command: 'addLyrics',
                            lyrics: trackCache.plainLyricsStrs,
                            color: trackCache.coverColor,
                            textColor: '#' + trackCache.textColor,
                            mobileMode: mobileMode,
                        });
                    } else if (trackCache.synchronizedLyricsMap) {
                        panel.webview.postMessage({
                            command: 'addLyrics',
                            lyrics: trackCache.synchronizedLyricsStrs,
                            color: trackCache.coverColor,
                            textColor: '#' + trackCache.textColor,
                            mobileMode: mobileMode,
                        });
                    }
                }
            }
        }
        if (
            !currentPlayingState ||
            currentPlayingState.authors !== artists ||
            currentPlayingState.name !== trackName
        ) {
            const lyricsResult = await provider.getLyrics(
                trackName,
                artists,
                albumName,
                durationInS
            );
            if (lyricsResult && !lyricsResult.instrumental) {
                const currentlyPlayingPoll = new SpotifyCurrentPlayingState(trackName, artists);
                if (lyricsResult.plainLyrics) {
                    const plainLyricsStrs: string[] = lyricsResult.plainLyrics
                        .split(/\n/)
                        .map((s) => s.trim())
                        .filter((s) => s !== '')
                        .map((line) => line + '\n');

                    currentlyPlayingPoll.plainLyricsStrs = plainLyricsStrs;
                }
                // load synchronized lyrics in treemap
                if (lyricsResult.syncedLyrics) {
                    const synchronizedLyricsMap = new TreeMap<number, LyricsEntry>();
                    const synchronizedLyricsStrs: string[] = lyricsResult.syncedLyrics
                        .split(/(?=\[\d{2}:\d{2}\.\d{2}\])/)
                        .filter((s) => s.trim() !== '');
                    let id: number = 0;
                    for (const lyricsStr of synchronizedLyricsStrs) {
                        const match = lyricsStr.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)/);
                        if (match) {
                            const minutes = parseInt(match[1], 10);
                            const seconds = parseInt(match[2], 10);
                            const hundredths = parseInt(match[3], 10);
                            const text = match[4];

                            const timeMs = minutes * 60 * 1000 + seconds * 1000 + hundredths * 10;

                            synchronizedLyricsMap.set(timeMs, { id: id, text: text });
                            id++;
                        }
                    }
                    currentlyPlayingPoll.synchronizedLyricsMap = synchronizedLyricsMap;
                }
                currentPlayingState = currentlyPlayingPoll;
                const coverColor: string = await getAccentColorFromUrl(albumImages[0].url);
                currentPlayingState.coverColor = coverColor;
                currentPlayingState.textColor = generateTextColor(currentPlayingState.coverColor);
                tracksCache.set(
                    makeTrackKey(currentPlayingState.name, currentPlayingState.authors),
                    currentPlayingState
                );
                if (!currentPlayingState.synchronizedLyricsMap) {
                    if (panel) {
                        panel.webview.postMessage({
                            command: 'addLyrics',
                            lyrics: currentPlayingState.plainLyricsStrs,
                            color: currentPlayingState.coverColor,
                            textColor: '#' + currentPlayingState.textColor,
                            mobileMode: mobileMode,
                        });
                    }
                } else {
                    const synchronizedLyricsStrs: object[] = [];
                    for (const entry of currentPlayingState.synchronizedLyricsMap) {
                        synchronizedLyricsStrs.push({
                            id: entry[1].id,
                            text: entry[1].text,
                            pick: -1,
                        });
                    }
                    currentPlayingState.synchronizedLyricsStrs = synchronizedLyricsStrs;
                    if (panel) {
                        panel.webview.postMessage({
                            command: 'addLyrics',
                            lyrics: currentPlayingState.synchronizedLyricsStrs,
                            color: currentPlayingState.coverColor,
                            textColor: '#' + currentPlayingState.textColor,
                            mobileMode: mobileMode,
                        });
                    }
                }
            } else {
                currentPlayingState = undefined;
                if (panel) {
                    panel.webview.postMessage({ command: 'clearLyrics', color: '#333333' });
                }
            }
        } else {
            if (currentPlayingState.synchronizedLyricsMap) {
                const value = currentPlayingState.synchronizedLyricsMap.floorEntry(
                    currentlyPlayingResponse.progress_ms
                );
                if (value && panel) {
                    const mobileMode: boolean =
                        vscode.workspace.getConfiguration('spotilyrics').get('mobileMode') ?? false;
                    panel.webview.postMessage({
                        command: 'pickLyrics',
                        pick: value[1].id,
                        color: currentPlayingState.coverColor,
                        textColor: '#' + currentPlayingState.textColor,
                        mobileMode: mobileMode,
                    });
                }
            }
        }
    }
}

function makeTrackKey(name: string, artists: string): string {
    return `${name}__${artists}`;
}

async function authorize(context: vscode.ExtensionContext) {
    const clientId = await context.secrets.get('clientId');
    const accessToken = await context.secrets.get('accessToken');
    const refreshToken = await context.secrets.get('refreshToken');
    const expiresInStr = await context.secrets.get('expiresIn');

    if (clientId && accessToken && refreshToken && expiresInStr) {
        authState = new SpotifyAuthState(clientId, accessToken, refreshToken, Number(expiresInStr));

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
