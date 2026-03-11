<div align="center">
  <br/>
  <img src="logo.png" width="350" alt="Spotilyrics logo"/>
  <p><i>See synchronized Spotify lyrics inside VS Code while coding.</i></p>
<p>
  <a href="https://marketplace.visualstudio.com/items?itemName=therepanic.spotilyrics"><img src="https://img.shields.io/badge/VS%20Code-Extension-blue?style=flat&logo=visualstudiocode" /></a>
  <a href="https://developer.spotify.com/documentation/web-api"><img src="https://img.shields.io/badge/Spotify-API-1DB954?style=flat&logo=spotify" /></a>
  <a href="https://lrclib.net"><img src="https://img.shields.io/badge/Lyrics-LRClib-orange?style=flat" /></a>
  <a href="https://news.ycombinator.com/item?id=45087905"><img src="https://img.shields.io/badge/Hacker%20News-Discuss-orange?style=flat&logo=ycombinator" /></a>
  <a href="https://unlicense.org/"><img src="https://img.shields.io/badge/License-Unlicensed-red?style=flat" /></a>
</p>
</div>

---

> [!WARNING]
> Due to [Spotify API changes in February 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), **Spotify Premium is now required** to use this extension. Starting from February 11, 2026, Spotify requires Premium for app owners using Development Mode. Sorry for the inconvenience.

## ✨ Features

- 📌 **Live lyrics sync** with your Spotify playback.
- 🎨 Lyrics colors auto-themed from album cover (via `colorthief`).
- 🖥️ Smooth **side panel view** – code on the left, lyrics on the right.
- 🖱️ **Click-to-seek** – click on any lyric line to jump to that moment in the track (like Spotify app).
- 📱 **Mobile mode** – black unplayed lines, white played lines (like Spotify mobile app).
- 🔑 Simple **one-time login** using your own Spotify Client ID.
- 🚪 Quick logout command to reset session.
- ⚡ Set a **maximum tracks cache size** for lyrics syncing.

---

## 📸 Demo

## <img src="demo.png"/>

## ⚡️ Installation

1. Open **VS Code** → Extensions → search `spotilyrics` or [install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=therepanic.spotilyrics).

2. Run the command:

```
Show Spotify Lyrics via Spotilyrics
```

---

## 🔑 Authentication (one-time setup)

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create an app → copy **Client ID**.
3. **Important:** set the **Redirect URI** for your app to: `http://127.0.0.1:<port>/callback` (default: `8000`).  
   You can change the port in settings (`spotilyrics.port`) or via the command `Set Spotify OAuth Callback Port`.
4. Run the `Show Spotify Lyrics via Spotilyrics` command.
5. Paste your **Client ID** in the panel and log in.
6. Enjoy synced lyrics while coding! 🎶

> ℹ️ Why? – To respect Spotify API rate limits, you need your own ID.

---

## ⌨️ Commands

- `Show Spotify Lyrics via Spotilyrics` (`spotilyrics.lyrics`) – open synced lyrics panel.
- `Toggle Mobile Mode` (`spotilyrics.toggleMobileMode`) – switch between normal and mobile mode.
- `Logout from Spotilyrics` (`spotilyrics.logout`) – clear session and re-auth when needed.
- `Set Tracks Cache Max Size` (`spotilyrics.setTracksCacheMaxSize`) – configure the maximum number of tracks cached for lyrics.
- `Set Spotify OAuth Callback Port` (`spotilyrics.setPort`) – set the local callback port used for Spotify OAuth.

---

## ⚙️ Tech stack

- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [LRClib](https://lrclib.net/) for lyrics with timing
- [colorthief](https://lokeshdhakar.com/projects/color-thief/) for cover-based theme
- TypeScript + VS Code WebView

---

## 📜 License

This project is licensed as **Unlicensed**.  
Feel free to use, hack, and remix it – but no warranties 😉

---

<div align="center">
<sub>Made with ❤️ by therepanic. Your code has a soundtrack now.</sub>
</div>
