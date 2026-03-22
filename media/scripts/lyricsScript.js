const vscode = acquireVsCodeApi();
let lastLyricsHash = '';
let lastPickId = null;
let mobileMode = false;
let autoFollowActiveLine = true;
let suppressScrollHandling = false;
let suppressScrollHandlingTimeout = null;
let currentActiveLine = null;
let scrollTicking = false;
let scrollIdleTimeout = null;

let lyricsNotFound = [
    "Looks like we don't have the lyrics for this song yet.",
    "Looks like we don't have the lyrics for this song.",
    "Hmm. We don't know the lyrics for this one.",
    "You'll have to guess the lyrics for this one.",
];

function getRandomForLyricsNotFound() {
    const randomIndex = Math.floor(Math.random() * lyricsNotFound.length);
    return lyricsNotFound[randomIndex];
}

document.querySelector('.placeholder').textContent = getRandomForLyricsNotFound();
const syncButton = document.querySelector('.sync-button');

window.addEventListener(
    'scroll',
    () => {
        if (scrollTicking) {
            return;
        }
        scrollTicking = true;
        window.requestAnimationFrame(() => {
            scrollTicking = false;
            handleScrollState();
        });
    },
    { passive: true }
);

syncButton.addEventListener('click', () => {
    enableAutoFollow(true);
});

window.addEventListener('message', (event) => {
    const { command, lyrics, pick, color, textColor, mobileMode: mobileModeFlag } = event.data;
    const body = document.body;
    if (color && body.style.backgroundColor !== color) {
        body.style.backgroundColor = color;
    }
    if (mobileModeFlag !== undefined) {
        mobileMode = mobileModeFlag;
    }
    if (command === 'addLyrics') {
        const lyricsHash = JSON.stringify(lyrics);
        const isSynced = lyrics.length > 0 && typeof lyrics[0] !== 'string';
        if (lyricsHash !== lastLyricsHash) {
            renderLyrics(lyrics, textColor);
            lastLyricsHash = lyricsHash;
        }
        if (isSynced) {
            pickLyrics(pick, textColor);
        }
    } else if (command === 'clearLyrics') {
        clearLyrics();
    } else if (command === 'pickLyrics') {
        pickLyrics(pick, textColor);
    }
});

function renderLyrics(lyrics, textColor) {
    const box = document.querySelector('.box');
    box.innerHTML = '';
    currentActiveLine = null;
    autoFollowActiveLine = true;
    setSyncButtonVisibility(false);

    const allStrings = lyrics.every((item) => typeof item === 'string');
    if (allStrings) {
        const note = document.createElement('div');
        note.className = 'lyrics-note';
        note.style.color = textColor;
        note.textContent = "These lyrics aren't synced to the song yet.";
        box.appendChild(note);
        lyrics.forEach((text) => {
            const div = document.createElement('div');
            div.className = 'line current';
            div.style.opacity = '1';
            div.textContent = text;
            box.appendChild(div);
        });
    } else {
        lyrics.forEach((line) => {
            const div = document.createElement('div');
            if (mobileMode) {
                div.style.color = '#000000';
            } else {
                div.style.color = textColor;
            }
            div.className = 'line future';
            div.textContent = line.text || '♪';
            div.dataset.lyricsId = line.id;
            div.addEventListener('click', () => {
                autoFollowActiveLine = true;
                setSyncButtonVisibility(false);
                vscode.postMessage({
                    command: 'seekToPosition',
                    timeMs: line.timeMs,
                });
            });
            box.appendChild(div);
        });
    }
    scrollToTop();
}

function clearLyrics() {
    const placeholder = document.querySelector('.placeholder');
    if (placeholder) {
        return;
    }
    const box = document.querySelector('.box');
    box.innerHTML = `<div class="placeholder">${getRandomForLyricsNotFound()}</div>`;
    lastLyricsHash = '';
    lastPickId = null;
    currentActiveLine = null;
    autoFollowActiveLine = true;
    setSyncButtonVisibility(false);
}

function pickLyrics(id, textColor) {
    if (id === lastPickId) {
        return;
    }
    lastPickId = id;
    const lines = Array.from(document.querySelectorAll('.line'));
    if (!lines.length) {
        return;
    }
    let pickedIndex;
    if (id === -1) {
        pickedIndex = -1;
    } else {
        pickedIndex = lines.findIndex((line) => line.dataset.lyricsId === String(id));
    }

    currentActiveLine = pickedIndex >= 0 ? lines[pickedIndex] : null;

    lines.forEach((line, index) => {
        line.classList.remove('past', 'current', 'future');

        if (mobileMode) {
            if (index <= pickedIndex) {
                line.classList.add('current');
                line.style.color = '#ffffff';
                line.style.opacity = '1';
            } else {
                line.classList.add('future');
                line.style.color = '#000000';
                line.style.opacity = '1';
            }
        } else {
            if (index < pickedIndex) {
                line.classList.add('past');
                line.style.color = textColor;
                line.style.opacity = '';
            } else if (index === pickedIndex) {
                line.classList.add('current');
                line.style.color = 'white';
                line.style.opacity = '';
            } else {
                line.classList.add('future');
                line.style.color = textColor;
                line.style.opacity = '';
            }
        }
    });
    if (pickedIndex === -1) {
        if (autoFollowActiveLine) {
            scrollToTop();
        }
        setSyncButtonVisibility(false);
        return;
    }
    if (autoFollowActiveLine) {
        scrollLineIntoSyncZone(lines[pickedIndex]);
        return;
    }
    updateManualSyncState();
}

function handleScrollState() {
    if (suppressScrollHandling) {
        return;
    }
    if (!currentActiveLine) {
        setSyncButtonVisibility(false);
        return;
    }
    if (autoFollowActiveLine) {
        autoFollowActiveLine = false;
    }
    if (scrollIdleTimeout) {
        window.clearTimeout(scrollIdleTimeout);
    }
    updateManualSyncState();
    scrollIdleTimeout = window.setTimeout(() => {
        scrollIdleTimeout = null;
        updateManualSyncState();
    }, 120);
}

function updateManualSyncState() {
    if (!currentActiveLine) {
        setSyncButtonVisibility(false);
        return;
    }
    const metrics = getLineViewportMetrics(currentActiveLine);
    if (!metrics) {
        setSyncButtonVisibility(false);
        return;
    }
    if (isWithinSyncZone(metrics)) {
        enableAutoFollow(false);
        return;
    }
    const shouldShowButton = !metrics.isVisible;
    setSyncButtonVisibility(shouldShowButton, metrics.visibilityRatio);
}

function getLineViewportMetrics(line) {
    if (!line || !document.body.contains(line)) {
        return null;
    }
    const rect = line.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportHeight || !rect.height) {
        return {
            rect,
            viewportHeight,
            visibilityRatio: 0,
            isVisible: false,
            lineCenter: 0,
        };
    }
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const clampedVisibleHeight = Math.max(0, Math.min(visibleHeight, rect.height));
    const visibilityRatio = clampedVisibleHeight / rect.height;
    return {
        rect,
        viewportHeight,
        visibilityRatio,
        isVisible: visibilityRatio > 0,
        lineCenter: rect.top + rect.height / 2,
    };
}

function isWithinSyncZone(metrics) {
    const viewportCenter = metrics.viewportHeight / 2;
    const syncWindow = Math.max(40, metrics.viewportHeight * 0.08);
    const distanceToCenter = Math.abs(metrics.lineCenter - viewportCenter);
    return metrics.visibilityRatio > 0.55 && distanceToCenter <= syncWindow;
}

function enableAutoFollow(shouldAnimate) {
    autoFollowActiveLine = true;
    setSyncButtonVisibility(false);
    if (!currentActiveLine) {
        if (shouldAnimate) {
            scrollToTop();
        }
        return;
    }
    scrollLineIntoSyncZone(currentActiveLine, shouldAnimate);
}

function scrollLineIntoSyncZone(line, shouldAnimate = true) {
    if (!line) {
        return;
    }
    const metrics = getLineViewportMetrics(line);
    if (metrics && isWithinSyncZone(metrics)) {
        setSyncButtonVisibility(false);
        return;
    }
    suppressNextScrollHandling(450);
    line.scrollIntoView({
        behavior: shouldAnimate ? 'smooth' : 'auto',
        block: 'center',
    });
}

function scrollToTop() {
    suppressNextScrollHandling(350);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function suppressNextScrollHandling(durationMs) {
    suppressScrollHandling = true;
    if (suppressScrollHandlingTimeout) {
        window.clearTimeout(suppressScrollHandlingTimeout);
    }
    suppressScrollHandlingTimeout = window.setTimeout(() => {
        suppressScrollHandling = false;
        suppressScrollHandlingTimeout = null;
        if (!autoFollowActiveLine) {
            updateManualSyncState();
        }
    }, durationMs);
}

function setSyncButtonVisibility(visible, visibilityRatio = 0) {
    if (!syncButton) {
        return;
    }
    if (!visible) {
        syncButton.classList.remove('visible');
        syncButton.style.opacity = '';
        window.setTimeout(() => {
            if (!syncButton.classList.contains('visible')) {
                syncButton.hidden = true;
            }
        }, 180);
        return;
    }
    syncButton.hidden = false;
    const opacity = Math.max(0.28, 1 - Math.min(visibilityRatio, 1));
    syncButton.style.opacity = String(opacity);
    syncButton.classList.add('visible');
}
