import * as vscode from 'vscode';
import * as crypto from 'crypto';
import {WebviewPanel} from "vscode";
import {SpotifyWebApi} from "./api/SpotifyWebApi";
import * as http from "http";
import {IncomingMessage} from "node:http";
import {SpotifyPreAuthState} from "./SpotifyPreAuthState";
import {SpotifyAuthState} from "./SpotifyAuthState";
import {clearInterval, setInterval} from "node:timers";

let preAuthState: SpotifyPreAuthState | null;
let authState: SpotifyAuthState | null;

let server: http.Server | null;
let pollingInterval: NodeJS.Timeout | null;

export async function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('spotilyrics.showLyrics', async () => {
        const panel = vscode.window.createWebviewPanel(
            'lyrics',
            'Spotify Lyrics',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
            }
        );

        await authorize(context);
        if (authState == null) {
            await createServer(context, panel);
        }
        await printFrame(context, panel);

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
                    "authorization_code",
                    "http://127.0.0.1:8000/callback"
                );

                vscode.env.openExternal(vscode.Uri.parse(await SpotifyWebApi.getAuthUrl(clientId, codeChallenge)));
            }
        });
    });
    context.subscriptions.push(disposable);
}

export async function deactivate() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    if (server) {
        server.close();
        server = null;
    }
}

async function printFrame(context: vscode.ExtensionContext, panel: WebviewPanel) {
    let htmlName;
    let cssName;
    if (authState === null) {
        htmlName = "signInTemplate.html";
        cssName = "signInStyles.css";
    } else {
        htmlName = "lyricsTemplate.html";
        cssName = "lyricsStyles.css";
    }
    const html = (await vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, 'media', htmlName)))
        .toString();
    const cssUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'media', cssName)
    );
    panel.webview.html = html.replace('styles.css', cssUri.toString());
}

function generateCodeVerifier(length = 49) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let verifier = '';
    for (let i = 0; i < length; i++) {
        verifier += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return verifier;
}

async function createServer(context: vscode.ExtensionContext, panel: WebviewPanel) {
    server = http.createServer(async (req: IncomingMessage, res: InstanceType<any>) => {
        const rawUrl = req.url ?? '/';
        const parsedUrl = new URL(rawUrl, 'http://localhost');

        if (parsedUrl.pathname === '/callback') {
            const code = parsedUrl.searchParams.get('code');

            if (code && preAuthState) {
                const response = await SpotifyWebApi.getToken(preAuthState.clientId, preAuthState.codeVerifier,
                    preAuthState.redirectUri, code, preAuthState.grantType);

                const expiresIn = Date.now() + response.expires_in * 1000;

                context.globalState.update("clientId", preAuthState.clientId);
                context.globalState.update("accessToken", response.access_token);
                context.globalState.update("refreshToken", response.refresh_token);
                context.globalState.update("expiresIn", expiresIn);

                authState = new SpotifyAuthState(preAuthState.clientId, response.access_token, response.refresh_token, expiresIn);
                preAuthState = null;

                await printFrame(context, panel);

                if (!pollingInterval) {
                    pollingInterval = setInterval(() => {
                        pollSpotifyStat(context);
                    }, 1000);
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
    if (authState != null) {
        if (authState.expiresIn <= Date.now()) {
            const response= await SpotifyWebApi.refreshToken(authState.refreshToken, authState.clientId);

            const expiresIn = Date.now() + response.expires_in * 1000;

            context.globalState.update("accessToken", response.access_token);
            context.globalState.update("refreshToken", response.refresh_token);
            context.globalState.update("expiresIn", expiresIn);

            authState.refreshToken = response.refresh_token;
            authState.accessToken = response.access_token;
            authState.expiresIn = expiresIn;
        }
    }
    // TODO: POLL STAT
}

async function authorize(context: vscode.ExtensionContext) {
    const clientId = context.globalState.get<string>("clientId");
    const accessToken = context.globalState.get<string>("accessToken");
    const refreshToken = context.globalState.get<string>("refreshToken");
    const expiresInStr = context.globalState.get<string>("expiresIn");

    if (clientId && accessToken && refreshToken && expiresInStr) {
        authState = new SpotifyAuthState(
            clientId,
            accessToken,
            refreshToken,
            Number(expiresInStr)
        );

        if (!pollingInterval) {
            pollingInterval = setInterval(() => {
                pollSpotifyStat(context);
            }, 1000);
        }
    }
}