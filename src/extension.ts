import * as vscode from 'vscode';
import * as crypto from 'crypto';

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

        const htmlUri = vscode.Uri.joinPath(context.extensionUri, 'media', 'logInTemplate.html');
        const bytes = await vscode.workspace.fs.readFile(htmlUri);

        const html = new TextDecoder("utf-8").decode(bytes);

        const cssUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'media', 'styles.css')
        );

        panel.webview.html = html.replace('styles.css', cssUri.toString());

        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'signInClicked') {
                const codeVerifier = message.message;

                const sha256 = crypto.createHash('sha256').update(codeVerifier).digest();
                const codeChallenge = sha256
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');

                vscode.window.showInformationMessage(`Client ID: ${codeChallenge}`);
            }
        });
    });

    context.subscriptions.push(disposable);
}
