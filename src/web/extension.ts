import * as vscode from 'vscode';

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

        const htmlUri = vscode.Uri.joinPath(context.extensionUri, 'media', 'index.html');
        const bytes = await vscode.workspace.fs.readFile(htmlUri);

        // Используем TextDecoder, чтобы получить строку из Uint8Array
        const html = new TextDecoder("utf-8").decode(bytes);

        const cssUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'media', 'styles.css')
        );

        const finalHtml = html.replace('styles.css', cssUri.toString());

        panel.webview.html = finalHtml;
    });

    context.subscriptions.push(disposable);
}
