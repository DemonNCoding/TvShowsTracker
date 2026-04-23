# TV Shows Tracker

A Chrome Extension for tracking TV shows and episodes. Clean dark-themed interface powered by the TVMaze API — no account or API key required.


<img width="1774" height="970" alt="tv shows tracker" src="https://github.com/user-attachments/assets/54ef8345-981f-48b3-b9c5-64354052e6f3" />


## Features

- Search and add shows from the TVMaze database
- Track progress by season and episode
- Three status tabs: Watching, Waiting, Completed
- Next episode air dates with streaming availability offset
- Genre filtering, multiple view modes (Grid, Compact, List), and sort options
- Custom watch link per show
- Stats dashboard (shows, episodes, estimated hours)
- Export / import data as JSON
- Auto-updates show data once per day on first open
- 5-minute cooldown on manual "Update All Shows" to respect the TVMaze API

## Tech Stack

- **Platform:** Chrome Extension (Manifest V3)
- **Frontend:** Vanilla HTML, CSS, JavaScript (ES6+) — no build step
- **Storage:** `chrome.storage.local`
- **API:** [TVMaze](https://api.tvmaze.com) (free, no key needed)

## Project Structure

```
├── manifest.json   # Extension metadata and permissions
├── background.js   # Service worker — opens the UI on icon click
├── index.html      # Single-page UI with embedded styles
├── app.js          # All application logic
└── icon-*.png      # Extension icons (16, 48, 128px)
```

## Data Model

```javascript
// Show object (stored in chrome.storage.local under "tvShows")
{
  id: Number,
  name: String,
  image: String,
  currentSeason: Number,
  currentEpisode: Number,
  status: 'watching' | 'waiting' | 'completed',
  premiered: String,
  genres: Array<String>,
  network: String,
  episodeData: Object,       // { season: [episodes] }
  allEpisodes: Array,
  bookmarkUrl: String,
  showStatus: String,        // 'Running' | 'Ended'
  rating: Number,
  airDayOffset: Number,
  lastUpdated: Number
}
```

Settings are stored separately under `trackerSettings` (sort, active tab, view, genre filter).

## Local Development

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

No build step — edit files and reload the extension to see changes.

## Notes

- TVMaze API is free but rate-limited. The extension batches update requests (5 shows at a time) with a 500ms delay between batches.
- All data is stored locally. There is no server or sync component.
- Compatible with Chrome/Edge 88+ (Manifest V3). Not compatible with Firefox without a Manifest V2 port.
