let shows = [];
let activeTab = 'watching';
let searchResultsData = [];
let pendingShow = null;
let sortBy = 'next';
let activeGenreFilter = null;
let searchQuery = '';
let searchDebounceTimer = null;
let searchAbortController = null;

document.addEventListener('DOMContentLoaded', () => {
  loadShows();
  setupEventListeners();
  initCooldownDisplay();
});

function setupEventListeners() {
  const searchModal = document.getElementById('searchModal');
  const searchTrigger = document.getElementById('searchTrigger');
  const searchInput = document.getElementById('searchInput');
  const settingsModal = document.getElementById('settingsModal');

  searchTrigger.addEventListener('click', () => {
    searchModal.classList.add('active');
    searchInput.focus();
  });

  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      closeSearchModal();
    }
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('active');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchModal.classList.contains('active')) {
        closeSearchModal();
      }
      if (settingsModal.classList.contains('active')) {
        settingsModal.classList.remove('active');
      }
    }
  });

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      const grid = document.getElementById('showsGrid');
      grid.className = `shows-grid ${view}`;
      saveSettings();
    });
  });

  document.getElementById('searchBtn').addEventListener('click', searchShows);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchShows();
  });
  searchInput.addEventListener('input', debouncedSearch);

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    sortBy = e.target.value;
    saveSettings();
    renderShows();
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      saveSettings();
      renderShows();
    });
  });

  document.getElementById('searchResults').addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-show]');
    if (addBtn) {
      const showId = parseInt(addBtn.dataset.showId);
      const show = searchResultsData.find(r => r.show.id === showId);
      if (show) showImportOptions(show.show);
    }

    const confirmBtn = e.target.closest('[data-confirm-import]');
    if (confirmBtn && pendingShow) {
      confirmImport();
    }

    const cancelBtn = e.target.closest('[data-cancel-import]');
    if (cancelBtn) {
      cancelImport();
    }
  });

  document.getElementById('showsGrid').addEventListener('click', (e) => {
    const target = e.target.closest('button, select, a');
    if (!target) return;

    const showId = parseInt(target.dataset.showId);

    if (target.dataset.action === 'prev') {
      changeEpisode(showId, -1);
    } else if (target.dataset.action === 'next') {
      changeEpisode(showId, 1);
    } else if (target.dataset.action === 'toggle') {
      toggleStatus(showId);
    } else if (target.dataset.action === 'delete') {
      deleteShow(showId);
    } else if (target.dataset.action === 'add-bookmark') {
      openBookmarkModal(showId);
    } else if (target.dataset.action === 'settings') {
      openShowSettings(showId);
    } else if (target.dataset.action === 'complete') {
      markAsCompleted(showId);
    }
  });

  document.getElementById('showsGrid').addEventListener('change', (e) => {
    if (e.target.classList.contains('season-select')) {
      const showId = parseInt(e.target.dataset.showId);
      const newSeason = parseInt(e.target.value);
      changeToSeason(showId, newSeason);
    } else if (e.target.classList.contains('episode-select')) {
      const showId = parseInt(e.target.dataset.showId);
      const newEpisode = parseInt(e.target.value);
      changeToEpisode(showId, newEpisode);
    }
  });

  document.getElementById('genreFilter').addEventListener('click', (e) => {
    const tag = e.target.closest('.genre-filter-tag');
    if (tag) {
      const genre = tag.dataset.genre;
      if (activeGenreFilter === genre) {
        activeGenreFilter = null;
      } else {
        activeGenreFilter = genre;
      }
      saveSettings();
      renderGenreFilter();
      renderShows();
    }
  });

  // Local search functionality
  const localSearchInput = document.getElementById('localSearchInput');
  const localSearchClear = document.getElementById('localSearchClear');

  localSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    localSearchClear.classList.toggle('visible', searchQuery.length > 0);
    renderShows();
  });

  localSearchClear.addEventListener('click', () => {
    searchQuery = '';
    localSearchInput.value = '';
    localSearchClear.classList.remove('visible');
    renderShows();
    localSearchInput.focus();
  });

  // Export/Import event listeners
  document.getElementById('exportBtn').addEventListener('click', exportData);
  
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  
  document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importData(file);
    }
    // Reset the input so the same file can be selected again if needed
    e.target.value = '';
  });

  // Update all shows event listener
  document.getElementById('updateAllBtn').addEventListener('click', updateAllShows);
}
function markAsCompleted(id) {
  const show = shows.find(s => s.id === id);
  if (!show) return;

  show.status = 'completed';
  show.lastUpdated = Date.now();
  saveShows();
}
function closeSearchModal() {
  document.getElementById('searchModal').classList.remove('active');
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchInput').value = '';
  pendingShow = null;
}

// ── Toast notification ──────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (toast._hideTimer) clearTimeout(toast._hideTimer);

  toast.textContent = message;
  toast.className = `toast toast-${type} visible`;

  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 5000);
}

// ── Custom confirm dialog (replaces native confirm()) ──────────────────────
function showConfirm(title, message, onConfirm, onCancel) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;

  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  // Style the ok button as destructive for delete-type actions
  const isDestructive = title.toLowerCase().includes('remove') || title.toLowerCase().includes('delete') || title.toLowerCase().includes('replace');
  okBtn.style.background = isDestructive ? '#ef4444' : '';
  okBtn.style.color = isDestructive ? '#fff' : '';
  okBtn.textContent = isDestructive ? 'Yes, proceed' : 'Confirm';

  modal.classList.add('active');

  function cleanup() {
    modal.classList.remove('active');
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
    modal.removeEventListener('click', handleBackdrop);
  }
  function handleOk() { cleanup(); if (onConfirm) onConfirm(); }
  function handleCancel() { cleanup(); if (onCancel) onCancel(); }
  function handleBackdrop(e) { if (e.target === modal) handleCancel(); }

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  modal.addEventListener('click', handleBackdrop);
}

// ── Cooldown countdown on Update All button ────────────────────────────────
let cooldownInterval = null;

async function initCooldownDisplay() {
  const COOLDOWN_MS = 5 * 60 * 1000;
  const stored = await chrome.storage.local.get(['lastManualUpdate']);
  const elapsed = Date.now() - (stored.lastManualUpdate || 0);
  const remaining = COOLDOWN_MS - elapsed;

  if (remaining <= 0) return; // No active cooldown

  const btn = document.getElementById('updateAllBtn');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;

  if (cooldownInterval) clearInterval(cooldownInterval);

  function tick() {
    const now = Date.now();
    const left = Math.max(0, COOLDOWN_MS - (now - (stored.lastManualUpdate || 0)));
    if (left <= 0) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      return;
    }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Next update in ${m}:${String(s).padStart(2, '0')}
    `;
  }

  tick();
  cooldownInterval = setInterval(tick, 1000);
}

async function loadShows() {
  const result = await chrome.storage.local.get(['tvShows', 'trackerSettings']);
  shows = result.tvShows || [];

  const settings = result.trackerSettings || {};
  sortBy = settings.sortBy || 'next';
  activeTab = settings.activeTab || 'watching';
  activeGenreFilter = settings.activeGenreFilter || null;
  const activeView = settings.view || 'grid';

  // Update UI to match settings
  document.getElementById('sortSelect').value = sortBy;

  // Apply tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === activeTab);
  });

  // Apply view
  const grid = document.getElementById('showsGrid');
  grid.className = `shows-grid ${activeView}`;
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === activeView);
  });

  // Migrate old shows to add new fields
  shows = shows.map(show => ({
    airDayOffset: 0,
    rating: null,
    lastUpdated: Date.now(),
    ...show
  }));

  renderShows();
  renderUpcomingList();
  renderGenreFilter();
  updateCounts();
  updateStats();

  // Auto-update once per day on first open
  if (shows.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const autoResult = await chrome.storage.local.get(['lastAutoUpdateDate']);
    if (autoResult.lastAutoUpdateDate !== today) {
      await chrome.storage.local.set({ lastAutoUpdateDate: today });
      // Small delay so the UI fully renders first
      setTimeout(() => updateAllShows({ auto: true }), 800);
    }
  }
}

async function saveSettings() {
  const activeViewBtn = document.querySelector('.view-btn.active');
  const settings = {
    sortBy,
    activeTab,
    activeGenreFilter,
    view: activeViewBtn ? activeViewBtn.dataset.view : 'grid'
  };
  await chrome.storage.local.set({ trackerSettings: settings });
}

async function saveShows() {
  await chrome.storage.local.set({ tvShows: shows });
  renderShows();
  renderUpcomingList();
  renderGenreFilter();
  updateCounts();
  updateStats();
}

function debouncedSearch() {
  const query = document.getElementById('searchInput').value.trim();
  const container = document.getElementById('searchResults');
  
  // Clear results if input is empty
  if (!query) {
    container.innerHTML = '';
    searchResultsData = [];
    // Cancel any pending search
    if (searchAbortController) {
      searchAbortController.abort();
      searchAbortController = null;
    }
    return;
  }

  // Clear existing timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  // Set new timer for debounced search (400ms delay)
  searchDebounceTimer = setTimeout(() => {
    searchShows();
  }, 400);
}

async function searchShows() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;

  // Cancel any previous pending request
  if (searchAbortController) {
    searchAbortController.abort();
  }
  
  // Create new abort controller for this request
  searchAbortController = new AbortController();

  const btn = document.getElementById('searchBtn');
  const container = document.getElementById('searchResults');
  
  // Show loading indicator
  container.innerHTML = '<p style="color: #6d7790; text-align: center; padding: 20px;">Searching...</p>';
  btn.disabled = true;
  btn.textContent = 'Searching...';

  try {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`, {
      signal: searchAbortController.signal
    });
    const data = await response.json();
    searchResultsData = data;
    renderSearchResults(data);
  } catch (error) {
    // Don't show error for aborted requests
    if (error.name === 'AbortError') {
      return;
    }
    console.error('Search failed:', error);
    document.getElementById('searchResults').innerHTML = '<p style="color: #ef4444; text-align: center;">Search failed. Please try again.</p>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Search';
    searchAbortController = null;
  }
}

function renderSearchResults(results) {
  const container = document.getElementById('searchResults');

  if (results.length === 0) {
    container.innerHTML = '<p style="color: #6d7790; text-align: center;">No results found.</p>';
    return;
  }

  container.innerHTML = results.map(result => {
    const show = result.show;
    const imageUrl = show.image?.medium || show.image?.original || '';
    const genres = show.genres?.slice(0, 2).join(', ') || 'N/A';
    const year = show.premiered?.substring(0, 4) || 'N/A';
    const rating = show.rating?.average ? `⭐ ${show.rating.average}` : '';

    return `
      <div class="search-result-item">
        ${imageUrl ? `<img src="${imageUrl}" alt="${show.name}">` : '<div style="width: 50px; height: 75px; background: #1e2739; border-radius: 8px;"></div>'}
        <div class="search-result-info">
          <h3>${show.name} ${rating}</h3>
          <p>${year} • ${genres}</p>
        </div>
        <button class="btn btn-primary" data-show-id="${show.id}" data-add-show style="padding: 10px 20px; font-size: 14px;">
          Add
        </button>
      </div>
    `;
  }).join('');
}

async function fetchEpisodeData(showId) {
  try {
    const response = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`);
    const episodes = await response.json();

    const seasonData = {};
    episodes.forEach(ep => {
      if (!seasonData[ep.season]) {
        seasonData[ep.season] = [];
      }
      seasonData[ep.season].push(ep);
    });

    return { seasonData, allEpisodes: episodes };
  } catch (error) {
    console.error('Failed to fetch episodes:', error);
    return null;
  }
}

async function fetchShowData(showId) {
  try {
    const response = await fetch(`https://api.tvmaze.com/shows/${showId}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch show data:', error);
    return null;
  }
}

async function showImportOptions(show) {
  if (shows.find(s => s.id === show.id)) {
    showToast('This show is already in your list!', 'warning');
    return;
  }

  const episodeData = await fetchEpisodeData(show.id);
  if (!episodeData || !episodeData.seasonData) {
    showToast('Could not load episode data for this show.', 'error');
    return;
  }

  pendingShow = { show, episodeData };

  const seasons = Object.keys(episodeData.seasonData).map(Number).sort((a, b) => a - b);
  const latestSeason = Math.max(...seasons);

  const container = document.getElementById('searchResults');
  container.innerHTML = `
    <div class="import-options">
      <h3>Import Options</h3>
      <div class="import-option-group">
        <label>Start from:</label>
        <select id="importMode">
          <option value="beginning">Beginning (S1E1)</option>
          <option value="latest" selected>Latest Season (S${latestSeason}E1)</option>
          <option value="custom">Custom...</option>
        </select>
      </div>
      <div class="import-option-group" id="customSeasonGroup" style="display: none;">
        <label>Season:</label>
        <select id="customSeason">
          ${seasons.map(s => `<option value="${s}">Season ${s}</option>`).join('')}
        </select>
      </div>
      <div class="import-option-group" id="customEpisodeGroup" style="display: none;">
        <label>Episode:</label>
        <select id="customEpisode">
          <option value="1">Episode 1</option>
        </select>
      </div>
      <div class="import-buttons">
        <button class="btn btn-primary" data-confirm-import style="flex: 1;">Import Show</button>
        <button class="btn btn-secondary" data-cancel-import>Cancel</button>
      </div>
    </div>
  `;

  document.getElementById('importMode').addEventListener('change', (e) => {
    const customSeason = document.getElementById('customSeasonGroup');
    const customEpisode = document.getElementById('customEpisodeGroup');
    if (e.target.value === 'custom') {
      customSeason.style.display = 'block';
      customEpisode.style.display = 'block';
      updateCustomEpisodes();
    } else {
      customSeason.style.display = 'none';
      customEpisode.style.display = 'none';
    }
  });

  document.getElementById('customSeason')?.addEventListener('change', updateCustomEpisodes);
}

function updateCustomEpisodes() {
  if (!pendingShow) return;

  const seasonSelect = document.getElementById('customSeason');
  const episodeSelect = document.getElementById('customEpisode');
  const season = parseInt(seasonSelect.value);
  const episodes = pendingShow.episodeData.seasonData[season];

  episodeSelect.innerHTML = episodes.map((ep, i) =>
    `<option value="${i + 1}">Episode ${i + 1}</option>`
  ).join('');
}

async function confirmImport() {
  if (!pendingShow) return;

  const mode = document.getElementById('importMode').value;
  const { show, episodeData } = pendingShow;

  let currentSeason = 1;
  let currentEpisode = 1;

  if (mode === 'latest') {
    const seasons = Object.keys(episodeData.seasonData).map(Number);
    currentSeason = Math.max(...seasons);
    currentEpisode = 1;
  } else if (mode === 'custom') {
    currentSeason = parseInt(document.getElementById('customSeason').value);
    currentEpisode = parseInt(document.getElementById('customEpisode').value);
  }

  const showData = await fetchShowData(show.id);

  const newShow = {
    id: show.id,
    name: show.name,
    image: show.image?.medium || show.image?.original,
    currentSeason: currentSeason,
    currentEpisode: currentEpisode,
    status: 'watching',
    premiered: show.premiered,
    genres: show.genres || [],
    network: show.network?.name || show.webChannel?.name || 'N/A',
    episodeData: episodeData.seasonData,
    allEpisodes: episodeData.allEpisodes,
    bookmarkUrl: '',
    showStatus: showData?.status || 'Unknown',
    rating: showData?.rating?.average || null,
    airDayOffset: 0,
    lastUpdated: Date.now()
  };

  shows.push(newShow);
  await saveShows();
  closeSearchModal();
}

function cancelImport() {
  pendingShow = null;
  searchShows();
}

function openBookmarkModal(showId) {
  // Delegate to the settings modal which already has the Watch URL field
  openShowSettings(showId);
}

function openShowSettings(showId) {
  const show = shows.find(s => s.id === showId);
  if (!show) return;

  const modal = document.getElementById('settingsModal');
  const content = document.getElementById('settingsContent');

  content.innerHTML = `
    <div class="settings-group">
      <label>Air Day Offset</label>
      <select id="settingsAirOffset">
        <option value="0" ${show.airDayOffset === 0 ? 'selected' : ''}>Same day (default)</option>
        <option value="1" ${show.airDayOffset === 1 ? 'selected' : ''}>+1 day (available next day)</option>
        <option value="2" ${show.airDayOffset === 2 ? 'selected' : ''}>+2 days</option>
      </select>
    </div>
    <div class="settings-group">
      <label>Watch URL</label>
      <input type="url" id="settingsBookmark" value="${show.bookmarkUrl || ''}" placeholder="https://...">
    </div>
    <div class="settings-buttons">
      <button class="btn btn-primary" id="saveSettings" style="flex: 1;">Save</button>
      <button class="btn btn-secondary" id="cancelSettings">Cancel</button>
    </div>
  `;

  modal.classList.add('active');

  document.getElementById('saveSettings').addEventListener('click', () => {
    show.airDayOffset = parseInt(document.getElementById('settingsAirOffset').value);
    show.bookmarkUrl = document.getElementById('settingsBookmark').value.trim();
    show.lastUpdated = Date.now();
    saveShows();
    modal.classList.remove('active');
  });

  document.getElementById('cancelSettings').addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

function getSeasonInfo(show) {
  if (!show.episodeData || !show.episodeData[show.currentSeason]) {
    return { maxEpisodes: 999, maxSeasons: 999, seasons: [], progress: 0 };
  }

  const seasons = Object.keys(show.episodeData).map(Number).sort((a, b) => a - b);
  const maxSeasons = seasons.length;
  const maxEpisodes = show.episodeData[show.currentSeason].length;
  const progress = maxEpisodes > 0 ? (show.currentEpisode / maxEpisodes) * 100 : 0;

  return { maxEpisodes, maxSeasons, seasons, progress };
}

function getNextEpisodeInfo(show) {
  if (!show.allEpisodes || show.allEpisodes.length === 0) {
    return null;
  }

  const currentEpIndex = show.allEpisodes.findIndex(
    ep => ep.season === show.currentSeason && ep.number === show.currentEpisode
  );

  if (currentEpIndex === -1) return null;

  const nextEp = show.allEpisodes[currentEpIndex + 1];

  if (!nextEp) {
    return {
      type: 'ended',
      message: 'No more episodes'
    };
  }

  const airDate = nextEp.airdate;
  if (!airDate) {
    return {
      type: 'tba',
      title: nextEp.name,
      season: nextEp.season,
      episode: nextEp.number,
      message: 'Air date TBA'
    };
  }

  // Apply air day offset
  const adjustedDate = new Date(airDate + 'T00:00:00');
  adjustedDate.setDate(adjustedDate.getDate() + (show.airDayOffset || 0));
  const adjustedDateStr = adjustedDate.toISOString().split('T')[0];

  const today = new Date().toISOString().split('T')[0];
  const hasAired = adjustedDateStr <= today;

  const prefix = show.airDayOffset > 0 ? 'Available ' : 'Airs ';

  return {
    type: hasAired ? 'aired' : 'upcoming',
    title: nextEp.name,
    season: nextEp.season,
    episode: nextEp.number,
    airdate: adjustedDateStr,
    message: hasAired ? 'Ready to watch' : prefix + formatDate(adjustedDateStr)
  };
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = date - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays > 0 && diffDays < 7) return `in ${diffDays} days`;

  const options = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function getAllGenres() {
  const genres = new Set();
  shows.forEach(show => {
    show.genres.forEach(genre => genres.add(genre));
  });
  return Array.from(genres).sort();
}

function renderGenreFilter() {
  const container = document.getElementById('genreFilter');
  const genres = getAllGenres();

  if (genres.length === 0) {
    container.innerHTML = '<div style="color: #6d7790; font-size: 12px;">No genres available</div>';
    return;
  }

  container.innerHTML = genres.map(genre => `
    <div class="genre-filter-tag ${activeGenreFilter === genre ? 'active' : ''}" data-genre="${genre}">
      ${genre}
    </div>
  `).join('');
}

function renderUpcomingList() {
  const container = document.getElementById('upcomingList');

  const upcomingEpisodes = shows
    .map(show => {
      const nextEp = getNextEpisodeInfo(show);
      if (!nextEp || nextEp.type === 'ended') return null;
      return { show, nextEp };
    })
    .filter(item => item !== null)
    .sort((a, b) => {
      if (a.nextEp.type === 'aired' && b.nextEp.type !== 'aired') return -1;
      if (a.nextEp.type !== 'aired' && b.nextEp.type === 'aired') return 1;
      if (a.nextEp.airdate && b.nextEp.airdate) {
        return a.nextEp.airdate.localeCompare(b.nextEp.airdate);
      }
      return 0;
    });

  if (upcomingEpisodes.length === 0) {
    container.innerHTML = '<div class="upcoming-empty">No upcoming episodes</div>';
    return;
  }

  container.innerHTML = upcomingEpisodes.map(({ show, nextEp }) => `
    <div class="upcoming-item ${nextEp.type}">
      <div class="upcoming-show-name">${show.name}</div>
      <div class="upcoming-episode">S${nextEp.season}E${nextEp.episode} • ${nextEp.title}</div>
      <div class="upcoming-date">${nextEp.message}</div>
    </div>
  `).join('');
}

function sortShows(showsList) {
  const sorted = [...showsList];

  if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'updated') {
    sorted.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  } else if (sortBy === 'next') {
    sorted.sort((a, b) => {
      const nextA = getNextEpisodeInfo(a);
      const nextB = getNextEpisodeInfo(b);
      if (!nextA) return 1;
      if (!nextB) return -1;
      if (!nextA.airdate) return 1;
      if (!nextB.airdate) return -1;
      return nextA.airdate.localeCompare(nextB.airdate);
    });
  }

  return sorted;
}

function renderShows() {
  const container = document.getElementById('showsGrid');
  let filteredShows = shows.filter(s => s.status === activeTab);

  if (activeGenreFilter) {
    filteredShows = filteredShows.filter(s => s.genres.includes(activeGenreFilter));
  }

  if (searchQuery) {
    filteredShows = filteredShows.filter(s => s.name.toLowerCase().includes(searchQuery));
  }

  filteredShows = sortShows(filteredShows);

  if (filteredShows.length === 0) {
    const emptyMessage = searchQuery
      ? { title: 'No shows match your search', subtitle: 'Try a different search term' }
      : { title: activeTab === 'watching' ? 'No shows watching' : activeTab === 'waiting' ? 'No shows waiting' : 'No completed shows', subtitle: 'Click the search icon to add shows' };
    
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
          <polyline points="17 2 12 7 7 2"></polyline>
        </svg>
        <h3>${emptyMessage.title}</h3>
        <p>${emptyMessage.subtitle}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredShows.map(show => {
    const { maxEpisodes, maxSeasons, seasons, progress } = getSeasonInfo(show);
    const canGoToPrevEpisode = show.currentEpisode > 1;
    const canGoToNextEpisode = show.currentEpisode < maxEpisodes;
    const nextEpInfo = getNextEpisodeInfo(show);

    let nextEpisodeHTML = '';
    if (nextEpInfo && nextEpInfo.type !== 'ended') {
      const boxClass = nextEpInfo.type === 'aired' ? 'aired' : '';
      const badgeClass = nextEpInfo.type === 'aired' ? 'aired' : 'upcoming';
      const badgeText = nextEpInfo.type === 'aired' ? 'New' : 'Soon';

      nextEpisodeHTML = `
        <div class="next-episode-box ${boxClass}">
          <div class="next-episode-title">
            <span>S${nextEpInfo.season}E${nextEpInfo.episode} • ${nextEpInfo.title}</span>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="next-episode-date">${nextEpInfo.message}</div>
        </div>
      `;
    }

    const statusBadgeClass = show.showStatus === 'Running' ? 'running' : 'ended';
    const ratingHTML = show.rating ? `<div class="show-rating">⭐ ${show.rating.toFixed(1)}</div>` : '';

    let bookmarkHTML = '';
    if (show.bookmarkUrl) {
      bookmarkHTML = `
        <a href="${show.bookmarkUrl}" target="_blank" class="bookmark-link-btn" data-show-id="${show.id}">
          🔗 Watch Link
        </a>
      `;
    } else {
      bookmarkHTML = `
        <button class="bookmark-add-btn" data-show-id="${show.id}" data-action="add-bookmark">
          + Add Watch Link
        </button>
      `;
    }

    return `
    <div class="show-card">
      <div class="show-image-container">
        ${show.image ? `<img src="${show.image}" alt="${show.name}">` : '<div style="width: 100%; height: 100%; background: #1e2739;"></div>'}
        ${show.showStatus && show.showStatus !== 'Unknown' ? `<div class="show-status-badge ${statusBadgeClass}">${show.showStatus}</div>` : ''}
        ${ratingHTML}
        <button class="show-settings-btn" data-show-id="${show.id}" data-action="settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m8.66-10l-5.2 3M8.54 14l-5.2 3M1.34 7l5.2 3m10.92 0 5.2-3M1.34 17l5.2-3m10.92 0 5.2 3"></path>
          </svg>
        </button>
      </div>
      <div class="show-card-content">
        <h3>${show.name}</h3>
        
        <div class="show-genres">
          ${show.genres.slice(0, 3).map(g => `<span class="genre-tag">${g}</span>`).join('')}
        </div>

        ${nextEpisodeHTML}

        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">Your progress</span>
            <span class="progress-value">S${show.currentSeason}E${show.currentEpisode}</span>
          </div>
          
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${progress}%"></div>
          </div>

          <div class="selector-row">
            <div class="season-selector">
              <select class="season-select" data-show-id="${show.id}">
                ${seasons.map(s => `
                  <option value="${s}" ${s === show.currentSeason ? 'selected' : ''}>
                    Season ${s}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="episode-selector">
              <select class="episode-select" data-show-id="${show.id}">
                ${show.episodeData && show.episodeData[show.currentSeason] 
                  ? show.episodeData[show.currentSeason].map((ep, idx) => {
                      const epNum = idx + 1;
                      return `<option value="${epNum}" ${epNum === show.currentEpisode ? 'selected' : ''}>
                        E${epNum}: ${ep.name || `Episode ${epNum}`}
                      </option>`;
                    }).join('')
                  : `<option value="${show.currentEpisode}">E${show.currentEpisode}</option>`
                }
              </select>
            </div>
          </div>
          
          <div class="controls">
            <button class="control-btn" data-show-id="${show.id}" data-action="prev" ${!canGoToPrevEpisode ? 'disabled' : ''}>
              ← Prev
            </button>
            <button class="control-btn primary" data-show-id="${show.id}" data-action="next" ${!canGoToNextEpisode ? 'disabled' : ''}>
              Next →
            </button>
          </div>
        </div>

        <div class="bookmark-section">
          ${bookmarkHTML}
        </div>
        
<div class="action-buttons">
          <button class="btn btn-secondary" data-show-id="${show.id}" data-action="toggle" style="font-size: 12px;">
            ${show.status === 'watching' ? '→ Waiting' : show.status === 'waiting' ? '→ Watching' : '→ Watching'}
          </button>
          ${show.status !== 'completed' ? `
            <button class="btn btn-secondary" data-show-id="${show.id}" data-action="complete" style="font-size: 12px; background: #a7caf3; color: #000;">
              ✓ Complete
            </button>
          ` : ''}
          <button class="btn-delete" data-show-id="${show.id}" data-action="delete">
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

function changeEpisode(id, delta) {
  const show = shows.find(s => s.id === id);
  if (!show) return;

  const { maxEpisodes } = getSeasonInfo(show);
  const newEpisode = show.currentEpisode + delta;

  if (newEpisode < 1 || newEpisode > maxEpisodes) return;

  show.currentEpisode = newEpisode;
  show.lastUpdated = Date.now();
  saveShows();
}

function changeToSeason(id, newSeason) {
  const show = shows.find(s => s.id === id);
  if (!show) return;

  show.currentSeason = newSeason;
  show.currentEpisode = 1;
  show.lastUpdated = Date.now();
  saveShows();
}

function changeToEpisode(id, episodeNumber) {
  const show = shows.find(s => s.id === id);
  if (!show) return;

  const { maxEpisodes } = getSeasonInfo(show);
  
  if (episodeNumber < 1 || episodeNumber > maxEpisodes) return;

  show.currentEpisode = episodeNumber;
  show.lastUpdated = Date.now();
  saveShows();
}

function toggleStatus(id) {
  const show = shows.find(s => s.id === id);
  if (!show) return;

  show.status = show.status === 'watching' ? 'waiting' : 'watching';
  show.lastUpdated = Date.now();
  saveShows();
}

function deleteShow(id) {
  const show = shows.find(s => s.id === id);
  if (!show) return;

  showConfirm(
    'Remove show',
    `Remove "${show.name}" from your tracker? This cannot be undone.`,
    () => {
      shows = shows.filter(s => s.id !== id);
      saveShows();
    }
  );
}

function updateCounts() {
  document.getElementById('watchingCount').textContent = shows.filter(s => s.status === 'watching').length;
  document.getElementById('waitingCount').textContent = shows.filter(s => s.status === 'waiting').length;
  document.getElementById('completedCount').textContent = shows.filter(s => s.status === 'completed').length;
}

function updateStats() {
  const totalShows = shows.length;

  // Calculate total episodes watched (sum of all current episodes)
  let totalEpisodes = 0;
  shows.forEach(show => {
    if (!show.allEpisodes) return;
    const currentEpIndex = show.allEpisodes.findIndex(
      ep => ep.season === show.currentSeason && ep.number === show.currentEpisode
    );
    if (currentEpIndex >= 0) {
      totalEpisodes += currentEpIndex;
    }
  });

  // Estimate hours (average episode is 45 minutes)
  const totalMinutes = totalEpisodes * 45;
  const totalHours = Math.floor(totalMinutes / 60);

  document.getElementById('totalShows').textContent = totalShows;
  document.getElementById('totalEpisodes').textContent = totalEpisodes;
  document.getElementById('totalHours').textContent = totalHours + 'h';
}

// Data Export/Import Functions

function getFormattedDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function exportData() {
  try {
    const result = await chrome.storage.local.get(['tvShows', 'trackerSettings']);
    
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      tvShows: result.tvShows || [],
      trackerSettings: result.trackerSettings || {}
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tvtrack-backup-${getFormattedDate()}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);

    showToast(`Exported ${exportData.tvShows.length} show(s) successfully.`, 'success');
  } catch (error) {
    console.error('Export failed:', error);
    showToast('Export failed. Please try again.', 'error');
  }
}

function validateImportData(data) {
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file format. Expected a JSON object.' };
  }

  // Check for required fields
  if (!data.tvShows || !Array.isArray(data.tvShows)) {
    return { valid: false, error: 'Invalid data format. Missing or invalid tvShows array.' };
  }

  // Validate each show has required fields
  const requiredShowFields = ['id', 'name', 'currentSeason', 'currentEpisode', 'status'];
  for (let i = 0; i < data.tvShows.length; i++) {
    const show = data.tvShows[i];
    for (const field of requiredShowFields) {
      if (!(field in show)) {
        return { valid: false, error: `Invalid show data at index ${i}. Missing required field: ${field}` };
      }
    }
    // Validate field types
    if (typeof show.id !== 'number') {
      return { valid: false, error: `Invalid show data at index ${i}. ID must be a number.` };
    }
    if (typeof show.name !== 'string') {
      return { valid: false, error: `Invalid show data at index ${i}. Name must be a string.` };
    }
    if (!['watching', 'waiting', 'completed'].includes(show.status)) {
      return { valid: false, error: `Invalid show data at index ${i}. Status must be watching, waiting, or completed.` };
    }
  }

  // Validate settings if present
  if (data.trackerSettings && typeof data.trackerSettings !== 'object') {
    return { valid: false, error: 'Invalid settings format. Expected an object.' };
  }

  return { valid: true };
}

// Update all shows function
// options.auto = true  → triggered automatically (no cooldown check)
async function updateAllShows(options = {}) {
  const isAuto = options && options.auto === true;
  const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  const btn = document.getElementById('updateAllBtn');
  const originalHTML = btn.innerHTML;

  // ── Cooldown guard (manual updates only) ──────────────────────────────────
  if (!isAuto) {
    const stored = await chrome.storage.local.get(['lastManualUpdate']);
    const elapsed = Date.now() - (stored.lastManualUpdate || 0);
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      showToast(`Please wait ${m}m ${s}s before updating again.`, 'warning');
      return;
    }
    await chrome.storage.local.set({ lastManualUpdate: Date.now() });
    initCooldownDisplay();
  }

  // ── Snapshot current state for change detection ───────────────────────────
  const snapshot = {};
  shows.forEach(show => {
    snapshot[show.id] = {
      episodeCount: show.allEpisodes ? show.allEpisodes.length : 0,
      showStatus: show.showStatus || 'Unknown'
    };
  });

  // ── Disable button and show loading state ─────────────────────────────────
  btn.disabled = true;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; animation: spin 1s linear infinite;">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
      <path d="M21 3v5h-5"></path>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
      <path d="M3 21v-5h5"></path>
    </svg>
    ${isAuto ? 'Auto-updating...' : 'Updating...'}
  `;

  // Add spin animation if not already present
  if (!document.getElementById('spinStyle')) {
    const style = document.createElement('style');
    style.id = 'spinStyle';
    style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  let updatedCount = 0;
  let errorCount = 0;

  try {
    const batchSize = 5;
    const totalShows = shows.length;

    for (let i = 0; i < totalShows; i += batchSize) {
      const batch = shows.slice(i, i + batchSize);
      const updatePromises = batch.map(async (show) => {
        try {
          const [episodeData, showData] = await Promise.all([
            fetchEpisodeData(show.id),
            fetchShowData(show.id)
          ]);

          if (episodeData && episodeData.seasonData && showData) {
            show.episodeData = episodeData.seasonData;
            show.allEpisodes = episodeData.allEpisodes;
            show.showStatus = showData.status || 'Unknown';
            show.rating = showData.rating?.average || null;
            show.lastUpdated = Date.now();
            updatedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Failed to update show ${show.name}:`, error);
          errorCount++;
        }
      });

      await Promise.all(updatePromises);

      const progress = Math.min(i + batchSize, totalShows);
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; animation: spin 1s linear infinite;">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
          <path d="M21 3v5h-5"></path>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
          <path d="M3 21v-5h5"></path>
        </svg>
        Updating... (${progress}/${totalShows})
      `;

      if (i + batchSize < totalShows) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    await saveShows();

    // ── Detect what changed ───────────────────────────────────────────────
    let newEpisodesTotal = 0;
    const statusChanges = [];
    shows.forEach(show => {
      const prev = snapshot[show.id];
      if (!prev) return;
      const newCount = show.allEpisodes ? show.allEpisodes.length : 0;
      if (newCount > prev.episodeCount) {
        newEpisodesTotal += newCount - prev.episodeCount;
      }
      if (show.showStatus && show.showStatus !== prev.showStatus && prev.showStatus !== 'Unknown') {
        statusChanges.push(`${show.name}: ${prev.showStatus} → ${show.showStatus}`);
      }
    });

    // ── Build toast message ───────────────────────────────────────────────
    const parts = [];
    parts.push(`${updatedCount} show${updatedCount !== 1 ? 's' : ''} updated`);
    if (errorCount > 0) parts.push(`${errorCount} failed`);
    if (newEpisodesTotal > 0) parts.push(`${newEpisodesTotal} new episode${newEpisodesTotal !== 1 ? 's' : ''} available`);
    if (statusChanges.length > 0) parts.push(statusChanges.join(', '));

    const toastType = errorCount > 0 && updatedCount === 0 ? 'error' : newEpisodesTotal > 0 ? 'success' : 'success';
    showToast(parts.join(' • '), toastType);

    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
        <path d="M21 3v5h-5"></path>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
        <path d="M3 21v-5h5"></path>
      </svg>
      Updated!
    `;

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }, 3000);

  } catch (error) {
    console.error('Update failed:', error);
    showToast('Update failed. Please try again.', 'error');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
        <path d="M21 3v5h-5"></path>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
        <path d="M3 21v-5h5"></path>
      </svg>
      Update Failed
    `;
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }, 3000);
  }
}

async function importData(file) {
  if (!file) return;

  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    showToast('Invalid file type. Please select a JSON file.', 'error');
    return;
  }

  try {
    const text = await file.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      showToast('Invalid JSON file. Please check the file format.', 'error');
      return;
    }

    const validation = validateImportData(data);
    if (!validation.valid) {
      showToast('Import failed: ' + validation.error, 'error');
      return;
    }

    const showCount = data.tvShows.length;
    const exportDateStr = data.exportDate
      ? new Date(data.exportDate).toLocaleDateString()
      : 'Unknown';

    showConfirm(
      'Replace all data?',
      `This will replace all your current data with the imported file.\n\nShows to import: ${showCount}\nExport date: ${exportDateStr}`,
      async () => {
        try {
          await chrome.storage.local.set({
            tvShows: data.tvShows,
            trackerSettings: data.trackerSettings || {}
          });
          await loadShows();
          showToast(`Imported ${showCount} show(s) successfully.`, 'success');
        } catch (err) {
          console.error('Import failed:', err);
          showToast('Import failed. Please try again.', 'error');
        }
      }
    );
  } catch (error) {
    console.error('Import failed:', error);
    showToast('Import failed. Please try again.', 'error');
  }
}