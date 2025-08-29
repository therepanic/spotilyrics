const vscode = acquireVsCodeApi();

document.getElementById('signInButton')?.addEventListener('click', () => {
    vscode.postMessage({
        command: 'signInClicked',
        message: `${document.getElementById('clientIdInput').value}`,
    });
});
