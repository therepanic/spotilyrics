import * as vscode from 'vscode';
import * as crypto from 'crypto';
import {WebviewPanel} from "vscode";
import {SpotifyWebApi} from "./api/SpotifyWebApi";
import * as http from "http";
import {IncomingMessage} from "node:http";
import {SpotifyPreAuthState} from "./SpotifyPreAuthState";
import {SpotifyAuthState} from "./SpotifyAuthState";

let preAuthState: SpotifyPreAuthState | null = null;
let authState: SpotifyAuthState | null = null;

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

        await createServer(context, panel);
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
    const server = http.createServer(async (req: IncomingMessage, res: InstanceType<any>) => {
        const rawUrl = req.url ?? '/';
        const parsedUrl = new URL(rawUrl, 'http://localhost');

        if (parsedUrl.pathname === '/callback') {
            const code = parsedUrl.searchParams.get('code');

            if (code && preAuthState) {
                const response = await SpotifyWebApi.getToken(preAuthState.clientId, preAuthState.codeVerifier,
                    preAuthState.redirectUri, code, preAuthState.grantType);

                context.globalState.update("accessToken", response.access_token);
                context.globalState.update("refreshToken", response.refresh_token);
                context.globalState.update("expiresIn", response.expires_in);

                authState = new SpotifyAuthState(response.access_token, response.refresh_token, response.expires_in);
                preAuthState = null;

                await printFrame(context, panel);

                vscode.window.showInformationMessage(`You have successfully signed in`);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Authorization code received! You can close this page.');
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

    context.subscriptions.push({
        dispose: () => server.close()
    });
}
