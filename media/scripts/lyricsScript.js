let lastLyricsHash = '';
let lastPickId = null;

let lyricsNotFound = [
    'Looks like we don’t have the lyrics for this song yet.',
    'Looks like we don’t have the lyrics for this song.',
    "Hmm. We don't know the lyrics for this one.",
    "You'll have to guess the lyrics for this one.",
];

function getRandomForLyricsNotFound() {
    const randomIndex = Math.floor(Math.random() * lyricsNotFound.length);
    return lyricsNotFound[randomIndex];
}

document.querySelector('.placeholder').textContent = getRandomForLyricsNotFound();

window.addEventListener('message', (event) => {
    const { command, lyrics, pick, color, textColor } = event.data;
    const body = document.body;
    if (color && body.style.backgroundColor !== color) {
        body.style.backgroundColor = color;
    }
    if (command === 'addLyrics') {
        const lyricsHash = JSON.stringify(lyrics);
        if (lyricsHash !== lastLyricsHash) {
            renderLyrics(lyrics, textColor);
            lastLyricsHash = lyricsHash;
        }
        pickLyrics(pick, textColor);
    } else if (command === 'clearLyrics') {
        clearLyrics();
    } else if (command === 'pickLyrics') {
        pickLyrics(pick, textColor);
    }
});

function renderLyrics(lyrics, textColor) {
    const box = document.querySelector('.box');
    box.innerHTML = '';

    const allStrings = lyrics.every((item) => typeof item === 'string');
    if (allStrings) {
        const note = document.createElement('div');
        note.className = 'lyrics-note';
        note.style.color = textColor;
        note.textContent = "These lyrics aren't synced to the song yet.";
        box.appendChild(note);
        lyrics.forEach((text) => {
            const div = document.createElement('div');
            div.className = 'line';
            div.style.opacity = '1';
            div.textContent = text;
            box.appendChild(div);
        });
    } else {
        lyrics.forEach((line) => {
            const div = document.createElement('div');
            div.style.color = textColor;
            div.className = 'line future';
            div.textContent = line.text || '♪';
            div.dataset.lyricsId = line.id;
            box.appendChild(div);
        });
    }
    window.scrollTo(0, 0);
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
}

function pickLyrics(id, textColor) {
    if (id === lastPickId) {
        return;
    }
    console.log(textColor);
    lastPickId = id;

    const lines = Array.from(document.querySelectorAll('.line'));
    if (!lines.length) {
        return;
    }

    const pickedIndex = lines.findIndex((line) => line.dataset.lyricsId === String(id));
    if (pickedIndex === -1) {
        return;
    }

    lines.forEach((line, index) => {
        line.classList.remove('past', 'current', 'future');

        if (index < pickedIndex) {
            line.classList.add('past');
            line.style.color = textColor;
        } else if (index === pickedIndex) {
            line.classList.add('current');
            line.style.color = 'white';
        } else {
            line.classList.add('future');
            line.style.color = textColor;
        }
    });

    lines[pickedIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
}
