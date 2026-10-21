/**
 * Cricbuzz Match Scorecard Application Engine
 * Handles rendering, JSON parsing, dynamic table generation, analytics & themes.
 */

// Global State
let matchData = null;
let chartBoundariesInstance = null;
let chartComparisonInstance = null;

// Global State for Upcoming Matches
let upcomingData = null;
let allUpcomingMatches = [];
let currentUpcomingTypeFilter = 'all';
let currentUpcomingFormatFilter = 'all';
let currentUpcomingSearchTerm = '';

// Global State for Completed Matches
let allCompletedMatches = [];
let currentCompletedSearchTerm = '';
let currentLoadedMatchId = 40381;

// Global State for Upcoming Tournaments & Series
let allSeriesData = [];
let currentSeriesCategoryFilter = 'all';
let currentSeriesMonthFilter = 'all';
let currentSeriesSearchTerm = '';

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  loadLiveTicker();
  loadScorecardData();
  loadUpcomingMatches();
  loadSeriesData();
  loadCompletedMatches();
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('cricbuzz_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('cricbuzz_theme', newTheme);
  updateThemeIcon(newTheme);
  
  // Re-render charts with new theme colors if data loaded
  if (matchData) {
    renderAnalyticsCharts(matchData);
  }
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('btnThemeToggle');
  if (!btn) return;
  if (theme === 'light') {
    btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    btn.title = "Switch to Dark Mode";
  } else {
    btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    btn.title = "Switch to Light Mode";
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Theme button
  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);

  // Site section switching (Scorecard, Recent Matches, Upcoming, Series)
  const siteNavBtns = document.querySelectorAll('.site-nav-btn');
  siteNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.getAttribute('data-section');
      if (section) switchSection(section);
    });
  });

  // Match Sub-nav switching (Innings 1, Innings 2, Match Info, Analytics)
  const subNavBtns = document.querySelectorAll('.sub-nav-btn');
  subNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const subtab = btn.getAttribute('data-subtab');
      if (subtab) switchMatchSubTab(subtab);
    });
  });

  // Backward compatibility with .nav-tab
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      if (targetId) {
        switchTab(targetId);
      }
    });
  });

  // Handle URL hash navigation on load & hashchange
  window.addEventListener('hashchange', handleUrlHash);
  handleUrlHash();

  // Completed search listener
  const completedSearchInput = document.getElementById('completedSearchInput');
  if (completedSearchInput) {
    completedSearchInput.addEventListener('input', (e) => {
      currentCompletedSearchTerm = e.target.value.toLowerCase().trim();
      renderCompletedMatches();
    });
  }

  // Upcoming search listener
  const upcomingSearchInput = document.getElementById('upcomingSearchInput');
  if (upcomingSearchInput) {
    upcomingSearchInput.addEventListener('input', (e) => {
      currentUpcomingSearchTerm = e.target.value.toLowerCase().trim();
      renderUpcomingMatches();
    });
  }

  // Upcoming type filter pills
  const typePills = document.querySelectorAll('#upcomingTypeFilters .filter-pill');
  typePills.forEach(pill => {
    pill.addEventListener('click', () => {
      typePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentUpcomingTypeFilter = pill.getAttribute('data-type');
      renderUpcomingMatches();
    });
  });

  // Upcoming format filter pills
  const formatPills = document.querySelectorAll('#upcomingFormatFilters .filter-pill');
  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentUpcomingFormatFilter = pill.getAttribute('data-format');
      renderUpcomingMatches();
    });
  });

  // One-Click Sync Live API Button listener
  const btnSync = document.getElementById('btnSyncLiveData');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.disabled = true;
      const icon = btnSync.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      showToast('Syncing with Cricbuzz RapidAPI...', 'info');

      try {
        const response = await fetch('/api/cricbuzz/sync-upcoming', {
          method: 'POST',
          headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
          }
        });
        const result = await response.json();
        
        if (result.status === 'success') {
          showToast(result.message || 'Synced successfully!', 'success');
          // Reload matches and tournaments from dynamic API
          await loadUpcomingMatches();
          await loadSeriesData();
        } else {
          showToast(result.message || 'Sync failed', 'error');
        }
      } catch (err) {
        showToast('Error connecting to sync API', 'error');
      } finally {
        btnSync.disabled = false;
        if (icon) icon.classList.remove('fa-spin');
      }
    });
  }

  // Series search listener
  const seriesSearchInput = document.getElementById('seriesSearchInput');
  if (seriesSearchInput) {
    seriesSearchInput.addEventListener('input', (e) => {
      currentSeriesSearchTerm = e.target.value.toLowerCase().trim();
      renderSeries();
    });
  }

  // Series category filter pills
  const seriesCatPills = document.querySelectorAll('#seriesCategoryFilters .filter-pill');
  seriesCatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      seriesCatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentSeriesCategoryFilter = pill.getAttribute('data-category');
      renderSeries();
    });
  });

  // Series month select filter
  const seriesMonthSelect = document.getElementById('seriesMonthFilter');
  if (seriesMonthSelect) {
    seriesMonthSelect.addEventListener('change', (e) => {
      currentSeriesMonthFilter = e.target.value;
      renderSeries();
    });
  }

  // Sync Series button inside Series tab
  const btnSyncSeries = document.getElementById('btnSyncSeriesTab');
  if (btnSyncSeries) {
    btnSyncSeries.addEventListener('click', syncSeriesData);
  }

  // Close series schedule modal
  const btnCloseSchedule = document.getElementById('btnCloseSeriesSchedule');
  if (btnCloseSchedule) {
    btnCloseSchedule.addEventListener('click', closeSeriesScheduleModal);
  }
  const modalSchedule = document.getElementById('modalSeriesSchedule');
  if (modalSchedule) {
    modalSchedule.addEventListener('click', (e) => {
      if (e.target === modalSchedule) closeSeriesScheduleModal();
    });
  }

  // Search filtering in tables
  document.querySelectorAll('.player-search').forEach(input => {
    input.addEventListener('input', (e) => {
      const targetTableId = e.target.getAttribute('data-target');
      const term = e.target.value.toLowerCase().trim();
      const table = document.getElementById(targetTableId);
      if (!table) return;

      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  });

  // Print button
  document.getElementById('btnPrint').addEventListener('click', () => {
    window.print();
  });

  // Modal: Load JSON
  const modalUpload = document.getElementById('modalUpload');
  document.getElementById('btnUploadModal').addEventListener('click', () => {
    modalUpload.classList.add('active');
  });
  document.getElementById('btnCloseUpload').addEventListener('click', () => {
    modalUpload.classList.remove('active');
  });

  // Modal: Raw JSON
  const modalRawJson = document.getElementById('modalRawJson');
  document.getElementById('btnRawJsonModal').addEventListener('click', () => {
    if (matchData) {
      document.getElementById('rawJsonTextarea').value = JSON.stringify(matchData, null, 2);
    }
    modalRawJson.classList.add('active');
  });
  document.getElementById('btnCloseRawJson').addEventListener('click', () => {
    modalRawJson.classList.remove('active');
  });

  // Copy JSON button
  document.getElementById('btnCopyJson').addEventListener('click', () => {
    const textarea = document.getElementById('rawJsonTextarea');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
      showToast('Raw JSON copied to clipboard!');
    });
  });

  // Drag & Drop / File Input
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('jsonFileInput');

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--accent-emerald)';
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border-color-strong)';
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-color-strong)';
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });
}

// Load JSON Data directly from Database API
async function loadScorecardData() {
  try {
    const apiRes = await fetch('/api/cricbuzz/scorecard/40381');
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && (data.scorecard || Array.isArray(data))) {
        const payload = data.scorecard ? data : { scorecard: data };
        matchData = payload;
        renderScorecard(payload);
        showToast('Loaded dynamic scorecard from database.');
        return;
      }
    }

    // Fallback to local scorcard.json
    const publicRes = await fetch('/scorcard.json').catch(() => null);
    if (publicRes && publicRes.ok) {
      const pData = await publicRes.json();
      if (pData && pData.scorecard) {
        matchData = pData;
        renderScorecard(pData);
        return;
      }
    }

    showToast('No scorecard found in database. Click "Sync Live API" to fetch live data.', 'info');
  } catch (err) {
    console.error('Backend scorecard API fetch failed:', err);
    // Fallback on error
    const publicRes = await fetch('/scorcard.json').catch(() => null);
    if (publicRes && publicRes.ok) {
      const pData = await publicRes.json();
      if (pData && pData.scorecard) {
        matchData = pData;
        renderScorecard(pData);
        return;
      }
    }
    showToast('Error connecting to Cricbuzz API backend.', 'error');
  }
}

// Handle Custom JSON Upload
function handleFileUpload(file) {
  if (!file.name.endsWith('.json')) {
    showToast('Please select a valid .json file!', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.scorecard) {
        throw new Error('Invalid Cricbuzz scorecard structure');
      }
      matchData = data;
      renderScorecard(data);
      document.getElementById('modalUpload').classList.remove('active');
      showToast(`Loaded ${file.name} successfully!`);
    } catch (err) {
      showToast('Error parsing JSON file structure', 'error');
    }
  };
  reader.readAsText(file);
}

// Main Render Function
function renderScorecard(data) {
  matchData = data;
  const scorecard = data.scorecard || [];
  if (scorecard.length === 0) return;

  const inn1 = scorecard[0];
  const inn2 = scorecard[1] || {};

  // Render Header & Meta Bar
  if (data.appindex && data.appindex.seotitle) {
    const seoTitle = data.appindex.seotitle.split('|')[0].trim();
    const subTitleEl = document.getElementById('matchSubTitle');
    if (subTitleEl) subTitleEl.innerText = seoTitle;

    const seriesSpan = document.querySelector('#seriesTitle span');
    if (seriesSpan) seriesSpan.innerText = seoTitle;
  }
  if (data.status) {
    const statusEl = document.getElementById('matchStatusText');
    if (statusEl) statusEl.innerText = data.status;
  }

  // Render Team 1 & Team 2 Cards
  renderTeamHeader(inn1, inn2, data.status);

  // Render Innings 1
  renderInningsData(inn1, 1);

  // Render Innings 2 (if present)
  const tab2Btn = document.getElementById('tabBtnInnings2');
  if (inn2 && inn2.inningsid) {
    renderInningsData(inn2, 2);
    if (tab2Btn) tab2Btn.style.display = '';
  } else {
    if (tab2Btn) tab2Btn.style.display = 'none';
  }

  // Render Top Highlights
  calculateMatchHighlights(scorecard);

  // Render Analytics Charts
  renderAnalyticsCharts(data);

  // Render Match Information & Playing XI
  renderMatchInfo(data);
}

function renderTeamHeader(inn1, inn2, status) {
  const team1Name = inn1.batteamname || 'Team 1';
  const team1Code = inn1.batteamsname || team1Name.substring(0, 3).toUpperCase();
  const team2Name = inn2.batteamname || 'Team 2';
  const team2Code = inn2.batteamsname || team2Name.substring(0, 3).toUpperCase();

  // Innings 1 Team Info
  const t1NameEl = document.getElementById('team1Name');
  if (t1NameEl) t1NameEl.innerText = team1Name;

  const t1Flag = getTeamFlagUrl({ teamName: team1Name, teamSName: team1Code });
  const flag1El = document.getElementById('flagTeam1');
  if (flag1El) {
    if (t1Flag) {
      flag1El.className = 'team-flag';
      flag1El.innerHTML = `<img src="${t1Flag}" alt="${team1Code}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.parentElement.innerText='${team1Code}'">`;
    } else {
      flag1El.className = 'team-flag';
      flag1El.innerText = team1Code;
    }
  }

  document.getElementById('team1Score').innerText = `${inn1.score}/${inn1.wickets}`;
  document.getElementById('team1Overs').innerText = `(${inn1.overs} Ov)`;
  document.getElementById('team1RR').innerText = `RR: ${inn1.runrate || '0.00'}`;

  // Innings 2 Team Info
  const t2NameEl = document.getElementById('team2Name');
  if (t2NameEl) t2NameEl.innerText = team2Name;

  const t2Flag = getTeamFlagUrl({ teamName: team2Name, teamSName: team2Code });
  const flag2El = document.getElementById('flagTeam2');
  if (flag2El) {
    if (t2Flag) {
      flag2El.className = 'team-flag';
      flag2El.innerHTML = `<img src="${t2Flag}" alt="${team2Code}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.parentElement.innerText='${team2Code}'">`;
    } else {
      flag2El.className = 'team-flag';
      flag2El.innerText = team2Code;
    }
  }

  if (inn2 && inn2.inningsid) {
    document.getElementById('team2Score').innerText = `${inn2.score}/${inn2.wickets}`;
    document.getElementById('team2Overs').innerText = `(${inn2.overs} Ov)`;
    document.getElementById('team2RR').innerText = `RR: ${inn2.runrate || '0.00'}`;
  } else {
    document.getElementById('team2Score').innerText = `-/-`;
    document.getElementById('team2Overs').innerText = `(Yet to bat)`;
    document.getElementById('team2RR').innerText = `RR: 0.00`;
  }

  // Tab Titles & Badges
  document.getElementById('tabTitle1').innerText = `${team1Code} 1st Innings`;
  document.getElementById('tabBadge1').innerText = `${inn1.score}/${inn1.wickets}`;

  if (inn2 && inn2.inningsid) {
    document.getElementById('tabTitle2').innerText = `${team2Code} 2nd Innings`;
    document.getElementById('tabBadge2').innerText = `${inn2.score}/${inn2.wickets}`;
  }

  // Update Navigation Pill text
  const pill1 = document.getElementById('currentMatchPillText1');
  const pill2 = document.getElementById('currentMatchPillText2');
  const matchDesc = `${team1Code} vs ${team2Code}`;
  if (pill1) pill1.innerText = `${matchDesc} (1st Inn)`;
  if (pill2) pill2.innerText = `${matchDesc} (2nd Inn)`;

  // Winner Highlighting
  const card1 = document.getElementById('teamCard1');
  const card2 = document.getElementById('teamCard2');
  card1.classList.remove('winner');
  card2.classList.remove('winner');

  if (status && status.toLowerCase().includes(team1Name.toLowerCase())) {
    card1.classList.add('winner');
  } else if (status && status.toLowerCase().includes(team2Name.toLowerCase())) {
    card2.classList.add('winner');
  }
}

function renderInningsData(inn, innIndex) {
  const batTeam = inn.batteamname || `Innings ${innIndex}`;
  const bowlTeam = innIndex === 1 ? (matchData.scorecard[1]?.batteamname || 'Opponent') : (matchData.scorecard[0]?.batteamname || 'Opponent');

  document.getElementById(`batTeam${innIndex}Header`).innerText = `${batTeam} Batting`;
  document.getElementById(`bowlTeam${innIndex}Header`).innerText = `${bowlTeam} Bowling`;

  // 1. Batting Table
  const batTbody = document.querySelector(`#batting-table-${innIndex} tbody`);
  batTbody.innerHTML = '';

  const allBatsmen = inn.batsman || [];
  const battedPlayers = allBatsmen.filter(b => {
    const hasOutDesc = b.outdec && b.outdec.trim() !== '';
    return (b.balls > 0 || b.runs > 0 || hasOutDesc);
  });

  const dnbPlayers = allBatsmen.filter(b => {
    return (b.balls === 0 && (!b.outdec || b.outdec.trim() === '') && b.runs === 0);
  });

  let topScorer = { runs: -1 };
  battedPlayers.forEach(b => {
    if (b.runs > topScorer.runs) topScorer = b;
  });

  battedPlayers.forEach(b => {
    const tr = document.createElement('tr');
    if (b.id === topScorer.id && b.runs > 20) {
      tr.classList.add('highlight-row');
    }

    let roleBadges = '';
    if (b.iscaptain) roleBadges += `<span class="badge-role badge-captain">C</span> `;
    if (b.iskeeper) roleBadges += `<span class="badge-role badge-keeper">WK</span> `;
    if (b.id === topScorer.id && b.runs > 20) roleBadges += `<span class="badge-role badge-top-scorer">TOP</span> `;

    const outStatus = b.outdec ? `<span class="out-desc">${b.outdec}</span>` : `<span class="status-badge" style="padding:2px 8px; font-size:0.75rem;">Not Out</span>`;

    tr.innerHTML = `
      <td>
        <div class="player-cell">
          <span class="player-name">${escapeHtml(b.name)}</span>
          ${roleBadges}
        </div>
      </td>
      <td>${outStatus}</td>
      <td style="text-align: right;" class="stat-bold">${b.runs}</td>
      <td style="text-align: right;">${b.balls}</td>
      <td style="text-align: right;">${b.fours}</td>
      <td style="text-align: right;">${b.sixes}</td>
      <td style="text-align: right;">${b.strkrate}</td>
    `;
    batTbody.appendChild(tr);
  });

  // Populate Did Not Bat Row (Cricbuzz Classic)
  const dnbRow = document.getElementById(`dnb-row-${innIndex}`);
  const dnbPlayersEl = document.getElementById(`dnb-players-${innIndex}`);
  if (dnbRow && dnbPlayersEl) {
    if (dnbPlayers.length > 0) {
      dnbRow.style.display = 'flex';
      dnbPlayersEl.innerText = dnbPlayers.map(p => p.name).join(', ');
    } else {
      dnbRow.style.display = 'none';
      dnbPlayersEl.innerText = '';
    }
  }

  // Extras
  const ext = inn.extras || {};
  const extBreakdown = document.getElementById(`extras-breakdown-${innIndex}`);
  extBreakdown.innerHTML = `
    <span><strong>${ext.total || 0}</strong> (b ${ext.byes || 0}, lb ${ext.legbyes || 0}, w ${ext.wides || 0}, nb ${ext.noballs || 0}, p ${ext.penalty || 0})</span>
  `;

  // Total
  document.getElementById(`total-val-${innIndex}`).innerText = `${inn.score}/${inn.wickets} (${inn.overs} Overs, RR: ${inn.runrate || '0.00'})`;

  // 2. Bowling Table
  const bowlTbody = document.querySelector(`#bowling-table-${innIndex} tbody`);
  bowlTbody.innerHTML = '';

  (inn.bowler || []).forEach(bw => {
    const tr = document.createElement('tr');
    if (bw.wickets >= 3) {
      tr.classList.add('highlight-row');
    }

    let roleBadges = '';
    if (bw.iscaptain) roleBadges += `<span class="badge-role badge-captain">C</span> `;

    tr.innerHTML = `
      <td>
        <div class="player-cell">
          <span class="player-name">${escapeHtml(bw.name)}</span>
          ${roleBadges}
        </div>
      </td>
      <td style="text-align: right;">${bw.overs}</td>
      <td style="text-align: right;">${bw.maidens}</td>
      <td style="text-align: right;">${bw.runs}</td>
      <td style="text-align: right;" class="stat-bold">${bw.wickets}</td>
      <td style="text-align: right;">${bw.economy}</td>
      <td style="text-align: right;">${bw.dots || 0}</td>
    `;
    bowlTbody.appendChild(tr);
  });

  // 3. Powerplay Breakdown
  const ppContainer = document.getElementById(`powerplay-container-${innIndex}`);
  ppContainer.innerHTML = '';
  const pps = (inn.pp && inn.pp.powerplay) ? inn.pp.powerplay : [];
  if (pps.length > 0) {
    pps.forEach(pp => {
      const div = document.createElement('div');
      div.className = 'powerplay-box';
      div.innerHTML = `
        <div>
          <strong style="color: var(--accent-amber);">${pp.pptype} Powerplay</strong>
          <span style="font-size: 0.85rem; color: var(--text-secondary); margin-left: 8px;">(Overs ${pp.ovrfrom} - ${pp.ovrto})</span>
        </div>
        <div>
          <span style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 800;">${pp.run}/${pp.wickets}</span>
        </div>
      `;
      ppContainer.appendChild(div);
    });
  } else {
    ppContainer.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No powerplay data recorded.</p>`;
  }

  // 4. Fall of Wickets (FOW)
  const fowGrid = document.getElementById(`fow-grid-${innIndex}`);
  fowGrid.innerHTML = '';
  const fows = (inn.fow && inn.fow.fow) ? inn.fow.fow : [];
  if (fows.length > 0) {
    fows.forEach((fw, idx) => {
      const chip = document.createElement('div');
      chip.className = 'fow-chip';
      chip.innerHTML = `
        <div class="fow-num">${idx + 1}</div>
        <div class="fow-info">
          <div class="fow-runs">${fw.runs}/${idx + 1}</div>
          <div class="fow-details">${escapeHtml(fw.batsmanname)} (${fw.overnbr} ov)</div>
        </div>
      `;
      fowGrid.appendChild(chip);
    });
  } else {
    fowGrid.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No wickets fell in this innings.</p>`;
  }

  // 5. Partnerships Breakdown
  const partnerContainer = document.getElementById(`partnerships-${innIndex}`);
  partnerContainer.innerHTML = '';
  const pList = (inn.partnership && inn.partnership.partnership) ? inn.partnership.partnership : [];
  if (pList.length > 0) {
    pList.forEach(pt => {
      if (pt.totalruns === 0 && pt.totalballs === 0) return;
      
      const totalRuns = pt.totalruns || 1;
      const b1Pct = Math.round(((pt.bat1runs || 0) / totalRuns) * 100);
      const b2Pct = 100 - b1Pct;

      const card = document.createElement('div');
      card.className = 'partnership-card';
      card.innerHTML = `
        <div class="partnership-header">
          <span>${escapeHtml(pt.bat1name)} (${pt.bat1runs}) & ${escapeHtml(pt.bat2name)} (${pt.bat2runs})</span>
          <strong style="color: var(--accent-emerald);">${pt.totalruns} runs (${pt.totalballs} b)</strong>
        </div>
        <div class="partnership-bar-container">
          <div class="partner-bar-1" style="width: ${b1Pct}%;" title="${pt.bat1name}: ${pt.bat1runs} runs"></div>
          <div class="partner-bar-2" style="width: ${b2Pct}%;" title="${pt.bat2name}: ${pt.bat2runs} runs"></div>
        </div>
        <div class="partnership-footer">
          <span>${escapeHtml(pt.bat1name)}: ${pt.bat1runs} (${pt.bat1balls}b, ${pt.bat1fours || 0}x4, ${pt.bat1sixes || 0}x6)</span>
          <span>${escapeHtml(pt.bat2name)}: ${pt.bat2runs} (${pt.bat2balls}b, ${pt.bat2fours || 0}x4, ${pt.bat2sixes || 0}x6)</span>
        </div>
      `;
      partnerContainer.appendChild(card);
    });
  } else {
    partnerContainer.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No partnership data recorded.</p>`;
  }
}

// Calculate Top Match Highlights
function calculateMatchHighlights(scorecard) {
  let topBatter = { name: 'N/A', runs: 0, balls: 0 };
  let bestBowler = { name: 'N/A', wickets: 0, runs: 999 };
  let totalFours = 0;
  let totalSixes = 0;

  scorecard.forEach(inn => {
    (inn.batsman || []).forEach(b => {
      totalFours += (b.fours || 0);
      totalSixes += (b.sixes || 0);
      if (b.runs > topBatter.runs) {
        topBatter = { name: b.name, runs: b.runs, balls: b.balls };
      }
    });

    (inn.bowler || []).forEach(bw => {
      if (bw.wickets > bestBowler.wickets || (bw.wickets === bestBowler.wickets && bw.runs < bestBowler.runs)) {
        bestBowler = { name: bw.name, wickets: bw.wickets, runs: bw.runs };
      }
    });
  });

  document.getElementById('topScorerHighlight').innerText = `${topBatter.name} (${topBatter.runs} off ${topBatter.balls})`;
  document.getElementById('bestBowlerHighlight').innerText = `${bestBowler.name} (${bestBowler.wickets}/${bestBowler.runs})`;
  document.getElementById('matchBoundariesHighlight').innerText = `${totalFours} Fours, ${totalSixes} Sixes`;
}

// Render Analytics Charts using Chart.js
function renderAnalyticsCharts(data) {
  const scorecard = data.scorecard || [];
  if (scorecard.length < 2) return;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#9ca3af' : '#4b5563';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // Calculate Boundaries for each team
  let team1Fours = 0, team1Sixes = 0;
  let team2Fours = 0, team2Sixes = 0;

  (scorecard[0].batsman || []).forEach(b => {
    team1Fours += (b.fours || 0);
    team1Sixes += (b.sixes || 0);
  });
  (scorecard[1].batsman || []).forEach(b => {
    team2Fours += (b.fours || 0);
    team2Sixes += (b.sixes || 0);
  });

  const team1Name = scorecard[0].batteamsname || scorecard[0].batteamname;
  const team2Name = scorecard[1].batteamsname || scorecard[1].batteamname;

  // Chart 1: Boundary Breakdown (Pie / Doughnut Chart)
  const ctxBoundaries = document.getElementById('chartBoundaries').getContext('2d');
  if (chartBoundariesInstance) chartBoundariesInstance.destroy();

  chartBoundariesInstance = new Chart(ctxBoundaries, {
    type: 'doughnut',
    data: {
      labels: [`${team1Name} 4s`, `${team1Name} 6s`, `${team2Name} 4s`, `${team2Name} 6s`],
      datasets: [{
        data: [team1Fours, team1Sixes, team2Fours, team2Sixes],
        backgroundColor: ['#10b981', '#059669', '#3b82f6', '#1d4ed8'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'Inter', size: 12 } }
        }
      }
    }
  });

  // Chart 2: Team Score & Wickets Comparison (Bar Chart)
  const ctxComparison = document.getElementById('chartComparison').getContext('2d');
  if (chartComparisonInstance) chartComparisonInstance.destroy();

  chartComparisonInstance = new Chart(ctxComparison, {
    type: 'bar',
    data: {
      labels: ['Total Runs', 'Wickets Lost', 'Extras Given'],
      datasets: [
        {
          label: team1Name,
          data: [scorecard[0].score, scorecard[0].wickets, scorecard[0].extras?.total || 0],
          backgroundColor: '#10b981',
          borderRadius: 6
        },
        {
          label: team2Name,
          data: [scorecard[1].score, scorecard[1].wickets, scorecard[1].extras?.total || 0],
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor } }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'Inter', size: 12 } }
        }
      }
    }
  });
}

// Utility Toast Notifications
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') {
    toast.style.borderColor = 'var(--accent-red)';
    toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-red)"></i> <span>${escapeHtml(msg)}</span>`;
  } else {
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--accent-emerald)"></i> <span>${escapeHtml(msg)}</span>`;
  }
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Fallback Embedded JSON object in case CORS blocks fetch on file://
const FALLBACK_SCORECARD_DATA = {
  "scorecard": [
    {
      "inningsid": 1,
      "score": 150,
      "wickets": 10,
      "overs": 18.5,
      "runrate": "7.96",
      "batteamname": "Ireland",
      "batteamsname": "IRE",
      "batsman": [
        { "id": 1114, "name": "Stirling", "runs": 5, "balls": 5, "fours": 1, "sixes": 0, "strkrate": "100", "outdec": "lbw b Nisarg Patel", "iscaptain": false, "iskeeper": false },
        { "id": 6710, "name": "Balbirnie", "runs": 10, "balls": 5, "fours": 2, "sixes": 0, "strkrate": "200", "outdec": "c Sushant Modani b Netravalkar", "iscaptain": true, "iskeeper": false },
        { "id": 11131, "name": "Lorcan Tucker", "runs": 84, "balls": 56, "fours": 9, "sixes": 3, "strkrate": "150", "outdec": "b Netravalkar", "iscaptain": false, "iskeeper": false },
        { "id": 18143, "name": "Curtis Campher", "runs": 17, "balls": 11, "fours": 2, "sixes": 1, "strkrate": "154.55", "outdec": "c Marty Kain b Yasir Mohammad", "iscaptain": false, "iskeeper": false },
        { "id": 6471, "name": "Getkate", "runs": 5, "balls": 10, "fours": 0, "sixes": 0, "strkrate": "50", "outdec": "c Ritwik Behera b Vatsal Vaghela", "iscaptain": false, "iskeeper": false },
        { "id": 13309, "name": "Neil Rock", "runs": 4, "balls": 5, "fours": 0, "sixes": 0, "strkrate": "80", "outdec": "c Ritwik Behera b Vatsal Vaghela", "iscaptain": false, "iskeeper": true },
        { "id": 11129, "name": "William McClintock", "runs": 1, "balls": 3, "fours": 0, "sixes": 0, "strkrate": "33.33", "outdec": "c Marty Kain b Nisarg Patel", "iscaptain": false, "iskeeper": false },
        { "id": 10449, "name": "Mark Adair", "runs": 3, "balls": 4, "fours": 0, "sixes": 0, "strkrate": "75", "outdec": "b Netravalkar", "iscaptain": false, "iskeeper": false },
        { "id": 12769, "name": "Barry McCarthy", "runs": 0, "balls": 1, "fours": 0, "sixes": 0, "strkrate": "0", "outdec": "run out (Nisarg Patel/Monank Patel)", "iscaptain": false, "iskeeper": false },
        { "id": 13915, "name": "Ben White", "runs": 5, "balls": 6, "fours": 1, "sixes": 0, "strkrate": "83.33", "outdec": "not out", "iscaptain": false, "iskeeper": false },
        { "id": 11843, "name": "Young", "runs": 10, "balls": 7, "fours": 1, "sixes": 0, "strkrate": "142.86", "outdec": "run out (Monank Patel)", "iscaptain": false, "iskeeper": false }
      ],
      "bowler": [
        { "id": 9748, "name": "Netravalkar", "overs": "3.5", "maidens": 0, "runs": 33, "wickets": 3, "economy": "8.61", "dots": 11 },
        { "id": 15475, "name": "Nisarg Patel", "overs": "4", "maidens": 0, "runs": 22, "wickets": 2, "economy": "5.50", "dots": 9 },
        { "id": 22896, "name": "Ryan Scott", "overs": "1", "maidens": 0, "runs": 18, "wickets": 0, "economy": "18.00", "dots": 0 },
        { "id": 22901, "name": "Yasir Mohammad", "overs": "4", "maidens": 0, "runs": 34, "wickets": 1, "economy": "8.50", "dots": 9 },
        { "id": 22899, "name": "Vatsal Vaghela", "overs": "4", "maidens": 0, "runs": 16, "wickets": 2, "economy": "4.00", "dots": 13 },
        { "id": 10699, "name": "Marty Kain", "overs": "2", "maidens": 0, "runs": 22, "wickets": 0, "economy": "11.00", "dots": 2 }
      ],
      "extras": { "legbyes": 1, "byes": 0, "wides": 5, "noballs": 0, "penalty": 0, "total": 6 },
      "pp": { "powerplay": [{ "id": 27, "ovrfrom": 0.1, "ovrto": 6, "pptype": "Mandatory", "run": 44, "wickets": 2 }] },
      "fow": {
        "fow": [
          { "batsmanname": "Stirling", "overnbr": 0.5, "runs": 5 },
          { "batsmanname": "Balbirnie", "overnbr": 1.5, "runs": 16 },
          { "batsmanname": "Curtis Campher", "overnbr": 4.1, "runs": 44 },
          { "batsmanname": "Getkate", "overnbr": 8.3, "runs": 71 },
          { "batsmanname": "Neil Rock", "overnbr": 10.1, "runs": 84 },
          { "batsmanname": "William McClintock", "overnbr": 11.2, "runs": 89 },
          { "batsmanname": "Lorcan Tucker", "overnbr": 16.5, "runs": 128 },
          { "batsmanname": "Mark Adair", "overnbr": 16.6, "runs": 128 },
          { "batsmanname": "Barry McCarthy", "overnbr": 17.1, "runs": 129 },
          { "batsmanname": "Young", "overnbr": 18.5, "runs": 150 }
        ]
      },
      "partnership": {
        "partnership": [
          { "bat1name": "Stirling", "bat1runs": 5, "bat1balls": 5, "bat2name": "Balbirnie", "bat2runs": 0, "bat2balls": 0, "totalruns": 5, "totalballs": 5 },
          { "bat1name": "Balbirnie", "bat1runs": 10, "bat1balls": 4, "bat2name": "Lorcan Tucker", "bat2runs": 1, "bat2balls": 2, "totalruns": 11, "totalballs": 6 },
          { "bat1name": "Curtis Campher", "bat1runs": 17, "bat1balls": 11, "bat2name": "Lorcan Tucker", "bat2runs": 11, "bat2balls": 3, "totalruns": 28, "totalballs": 14 },
          { "bat1name": "Getkate", "bat1runs": 5, "bat1balls": 10, "bat2name": "Lorcan Tucker", "bat2runs": 22, "bat2balls": 16, "totalruns": 27, "totalballs": 26 },
          { "bat1name": "Neil Rock", "bat1runs": 4, "bat1balls": 5, "bat2name": "Lorcan Tucker", "bat2runs": 9, "bat2balls": 5, "totalruns": 13, "totalballs": 10 },
          { "bat1name": "William McClintock", "bat1runs": 1, "bat1balls": 3, "bat2name": "Lorcan Tucker", "bat2runs": 4, "bat2balls": 4, "totalruns": 5, "totalballs": 7 },
          { "bat1name": "Lorcan Tucker", "bat1runs": 37, "bat1balls": 26, "bat2name": "Mark Adair", "bat2runs": 2, "bat2balls": 7, "totalruns": 39, "totalballs": 33 },
          { "bat1name": "Barry McCarthy", "bat1runs": 0, "bat1balls": 1, "bat2name": "Young", "bat2runs": 0, "bat2balls": 0, "totalruns": 1, "totalballs": 1 },
          { "bat1name": "Young", "bat1runs": 10, "bat1balls": 7, "bat2name": "Ben White", "bat2runs": 5, "bat2balls": 6, "totalruns": 21, "totalballs": 13 }
        ]
      }
    },
    {
      "inningsid": 2,
      "score": 141,
      "wickets": 7,
      "overs": 20,
      "runrate": "7.05",
      "batteamname": "United States",
      "batteamsname": "USA",
      "batsman": [
        { "id": 22896, "name": "Ryan Scott", "runs": 11, "balls": 11, "fours": 2, "sixes": 0, "strkrate": "100", "outdec": "c Ben White b Curtis Campher", "iscaptain": false, "iskeeper": false },
        { "id": 22891, "name": "Ritwik Behera", "runs": 16, "balls": 23, "fours": 1, "sixes": 0, "strkrate": "69.57", "outdec": "c Ben White b Getkate", "iscaptain": false, "iskeeper": false },
        { "id": 14732, "name": "Monank Patel", "runs": 26, "balls": 27, "fours": 2, "sixes": 1, "strkrate": "96.30", "outdec": "c Balbirnie b Ben White", "iscaptain": true, "iskeeper": false },
        { "id": 12788, "name": "Gajanand Singh", "runs": 22, "balls": 20, "fours": 1, "sixes": 1, "strkrate": "110", "outdec": "c Lorcan Tucker b Barry McCarthy", "iscaptain": false, "iskeeper": false },
        { "id": 20217, "name": "Sushant Modani", "runs": 27, "balls": 16, "fours": 1, "sixes": 2, "strkrate": "168.75", "outdec": "c Getkate b Barry McCarthy", "iscaptain": false, "iskeeper": false },
        { "id": 10699, "name": "Marty Kain", "runs": 11, "balls": 11, "fours": 1, "sixes": 0, "strkrate": "100", "outdec": "b Young", "iscaptain": false, "iskeeper": false },
        { "id": 22901, "name": "Yasir Mohammad", "runs": 0, "balls": 2, "fours": 0, "sixes": 0, "strkrate": "0", "outdec": "c Neil Rock b Young", "iscaptain": false, "iskeeper": false },
        { "id": 15475, "name": "Nisarg Patel", "runs": 10, "balls": 6, "fours": 2, "sixes": 0, "strkrate": "166.67", "outdec": "not out", "iscaptain": false, "iskeeper": false },
        { "id": 9748, "name": "Netravalkar", "runs": 5, "balls": 6, "fours": 0, "sixes": 0, "strkrate": "83.33", "outdec": "not out", "iscaptain": false, "iskeeper": false }
      ],
      "bowler": [
        { "id": 10449, "name": "Mark Adair", "overs": "4", "maidens": 0, "runs": 28, "wickets": 0, "economy": "7.00", "dots": 10 },
        { "id": 11843, "name": "Young", "overs": "4", "maidens": 0, "runs": 24, "wickets": 2, "economy": "6.00", "dots": 12 },
        { "id": 18143, "name": "Curtis Campher", "overs": "4", "maidens": 0, "runs": 25, "wickets": 1, "economy": "6.25", "dots": 10 },
        { "id": 12769, "name": "Barry McCarthy", "overs": "4", "maidens": 0, "runs": 23, "wickets": 2, "economy": "5.75", "dots": 11 },
        { "id": 13915, "name": "Ben White", "overs": "3", "maidens": 0, "runs": 29, "wickets": 1, "economy": "9.67", "dots": 5 },
        { "id": 6471, "name": "Getkate", "overs": "1", "maidens": 0, "runs": 8, "wickets": 1, "economy": "8.00", "dots": 2 }
      ],
      "extras": { "legbyes": 4, "byes": 1, "wides": 6, "noballs": 2, "penalty": 0, "total": 13 },
      "pp": { "powerplay": [{ "id": 28, "ovrfrom": 0.1, "ovrto": 6, "pptype": "Mandatory", "run": 34, "wickets": 0 }] },
      "fow": {
        "fow": [
          { "batsmanname": "Ryan Scott", "overnbr": 3, "runs": 20 },
          { "batsmanname": "Ritwik Behera", "overnbr": 7.2, "runs": 40 },
          { "batsmanname": "Monank Patel", "overnbr": 11.4, "runs": 68 },
          { "batsmanname": "Gajanand Singh", "overnbr": 14.3, "runs": 89 },
          { "batsmanname": "Sushant Modani", "overnbr": 17.3, "runs": 122 },
          { "batsmanname": "Marty Kain", "overnbr": 17.4, "runs": 122 },
          { "batsmanname": "Yasir Mohammad", "overnbr": 17.6, "runs": 123 }
        ]
      },
      "partnership": {
        "partnership": [
          { "bat1name": "Ritwik Behera", "bat1runs": 6, "bat1balls": 7, "bat2name": "Ryan Scott", "bat2runs": 11, "bat2balls": 11, "totalruns": 20, "totalballs": 18 },
          { "bat1name": "Ritwik Behera", "bat1runs": 10, "bat1balls": 16, "bat2name": "Monank Patel", "bat2runs": 10, "bat2balls": 10, "totalruns": 20, "totalballs": 26 },
          { "bat1name": "Gajanand Singh", "bat1runs": 8, "bat1balls": 10, "bat2name": "Monank Patel", "bat2runs": 16, "bat2balls": 17, "totalruns": 28, "totalballs": 27 },
          { "bat1name": "Gajanand Singh", "bat1runs": 14, "bat1balls": 10, "bat2name": "Sushant Modani", "bat2runs": 7, "bat2balls": 7, "totalruns": 21, "totalballs": 17 },
          { "bat1name": "Marty Kain", "bat1runs": 11, "bat1balls": 10, "bat2name": "Sushant Modani", "bat2runs": 20, "bat2balls": 9, "totalruns": 33, "totalballs": 19 },
          { "bat1name": "Marty Kain", "bat1runs": 0, "bat1balls": 1, "bat2name": "Nisarg Patel", "bat2runs": 0, "bat2balls": 0, "totalruns": 0, "totalballs": 1 },
          { "bat1name": "Yasir Mohammad", "bat1runs": 0, "bat1balls": 2, "bat2name": "Nisarg Patel", "bat2runs": 0, "bat2balls": 0, "totalruns": 1, "totalballs": 2 },
          { "bat1name": "Netravalkar", "bat1runs": 5, "bat1balls": 6, "bat2name": "Nisarg Patel", "bat2runs": 10, "bat2balls": 6, "totalruns": 18, "totalballs": 12 }
        ]
      }
    }
  ],
  "status": "Ireland won by 9 runs",
  "ismatchcomplete": true,
  "appindex": {
    "seotitle": "Cricket scorecard - USA vs IRE 2nd T20I,Ireland tour of USA, 2021 | Cricbuzz.com",
    "weburl": "http://www.cricbuzz.com/live-cricket-scorecard/40381/usa-vs-ire-2nd-t20i-ireland-tour-of-usa-2021"
  }
};

/* ==========================================================================
   UPCOMING MATCHES ENGINE
   ========================================================================== */

async function ensureUpcomingMatchesLoaded() {
  if (allUpcomingMatches.length > 0) {
    renderUpcomingMatches();
    return;
  }
  await loadUpcomingMatches();
}

async function loadUpcomingMatches() {
  try {
    const response = await fetch('/api/cricbuzz/upcoming');
    if (response.ok) {
      const data = await response.json();
      if (data && data.typeMatches && data.typeMatches.length > 0) {
        upcomingData = data;
        allUpcomingMatches = parseUpcomingData(data);
        renderUpcomingMatches();
        return;
      }
    }
    showToast('No upcoming matches in database. Click "Sync Live API" to sync.', 'info');
  } catch (err) {
    console.error('Dynamic API endpoint error:', err);
    showToast('Error connecting to Cricbuzz API backend.', 'error');
  }
}

function parseUpcomingData(data) {
  const list = [];
  if (!data || !data.typeMatches) return list;

  data.typeMatches.forEach(typeGroup => {
    const matchType = typeGroup.matchType;
    (typeGroup.seriesMatches || []).forEach(seriesObj => {
      if (seriesObj.seriesAdWrapper && seriesObj.seriesAdWrapper.matches) {
        seriesObj.seriesAdWrapper.matches.forEach(m => {
          if (m.matchInfo) {
            list.push({
              ...m.matchInfo,
              matchTypeCategory: matchType,
              seriesNameGroup: seriesObj.seriesAdWrapper.seriesName || m.matchInfo.seriesName
            });
          }
        });
      }
    });
  });
  return list;
}

function renderUpcomingMatches() {
  const container = document.getElementById('upcomingMatchesGrid');
  if (!container) return;

  // Filter matches
  const filtered = allUpcomingMatches.filter(match => {
    // Type Filter
    if (currentUpcomingTypeFilter !== 'all' && match.matchTypeCategory !== currentUpcomingTypeFilter) {
      return false;
    }
    // Format Filter
    if (currentUpcomingFormatFilter !== 'all' && match.matchFormat !== currentUpcomingFormatFilter) {
      return false;
    }
    // Search Term
    if (currentUpcomingSearchTerm) {
      const t1 = (match.team1?.teamName || '').toLowerCase();
      const t1s = (match.team1?.teamSName || '').toLowerCase();
      const t2 = (match.team2?.teamName || '').toLowerCase();
      const t2s = (match.team2?.teamSName || '').toLowerCase();
      const series = (match.seriesName || '').toLowerCase();
      const ground = (match.venueInfo?.ground || '').toLowerCase();
      const city = (match.venueInfo?.city || '').toLowerCase();
      const format = (match.matchFormat || '').toLowerCase();
      const desc = (match.matchDesc || '').toLowerCase();

      const combined = `${t1} ${t1s} ${t2} ${t2s} ${series} ${ground} ${city} ${format} ${desc}`;
      if (!combined.includes(currentUpcomingSearchTerm)) return false;
    }
    return true;
  });

  // Update counters
  updateUpcomingCounts(filtered);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="upcoming-empty-state">
        <div class="empty-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
        <h3>No Upcoming Matches Found</h3>
        <p>No fixtures match your current filter settings or search query.</p>
        <button class="btn btn-secondary" id="btnResetUpcomingFilters">
          <i class="fa-solid fa-rotate-left"></i> Reset Filters
        </button>
      </div>
    `;
    const btnReset = document.getElementById('btnResetUpcomingFilters');
    if (btnReset) {
      btnReset.addEventListener('click', resetUpcomingFilters);
    }
    return;
  }

  // Render cards
  container.innerHTML = filtered.map(match => createUpcomingMatchCardHtml(match)).join('');
}

function resetUpcomingFilters() {
  currentUpcomingTypeFilter = 'all';
  currentUpcomingFormatFilter = 'all';
  currentUpcomingSearchTerm = '';
  
  const searchInput = document.getElementById('upcomingSearchInput');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('#upcomingTypeFilters .filter-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-type') === 'all');
  });
  document.querySelectorAll('#upcomingFormatFilters .filter-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-format') === 'all');
  });

  renderUpcomingMatches();
}

function updateUpcomingCounts(filteredMatches) {
  // Badge on tab & main site nav
  const tabBadge = document.getElementById('tabBadgeUpcoming');
  if (tabBadge) tabBadge.innerText = allUpcomingMatches.length;
  const navBadge = document.getElementById('navBadgeUpcoming');
  if (navBadge) navBadge.innerText = allUpcomingMatches.length;

  // Type Pills counts
  const countAll = document.getElementById('countAll');
  if (countAll) countAll.innerText = allUpcomingMatches.length;

  const countInt = document.getElementById('countInt');
  if (countInt) countInt.innerText = allUpcomingMatches.filter(m => m.matchTypeCategory === 'International').length;

  const countLeague = document.getElementById('countLeague');
  if (countLeague) countLeague.innerText = allUpcomingMatches.filter(m => m.matchTypeCategory === 'League').length;

  const countDomestic = document.getElementById('countDomestic');
  if (countDomestic) countDomestic.innerText = allUpcomingMatches.filter(m => m.matchTypeCategory === 'Domestic').length;

  const countWomen = document.getElementById('countWomen');
  if (countWomen) countWomen.innerText = allUpcomingMatches.filter(m => m.matchTypeCategory === 'Women').length;

  // Stats Grid
  const totalMatchesEl = document.getElementById('statTotalMatches');
  if (totalMatchesEl) totalMatchesEl.innerText = filteredMatches.length;

  const seriesSet = new Set(filteredMatches.map(m => m.seriesName));
  const seriesEl = document.getElementById('statSeriesCount');
  if (seriesEl) seriesEl.innerText = seriesSet.size;

  const teamsSet = new Set();
  filteredMatches.forEach(m => {
    if (m.team1?.teamName) teamsSet.add(m.team1.teamName);
    if (m.team2?.teamName) teamsSet.add(m.team2.teamName);
  });
  const teamsEl = document.getElementById('statTeamsCount');
  if (teamsEl) teamsEl.innerText = teamsSet.size;

  const venuesSet = new Set(filteredMatches.map(m => m.venueInfo?.ground).filter(Boolean));
  const venuesEl = document.getElementById('statVenuesCount');
  if (venuesEl) venuesEl.innerText = venuesSet.size;
}

function getTeamFlagUrl(team) {
  if (!team) return null;
  if (team.imageId) {
    return `https://images.cricbuzz.com/i/v1/c${team.imageId}/i.jpg`;
  }
  const codeMap = {
    'IND': 'in', 'INDA': 'in', 'INDW': 'in',
    'AUS': 'au', 'AUSA': 'au', 'AUSW': 'au', 'AUSCH': 'au',
    'ENG': 'gb-eng', 'ENGW': 'gb-eng', 'ENGCH': 'gb-eng',
    'RSA': 'za', 'RSAW': 'za', 'SACH': 'za', 'BOL': 'za', 'ESTORM': 'za', 'BOR': 'za', 'DOL': 'za', 'WAR': 'za', 'NCAPE': 'za',
    'PAK': 'pk', 'PAKW': 'pk', 'PAKCH': 'pk',
    'NZ': 'nz', 'NZW': 'nz',
    'WI': 'jm', 'WIW': 'jm', 'WICH': 'jm',
    'SL': 'lk', 'SLW': 'lk',
    'BAN': 'bd', 'BANW': 'bd', 'BANCH': 'bd',
    'AFG': 'af', 'AFGW': 'af',
    'IRE': 'ie', 'IREW': 'ie',
    'USA': 'us', 'USAW': 'us',
    'OMAN': 'om', 'CAN': 'ca', 'NAM': 'na', 'UAE': 'ae', 'MLY': 'my', 'SAU': 'sa', 'HKC': 'hk', 'KUW': 'kw', 'BHR': 'bh', 'QAT': 'qa', 'MGL': 'mn', 'THAI': 'th', 'MMR': 'mm', 'MDV': 'mv', 'SIN': 'sg', 'CHN': 'cn'
  };
  const sName = (team.teamSName || '').toUpperCase();
  if (codeMap[sName]) {
    return `https://flagcdn.com/w80/${codeMap[sName]}.png`;
  }
  return null;
}

function createUpcomingMatchCardHtml(match) {
  const format = match.matchFormat || 'T20';
  const formatClass = format === 'TEST' ? 'badge-format-test' : (format === 'ODI' ? 'badge-format-odi' : 'badge-format-t20');

  const cat = match.matchTypeCategory || 'International';
  let catClass = 'badge-cat-int';
  if (cat === 'League') catClass = 'badge-cat-league';
  else if (cat === 'Domestic') catClass = 'badge-cat-domestic';
  else if (cat === 'Women') catClass = 'badge-cat-women';

  const t1 = match.team1 || { teamName: 'TBD', teamSName: 'TBD' };
  const t2 = match.team2 || { teamName: 'TBD', teamSName: 'TBD' };

  const t1Flag = getTeamFlagUrl(t1);
  const t2Flag = getTeamFlagUrl(t2);

  const t1AvatarHtml = t1Flag 
    ? `<img src="${t1Flag}" class="team-flag-img" alt="${t1.teamName}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="team-avatar" style="display:none;">${t1.teamSName ? t1.teamSName.substring(0,3) : 'T1'}</div>`
    : `<div class="team-avatar">${t1.teamSName ? t1.teamSName.substring(0, 3) : 'T1'}</div>`;

  const t2AvatarHtml = t2Flag 
    ? `<img src="${t2Flag}" class="team-flag-img" alt="${t2.teamName}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="team-avatar avatar-secondary" style="display:none;">${t2.teamSName ? t2.teamSName.substring(0,3) : 'T2'}</div>`
    : `<div class="team-avatar avatar-secondary">${t2.teamSName ? t2.teamSName.substring(0, 3) : 'T2'}</div>`;

  const ground = match.venueInfo?.ground || 'TBD Venue';
  const city = match.venueInfo?.city || '';
  const timezone = match.venueInfo?.timezone ? `(UTC${match.venueInfo.timezone})` : '';
  const venueStr = city ? `${ground}, ${city} ${timezone}` : `${ground} ${timezone}`;

  // Start Date formatting
  let dateFormatted = match.status || match.hideScoreStatus || '';
  let timeUntilStr = '';
  if (match.startDate) {
    const d = new Date(parseInt(match.startDate));
    if (!isNaN(d.getTime())) {
      dateFormatted = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      const now = new Date();
      const diffMs = d - now;
      if (diffMs > 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays > 0) {
          timeUntilStr = `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
        } else {
          timeUntilStr = `Starts in ${diffHours} hr${diffHours > 1 ? 's' : ''}`;
        }
      }
    }
  }

  const statusText = match.status || match.hideScoreStatus || 'Upcoming';

  return `
    <div class="upcoming-match-card">
      <div class="upcoming-card-header">
        <div class="badges-row">
          <span class="match-badge ${formatClass}">${format}</span>
          <span class="match-badge ${catClass}">${cat}</span>
        </div>
        <div class="match-desc-badge">${match.matchDesc || 'Match'}</div>
      </div>

      <div class="series-name-row" title="${match.seriesName || ''}">
        <i class="fa-solid fa-trophy"></i> <span>${match.seriesName || 'Series'}</span>
      </div>

      <div class="upcoming-teams-container">
        <!-- Team 1 -->
        <div class="upcoming-team-item">
          ${t1AvatarHtml}
          <div class="team-info">
            <span class="team-full">${t1.teamName}</span>
            <span class="team-short">${t1.teamSName}</span>
          </div>
        </div>

        <div class="upcoming-vs-badge">
          <span>VS</span>
        </div>

        <!-- Team 2 -->
        <div class="upcoming-team-item team-right">
          <div class="team-info">
            <span class="team-full">${t2.teamName}</span>
            <span class="team-short">${t2.teamSName}</span>
          </div>
          ${t2AvatarHtml}
        </div>
      </div>

      <div class="upcoming-card-footer">
        <div class="meta-item" title="${statusText}">
          <i class="fa-solid fa-clock"></i>
          <span>${dateFormatted}</span>
        </div>
        ${timeUntilStr ? `<div class="meta-item countdown-tag"><i class="fa-solid fa-hourglass-half"></i> ${timeUntilStr}</div>` : ''}
        <div class="meta-item" title="${venueStr}">
          <i class="fa-solid fa-location-dot"></i>
          <span>${venueStr}</span>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   COMPLETED MATCHES ENGINE
   ========================================================================== */

async function ensureCompletedMatchesLoaded() {
  if (allCompletedMatches.length > 0) {
    renderCompletedMatches();
    return;
  }
  await loadCompletedMatches();
}

async function loadCompletedMatches() {
  try {
    const response = await fetch('/api/cricbuzz/completed');
    if (response.ok) {
      const data = await response.json();
      allCompletedMatches = data.matches || [];
      const tabBadge = document.getElementById('tabBadgeCompleted');
      if (tabBadge) tabBadge.innerText = allCompletedMatches.length;
      renderCompletedMatches();
    }
  } catch (err) {
    console.error('Failed to load completed matches:', err);
  }
}

function renderCompletedMatches() {
  const container = document.getElementById('completedMatchesGrid');
  if (!container) return;

  const tabBadge = document.getElementById('tabBadgeCompleted');
  if (tabBadge) tabBadge.innerText = allCompletedMatches.length;
  const navBadge = document.getElementById('navBadgeCompleted');
  if (navBadge) navBadge.innerText = allCompletedMatches.length;

  const filtered = allCompletedMatches.filter(m => {
    if (!currentCompletedSearchTerm) return true;
    const t1 = (m.team1_name || '').toLowerCase();
    const t2 = (m.team2_name || '').toLowerCase();
    const series = (m.series_name || '').toLowerCase();
    const status = (m.status || '').toLowerCase();
    const venue = (m.venue_ground || '').toLowerCase();

    return `${t1} ${t2} ${series} ${status} ${venue}`.includes(currentCompletedSearchTerm);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="upcoming-empty-state">
        <div class="empty-icon"><i class="fa-solid fa-circle-xmark"></i></div>
        <h3>No Completed Matches Found</h3>
        <p>No completed match records stored in database yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(m => {
    const t1 = { teamName: m.team1_name, teamSName: m.team1_sname, imageId: m.team1_image_id };
    const t2 = { teamName: m.team2_name, teamSName: m.team2_sname, imageId: m.team2_image_id };

    const t1Flag = getTeamFlagUrl(t1);
    const t2Flag = getTeamFlagUrl(t2);

    const t1Avatar = t1Flag 
      ? `<img src="${t1Flag}" class="team-flag-img" alt="${t1.teamName}" onerror="this.style.display='none';"><div class="team-avatar" style="display:none;">${t1.teamSName ? t1.teamSName.substring(0,3) : 'T1'}</div>`
      : `<div class="team-avatar">${t1.teamSName ? t1.teamSName.substring(0, 3) : 'T1'}</div>`;

    const t2Avatar = t2Flag 
      ? `<img src="${t2Flag}" class="team-flag-img" alt="${t2.teamName}" onerror="this.style.display='none';"><div class="team-avatar avatar-secondary" style="display:none;">${t2.teamSName ? t2.teamSName.substring(0,3) : 'T2'}</div>`
      : `<div class="team-avatar avatar-secondary">${t2.teamSName ? t2.teamSName.substring(0, 3) : 'T2'}</div>`;

    const isSelected = (currentLoadedMatchId == m.match_id);
    const hasScorecardInDb = !!(m.scorecard);

    return `
      <div class="upcoming-match-card completed-card ${isSelected ? 'active-selected' : ''}" 
           data-match-id="${m.match_id}" 
           onclick="selectMatchScorecard(${m.match_id})"
           title="Click to view full match scorecard">
        <div class="upcoming-card-header">
          <div class="badges-row">
            <span class="match-badge badge-format-t20">${m.match_format || 'T20'}</span>
            <span class="match-badge badge-cat-int">${m.match_type || 'Result'}</span>
          </div>
          <div class="card-status-badges">
            ${hasScorecardInDb 
              ? '<span class="scorecard-ready-tag" title="Scorecard cached in MySQL DB"><i class="fa-solid fa-circle-check"></i> Scorecard Cached</span>' 
              : '<span class="scorecard-live-tag" title="Auto-fetches from RapidAPI into DB"><i class="fa-solid fa-bolt"></i> Live Scorecard</span>'}
            <div class="match-desc-badge">${m.match_desc || 'Match'}</div>
          </div>
        </div>

        <div class="series-name-row" title="${m.series_name || ''}">
          <i class="fa-solid fa-trophy"></i> <span>${m.series_name || 'Series'}</span>
        </div>

        <div class="upcoming-teams-container">
          <div class="upcoming-team-item">
            ${t1Avatar}
            <div class="team-info">
              <span class="team-full">${m.team1_name}</span>
              <span class="team-short">${m.team1_sname}</span>
            </div>
          </div>
          <div class="upcoming-vs-badge">
            <span>VS</span>
          </div>
          <div class="upcoming-team-item team-right">
            <div class="team-info">
              <span class="team-full">${m.team2_name}</span>
              <span class="team-short">${m.team2_sname}</span>
            </div>
            ${t2Avatar}
          </div>
        </div>

        <div class="upcoming-card-footer">
          <div class="meta-item result-status-tag" style="color: var(--accent-emerald); font-weight: 700;">
            <i class="fa-solid fa-trophy"></i>
            <span>${m.status || 'Match Complete'}</span>
          </div>
          <div class="meta-item">
            <i class="fa-solid fa-location-dot"></i>
            <span>${m.venue_ground || 'Venue'}, ${m.venue_city || ''}</span>
          </div>
        </div>

        <div class="completed-card-actions">
          <button type="button" class="btn-card-scorecard" onclick="event.stopPropagation(); selectMatchScorecard(${m.match_id});">
            <i class="fa-solid fa-chart-simple"></i>
            <span>${isSelected ? 'Viewing Scorecard' : 'View Full Scorecard'}</span>
            <i class="fa-solid fa-arrow-right btn-arrow-icon"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Select and load scorecard for any completed match
async function selectMatchScorecard(matchId) {
  if (!matchId) return;

  const card = document.querySelector(`.completed-card[data-match-id="${matchId}"]`);
  const allCards = document.querySelectorAll('.completed-card');

  try {
    if (card) {
      card.classList.add('loading-card');
    }
    showToast(`Loading scorecard for Match #${matchId}...`, 'info');

    const res = await fetch(`/api/cricbuzz/scorecard/${matchId}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Scorecard not available (Status ${res.status})`);
    }

    const data = await res.json();
    if (!data || (!data.scorecard && !Array.isArray(data))) {
      throw new Error('Scorecard data is not available yet for this match.');
    }

    const payload = data.scorecard ? data : { scorecard: data };
    matchData = payload;
    currentLoadedMatchId = matchId;

    // Render the new scorecard
    renderScorecard(payload);

    // Update active highlight across cards
    allCards.forEach(c => c.classList.remove('active-selected'));
    if (card) card.classList.add('active-selected');

    // Update active highlight in live ticker
    document.querySelectorAll('.ticker-item').forEach(ti => {
      ti.classList.toggle('active-ticker', ti.getAttribute('data-ticker-id') == matchId);
    });

    // Switch to Scorecard Section and Innings 1 sub-tab
    switchSection('section-scorecard');
    switchMatchSubTab('tab-innings-1');

    // Scroll to the top hero section so user sees the match header and innings
    const heroSection = document.querySelector('.match-hero') || document.querySelector('.app-header');
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    showToast(`Scorecard loaded successfully!`, 'success');
  } catch (err) {
    console.error(`Failed to load scorecard for match ${matchId}:`, err);
    showToast(`Scorecard: ${err.message}`, 'error');
  } finally {
    if (card) {
      card.classList.remove('loading-card');
    }
  }
}

// Section Switching (Scorecard, Recent Matches, Upcoming, Series)
function switchSection(sectionId) {
  // Update site navigation buttons
  document.querySelectorAll('.site-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-section') === sectionId);
  });

  // Update main sections
  document.querySelectorAll('.app-main-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === sectionId);
  });

  // Trigger loads based on section
  if (sectionId === 'section-completed') {
    ensureCompletedMatchesLoaded();
    history.replaceState(null, '', '#completed');
  } else if (sectionId === 'section-upcoming') {
    ensureUpcomingMatchesLoaded();
    history.replaceState(null, '', '#upcoming');
  } else if (sectionId === 'section-series') {
    ensureSeriesLoaded();
    history.replaceState(null, '', '#series');
  } else if (sectionId === 'section-scorecard') {
    history.replaceState(null, '', '#scorecard');
  }
}

// Scoped Match Sub-Tab Switching (Innings 1, Innings 2, Match Info, Analytics)
function switchMatchSubTab(subTabId) {
  // Ensure we are inside scorecard section
  const scorecardSection = document.getElementById('section-scorecard');
  if (scorecardSection && !scorecardSection.classList.contains('active')) {
    switchSection('section-scorecard');
  }

  // Update sub-nav buttons
  document.querySelectorAll('.sub-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-subtab') === subTabId);
  });

  // Update sub-views inside scorecard
  document.querySelectorAll('#section-scorecard .scorecard-view').forEach(view => {
    view.classList.toggle('active', view.id === subTabId);
  });

  if (subTabId === 'tab-match-info' && matchData) {
    renderMatchInfo(matchData);
  }
  if (subTabId === 'tab-analytics' && matchData) {
    renderAnalyticsCharts(matchData);
  }
}

// Unified switchTab for backwards compatibility
function switchTab(targetId) {
  if (targetId === 'tab-completed' || targetId === 'section-completed') {
    switchSection('section-completed');
  } else if (targetId === 'tab-upcoming' || targetId === 'section-upcoming') {
    switchSection('section-upcoming');
  } else if (targetId === 'tab-series' || targetId === 'section-series') {
    switchSection('section-series');
  } else {
    switchSection('section-scorecard');
    switchMatchSubTab(targetId);
  }
}

function handleUrlHash() {
  const hash = (window.location.hash || '').replace('#', '').toLowerCase();
  if (hash === 'series' || hash === 'tournaments') {
    switchSection('section-series');
  } else if (hash === 'upcoming') {
    switchSection('section-upcoming');
  } else if (hash === 'completed' || hash === 'recent' || hash === 'results') {
    switchSection('section-completed');
  } else if (hash === 'matchinfo' || hash === 'match-info' || hash === 'info') {
    switchSection('section-scorecard');
    switchMatchSubTab('tab-match-info');
  } else if (hash === 'analytics') {
    switchSection('section-scorecard');
    switchMatchSubTab('tab-analytics');
  } else if (hash === 'innings2' || hash === 'innings-2') {
    switchSection('section-scorecard');
    switchMatchSubTab('tab-innings-2');
  } else {
    // Default: Scorecard section with Innings 1
    switchSection('section-scorecard');
    switchMatchSubTab('tab-innings-1');
  }
}

// Return to Completed Matches tab
function goToCompletedMatches() {
  switchSection('section-completed');
  const compSection = document.getElementById('section-completed');
  if (compSection) {
    compSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ==========================================================================
   UPCOMING TOURNAMENTS & SERIES ENGINE
   ========================================================================== */

async function ensureSeriesLoaded() {
  if (allSeriesData.length > 0) {
    renderSeries();
    return;
  }
  await loadSeriesData();
}

async function loadSeriesData() {
  try {
    const response = await fetch('/api/cricbuzz/series');
    if (response.ok) {
      const data = await response.json();
      if (data && data.series) {
        allSeriesData = data.series;
        populateSeriesMonthFilter(data.months || []);
        updateSeriesTabBadge(allSeriesData.length);
        renderSeries();
        return;
      }
    }
    // Fallback to series.json if API fails
    const fallbackRes = await fetch('/series.json');
    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      allSeriesData = parseFallbackSeriesJson(fbData);
      populateSeriesMonthFilter([]);
      updateSeriesTabBadge(allSeriesData.length);
      renderSeries();
      return;
    }
  } catch (err) {
    console.error('Series data loading error:', err);
    try {
      const fallbackRes = await fetch('/series.json');
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        allSeriesData = parseFallbackSeriesJson(fbData);
        populateSeriesMonthFilter([]);
        updateSeriesTabBadge(allSeriesData.length);
        renderSeries();
      }
    } catch (e) {
      showToast('Error loading tournaments and series.', 'error');
    }
  }
}

function parseFallbackSeriesJson(data) {
  const list = [];
  if (!data) return list;
  for (const [cat, obj] of Object.entries(data)) {
    const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
    (obj.seriesMapProto || []).forEach(group => {
      const month = group.date;
      (group.series || []).forEach(s => {
        list.push({
          series_id: s.id,
          name: s.name,
          category: catName,
          month_group: month,
          start_date: s.startDt ? parseInt(s.startDt) : null,
          end_date: s.endDt ? parseInt(s.endDt) : null,
          match_count: 0
        });
      });
    });
  }
  return list;
}

function populateSeriesMonthFilter(months) {
  const select = document.getElementById('seriesMonthFilter');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="all">All Timeframes</option>';
  
  const uniqueMonths = months.length > 0 ? months : Array.from(new Set(allSeriesData.map(s => s.month_group).filter(Boolean)));
  uniqueMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });
  if (currentVal && uniqueMonths.includes(currentVal)) {
    select.value = currentVal;
  }
}

function updateSeriesTabBadge(count) {
  const tabBadge = document.getElementById('tabBadgeSeries');
  if (tabBadge) tabBadge.innerText = count;
}

function renderSeries() {
  const grid = document.getElementById('seriesGrid');
  if (!grid) return;

  const filtered = allSeriesData.filter(s => {
    // Category filter
    if (currentSeriesCategoryFilter !== 'all' && s.category?.toLowerCase() !== currentSeriesCategoryFilter.toLowerCase()) {
      return false;
    }
    // Month filter
    if (currentSeriesMonthFilter !== 'all' && s.month_group !== currentSeriesMonthFilter) {
      return false;
    }
    // Search query
    if (currentSeriesSearchTerm) {
      const name = (s.name || '').toLowerCase();
      const cat = (s.category || '').toLowerCase();
      const month = (s.month_group || '').toLowerCase();
      const combined = `${name} ${cat} ${month}`;
      if (!combined.includes(currentSeriesSearchTerm)) return false;
    }
    return true;
  });

  // Update counts
  updateSeriesCounts(filtered);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="upcoming-empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon"><i class="fa-solid fa-trophy"></i></div>
        <h3>No Tournaments Found</h3>
        <p>No tournament or series matches your filter settings.</p>
        <button class="btn btn-secondary" onclick="resetSeriesFilters()">
          <i class="fa-solid fa-rotate-left"></i> Reset Filters
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(s => createSeriesCardHtml(s)).join('');
}

function resetSeriesFilters() {
  currentSeriesCategoryFilter = 'all';
  currentSeriesMonthFilter = 'all';
  currentSeriesSearchTerm = '';

  const searchInput = document.getElementById('seriesSearchInput');
  if (searchInput) searchInput.value = '';

  const monthSelect = document.getElementById('seriesMonthFilter');
  if (monthSelect) monthSelect.value = 'all';

  document.querySelectorAll('#seriesCategoryFilters .filter-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-category') === 'all');
  });

  renderSeries();
}

function updateSeriesCounts(filtered) {
  updateSeriesTabBadge(allSeriesData.length);

  const countAll = document.getElementById('countSeriesAll');
  if (countAll) countAll.innerText = allSeriesData.length;

  const countInt = document.getElementById('countSeriesInt');
  if (countInt) countInt.innerText = allSeriesData.filter(s => s.category?.toLowerCase() === 'international').length;

  const countLeague = document.getElementById('countSeriesLeague');
  if (countLeague) countLeague.innerText = allSeriesData.filter(s => s.category?.toLowerCase() === 'league').length;

  const countDomestic = document.getElementById('countSeriesDomestic');
  if (countDomestic) countDomestic.innerText = allSeriesData.filter(s => s.category?.toLowerCase() === 'domestic').length;

  const countWomen = document.getElementById('countSeriesWomen');
  if (countWomen) countWomen.innerText = allSeriesData.filter(s => s.category?.toLowerCase() === 'women').length;

  // Stats strip
  const statTotal = document.getElementById('statTotalSeries');
  if (statTotal) statTotal.innerText = filtered.length;

  const statInt = document.getElementById('statIntSeries');
  if (statInt) statInt.innerText = filtered.filter(s => s.category?.toLowerCase() === 'international').length;

  const statLeague = document.getElementById('statLeagueSeries');
  if (statLeague) statLeague.innerText = filtered.filter(s => s.category?.toLowerCase() === 'league').length;

  const statDomesticWomen = document.getElementById('statDomesticWomenSeries');
  if (statDomesticWomen) statDomesticWomen.innerText = filtered.filter(s => ['domestic', 'women'].includes(s.category?.toLowerCase())).length;
}

function formatSeriesDateRange(startMs, endMs) {
  if (!startMs && !endMs) return 'Dates TBA';

  const start = startMs ? new Date(parseInt(startMs)) : null;
  const end = endMs ? new Date(parseInt(endMs)) : null;

  const options = { month: 'short', day: 'numeric', year: 'numeric' };

  if (start && end) {
    if (start.getFullYear() === end.getFullYear()) {
      const sStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const eStr = end.toLocaleDateString('en-US', options);
      return `${sStr} — ${eStr}`;
    }
    return `${start.toLocaleDateString('en-US', options)} — ${end.toLocaleDateString('en-US', options)}`;
  } else if (start) {
    return `Starts ${start.toLocaleDateString('en-US', options)}`;
  } else if (end) {
    return `Ends ${end.toLocaleDateString('en-US', options)}`;
  }
  return 'Dates TBA';
}

function calculateSeriesDuration(startMs, endMs) {
  if (!startMs || !endMs) return null;
  const diffDays = Math.round((parseInt(endMs) - parseInt(startMs)) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return '1 Day';
  if (diffDays >= 365) return `${(diffDays / 365).toFixed(1)} Yrs`;
  if (diffDays >= 30) return `${Math.round(diffDays / 30)} Months`;
  return `${diffDays} Days`;
}

function getCategoryBadgeClass(category) {
  const cat = (category || '').toLowerCase();
  if (cat === 'international') return 'badge-cat-international';
  if (cat === 'league') return 'badge-cat-league';
  if (cat === 'domestic') return 'badge-cat-domestic';
  if (cat === 'women') return 'badge-cat-women';
  return 'badge-cat-international';
}

function getCategoryIcon(category) {
  const cat = (category || '').toLowerCase();
  if (cat === 'international') return '<i class="fa-solid fa-globe"></i>';
  if (cat === 'league') return '<i class="fa-solid fa-bolt"></i>';
  if (cat === 'domestic') return '<i class="fa-solid fa-shield-halved"></i>';
  if (cat === 'women') return '<i class="fa-solid fa-venus"></i>';
  return '<i class="fa-solid fa-trophy"></i>';
}

function createSeriesCardHtml(series) {
  const dateRangeStr = formatSeriesDateRange(series.start_date, series.end_date);
  const duration = calculateSeriesDuration(series.start_date, series.end_date);
  const badgeClass = getCategoryBadgeClass(series.category);
  const categoryIcon = getCategoryIcon(series.category);
  const matchesCount = series.match_count || 0;

  return `
    <div class="series-card" data-series-id="${series.series_id}">
      <div>
        <div class="series-card-header">
          <span class="badge-cat ${badgeClass}">
            ${categoryIcon} <span>${escapeHtml(series.category || 'Tour')}</span>
          </span>
          <span class="series-month-pill">
            <i class="fa-regular fa-calendar"></i> ${escapeHtml(series.month_group || '2026')}
          </span>
        </div>

        <h3 class="series-card-title" title="${escapeHtml(series.name)}">
          ${escapeHtml(series.name)}
        </h3>

        <div class="series-card-meta">
          <div class="series-meta-row">
            <span class="meta-label"><i class="fa-regular fa-clock"></i> Schedule</span>
            <span class="meta-val">${dateRangeStr}</span>
          </div>
          ${duration ? `
          <div class="series-meta-row">
            <span class="meta-label"><i class="fa-solid fa-hourglass-half"></i> Duration</span>
            <span class="series-duration-pill">${duration}</span>
          </div>
          ` : ''}
          <div class="series-meta-row">
            <span class="meta-label"><i class="fa-solid fa-hashtag"></i> Series ID</span>
            <span class="meta-val" style="font-family: monospace; opacity: 0.8;">#${series.series_id}</span>
          </div>
        </div>
      </div>

      <div class="series-card-footer">
        <span class="series-matches-chip" title="Scheduled matches in database">
          <i class="fa-solid fa-baseball-bat-ball"></i> <span>${matchesCount > 0 ? `${matchesCount} Fixtures` : 'Schedule Available'}</span>
        </span>

        <button class="btn-view-series" onclick="openSeriesScheduleModal(${series.series_id})">
          <span>View Matches</span> <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  `;
}

async function openSeriesScheduleModal(seriesId, refresh = false) {
  const modal = document.getElementById('modalSeriesSchedule');
  const titleEl = document.getElementById('seriesModalName');
  const datesEl = document.getElementById('seriesModalDates');
  const catBadgeEl = document.getElementById('seriesModalCategoryBadge');
  const countEl = document.getElementById('seriesModalMatchCount');
  const container = document.getElementById('seriesMatchesListContainer');

  if (!modal || !container) return;

  const series = allSeriesData.find(s => s.series_id == seriesId) || { name: 'Tournament Schedule', series_id: seriesId };

  if (titleEl) titleEl.innerText = series.name;
  if (datesEl) datesEl.innerHTML = `<i class="fa-regular fa-calendar"></i> ${formatSeriesDateRange(series.start_date, series.end_date)}`;
  if (catBadgeEl) {
    catBadgeEl.className = `badge-cat ${getCategoryBadgeClass(series.category)}`;
    catBadgeEl.innerHTML = `${getCategoryIcon(series.category)} <span>${escapeHtml(series.category || 'Series')}</span>`;
  }
  if (countEl) countEl.innerText = refresh ? 'Syncing...' : 'Loading...';

  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
      <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: var(--accent-emerald); margin-bottom: 12px;"></i>
      <p>${refresh ? 'Fetching fresh updates from Cricbuzz API...' : 'Loading tournament fixtures from database...'}</p>
    </div>
  `;

  modal.classList.add('active');

  try {
    const url = refresh ? `/api/cricbuzz/series/${seriesId}/matches?refresh=1` : `/api/cricbuzz/series/${seriesId}/matches`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const matches = data.matches || [];
    const sourceLabel = data.source === 'Database' ? 'Database' : 'Live Sync';
    if (countEl) {
      countEl.innerHTML = `
        <span>${matches.length} Matches</span>
        <button class="btn btn-secondary" style="font-size: 0.72rem; padding: 2px 8px; margin-left: 8px;" onclick="openSeriesScheduleModal(${seriesId}, true)" title="Re-sync latest from RapidAPI">
          <i class="fa-solid fa-arrows-rotate"></i> Sync
        </button>
      `;
    }

    // Also update match count on the card in UI
    const cardEl = document.querySelector(`.series-card[data-series-id="${seriesId}"] .series-matches-chip span`);
    if (cardEl && matches.length > 0) {
      cardEl.innerText = `${matches.length} Fixtures`;
    }

    if (matches.length === 0) {
      container.innerHTML = `
        <div class="upcoming-empty-state" style="padding: 30px 10px;">
          <div class="empty-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
          <h3>No Detailed Match Fixtures Yet</h3>
          <p>Cricbuzz has not published individual match times for this series yet. Fixtures will appear here once announced by the cricket board.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = matches.map(m => {
      const matchDateStr = m.start_date ? new Date(parseInt(m.start_date)).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : (m.status || 'Date TBA');

      const isCompleted = ['Complete', 'Finished', 'Result'].includes(m.state) || (m.status && m.status.toLowerCase().includes('won'));

      return `
        <div class="series-match-item">
          <div class="series-match-info">
            <div class="series-match-header">
              <span class="series-match-format-tag">${escapeHtml(m.match_format || 'T20')}</span>
              <span>•</span>
              <span>${escapeHtml(m.match_desc || 'Match')}</span>
              <span>•</span>
              <span>${escapeHtml(matchDateStr)}</span>
            </div>

            <div class="series-match-teams">
              ${escapeHtml(m.team1_name || 'Team 1')} vs ${escapeHtml(m.team2_name || 'Team 2')}
            </div>

            ${m.venue_ground || m.venue_city ? `
            <div class="series-match-venue">
              <i class="fa-solid fa-location-dot"></i>
              <span>${escapeHtml(m.venue_ground || '')}${m.venue_city ? ', ' + escapeHtml(m.venue_city) : ''}</span>
            </div>
            ` : ''}

            <div style="font-size: 0.82rem; color: ${isCompleted ? 'var(--accent-emerald)' : '#38bdf8'}; font-weight: 600; margin-top: 2px;">
              ${escapeHtml(m.status || m.state || 'Scheduled')}
            </div>
          </div>

          <div class="series-match-action">
            ${isCompleted ? `
              <button class="btn btn-primary" style="font-size: 0.82rem; padding: 6px 12px;" onclick="closeSeriesScheduleModal(); selectMatchScorecard(${m.match_id});">
                <i class="fa-solid fa-table-list"></i> Scorecard
              </button>
            ` : `
              <span class="current-match-pill" style="font-size: 0.78rem;">
                <i class="fa-regular fa-clock"></i> Upcoming
              </span>
            `}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error fetching series matches:', err);
    container.innerHTML = `
      <div class="upcoming-empty-state" style="padding: 20px;">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red); font-size: 2rem;"></i>
        <h3 style="margin-top: 10px;">Unable to Load Fixtures</h3>
        <p>${escapeHtml(err.message || 'Error communicating with Cricbuzz backend')}</p>
      </div>
    `;
  }
}

function closeSeriesScheduleModal() {
  const modal = document.getElementById('modalSeriesSchedule');
  if (modal) modal.classList.remove('active');
}

async function syncSeriesData() {
  const btn = document.getElementById('btnSyncSeriesTab');
  const icon = btn?.querySelector('i');
  if (btn) btn.disabled = true;
  if (icon) icon.classList.add('fa-spin');

  showToast('Syncing all upcoming tournaments & series...', 'info');

  try {
    const res = await fetch('/api/cricbuzz/sync-series', {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
      }
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast(result.message || 'Tournaments synced successfully!', 'success');
      await loadSeriesData();
    } else {
      showToast(result.message || 'Sync failed', 'error');
    }
  } catch (err) {
    showToast('Failed to sync series data', 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.classList.remove('fa-spin');
  }
}

// Expose globally
window.switchSection = switchSection;
window.switchMatchSubTab = switchMatchSubTab;
window.switchTab = switchTab;
window.selectMatchScorecard = selectMatchScorecard;
window.goToCompletedMatches = goToCompletedMatches;
window.openSeriesScheduleModal = openSeriesScheduleModal;
window.closeSeriesScheduleModal = closeSeriesScheduleModal;
window.resetSeriesFilters = resetSeriesFilters;
window.renderMatchInfo = renderMatchInfo;
window.loadLiveTicker = loadLiveTicker;
window.updateSeriesTabBadge = function(count) {
  const tabBadge = document.getElementById('tabBadgeSeries');
  if (tabBadge) tabBadge.innerText = count;
  const navBadge = document.getElementById('navBadgeSeries');
  if (navBadge) navBadge.innerText = count;
};

/* ==========================================================================
   CRICBUZZ LIVE MATCH TICKER ENGINE
   ========================================================================== */
async function loadLiveTicker() {
  const track = document.getElementById('tickerScrollTrack');
  if (!track) return;

  try {
    const res = await fetch('/api/cricbuzz/completed');
    if (!res.ok) return;
    const data = await res.json();
    const completedMatches = data.matches || [];

    // Also fetch upcoming matches for the ticker
    let upcomingMatches = [];
    const upRes = await fetch('/api/cricbuzz/upcoming').catch(() => null);
    if (upRes && upRes.ok) {
      const upData = await upRes.json();
      (upData.typeMatches || []).forEach(t => {
        (t.seriesMatches || []).forEach(sm => {
          (sm.seriesAdWrapper?.matches || []).forEach(m => {
            if (m.matchInfo) upcomingMatches.push(m.matchInfo);
          });
        });
      });
    }

    renderLiveTickerTrack(completedMatches, upcomingMatches);
  } catch (err) {
    console.error('Failed to load live ticker:', err);
  }
}

function renderLiveTickerTrack(completedList, upcomingList) {
  const track = document.getElementById('tickerScrollTrack');
  if (!track) return;

  const cardsHtml = [];

  // Completed matches first
  completedList.forEach(m => {
    const isSelected = (currentLoadedMatchId == m.match_id);
    let t1Score = '';
    let t2Score = '';

    if (m.scorecard && Array.isArray(m.scorecard) && m.scorecard.length > 0) {
      const inn1 = m.scorecard[0];
      const inn2 = m.scorecard[1];
      if (inn1) t1Score = `${inn1.score}/${inn1.wickets} (${inn1.overs})`;
      if (inn2 && inn2.score !== undefined) t2Score = `${inn2.score}/${inn2.wickets} (${inn2.overs})`;
    } else if (m.match_id == 40381) {
      t1Score = '150/10 (18.5)';
      t2Score = '141/7 (20.0)';
    }

    cardsHtml.push(`
      <div class="ticker-item ${isSelected ? 'active-ticker' : ''}" data-ticker-id="${m.match_id}" onclick="selectMatchScorecard(${m.match_id})" title="Click to view scorecard">
        <div class="ticker-item-top">
          <span class="ticker-series-name" title="${escapeHtml(m.series_name || '')}">${escapeHtml(m.match_desc || 'Match')}</span>
          <span class="ticker-badge ticker-badge-result">RESULT</span>
        </div>
        <div class="ticker-teams-row">
          <div class="ticker-team">
            <span>${escapeHtml(m.team1_sname || m.team1_name || 'Team 1')}</span>
            <span class="team-score">${t1Score}</span>
          </div>
          <div class="ticker-team">
            <span>${escapeHtml(m.team2_sname || m.team2_name || 'Team 2')}</span>
            <span class="team-score">${t2Score}</span>
          </div>
        </div>
        <div class="ticker-status-text" title="${escapeHtml(m.status || '')}">${escapeHtml(m.status || 'Match Complete')}</div>
      </div>
    `);
  });

  // Then upcoming matches (up to 8)
  upcomingList.slice(0, 8).forEach(u => {
    cardsHtml.push(`
      <div class="ticker-item" onclick="switchTab('tab-upcoming')" title="Click to view upcoming matches">
        <div class="ticker-item-top">
          <span class="ticker-series-name" title="${escapeHtml(u.seriesName || '')}">${escapeHtml(u.matchDesc || 'Match')}</span>
          <span class="ticker-badge ticker-badge-upcoming">UPCOMING</span>
        </div>
        <div class="ticker-teams-row">
          <div class="ticker-team">
            <span>${escapeHtml(u.team1?.teamSName || u.team1?.teamName || 'T1')}</span>
            <span class="team-score">-</span>
          </div>
          <div class="ticker-team">
            <span>${escapeHtml(u.team2?.teamSName || u.team2?.teamName || 'T2')}</span>
            <span class="team-score">-</span>
          </div>
        </div>
        <div class="ticker-status-text">${escapeHtml(u.status || 'Scheduled')}</div>
      </div>
    `);
  });

  if (cardsHtml.length > 0) {
    track.innerHTML = cardsHtml.join('');
  }
}

/* ==========================================================================
   MATCH INFORMATION & PLAYING XI RENDERER (Cricbuzz Classic Style)
   ========================================================================== */
function renderMatchInfo(data) {
  if (!data) return;
  const scorecard = data.scorecard || [];
  if (scorecard.length === 0) return;

  const inn1 = scorecard[0];
  const inn2 = scorecard[1] || {};

  // Check if we have metadata from allCompletedMatches or allUpcomingMatches
  const matchMeta = allCompletedMatches.find(m => m.match_id == currentLoadedMatchId) ||
                    allUpcomingMatches.find(m => m.matchId == currentLoadedMatchId) || {};

  // 1. Match Description & Series Name
  let matchDesc = matchMeta.match_desc || matchMeta.matchDesc || '';
  let seriesName = matchMeta.series_name || matchMeta.seriesName || '';
  if (!seriesName && data.appindex && data.appindex.seotitle) {
    const parts = data.appindex.seotitle.split('|')[0].replace('Cricket scorecard -', '').trim().split(',');
    if (parts.length > 1) {
      matchDesc = matchDesc || parts[0].trim();
      seriesName = seriesName || parts[1].trim();
    } else {
      matchDesc = matchDesc || parts[0].trim();
      seriesName = seriesName || parts[0].trim();
    }
  }

  const descEl = document.getElementById('infoMatchDesc');
  if (descEl) descEl.innerText = matchDesc ? `${matchDesc}, ${seriesName}` : '2nd T20I, Ireland tour of USA, 2021';

  const seriesEl = document.getElementById('infoSeriesName');
  if (seriesEl) seriesEl.innerText = seriesName || 'Ireland tour of USA, 2021';

  // 2. Date
  const dateEl = document.getElementById('infoDateTime');
  if (dateEl) {
    if (matchMeta.start_date || matchMeta.startDate) {
      const d = new Date(Number(matchMeta.start_date || matchMeta.startDate));
      dateEl.innerText = isNaN(d.getTime()) ? 'Dec 23, 2021' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      dateEl.innerText = 'Dec 23, 2021';
    }
  }

  // 3. Toss
  const tossEl = document.getElementById('infoToss');
  if (tossEl) {
    tossEl.innerText = data.toss || `${inn2.batteamname || 'United States'} won the toss and opted to bowl`;
  }

  // 4. Venue
  const venueEl = document.getElementById('infoVenue');
  if (venueEl) {
    const ground = matchMeta.venue_ground || (matchMeta.venueInfo && matchMeta.venueInfo.ground) || 'Central Broward Regional Park Stadium Turf Ground';
    const city = matchMeta.venue_city || (matchMeta.venueInfo && matchMeta.venueInfo.city) || 'Lauderhill, Florida';
    venueEl.innerText = `${ground}, ${city}`;
  }

  // 5. Umpires & Officials
  const umpiresEl = document.getElementById('infoUmpires');
  if (umpiresEl) umpiresEl.innerText = data.umpires || 'Vijaya Mallela, Leslie Reifer';

  const thirdUmpireEl = document.getElementById('infoThirdUmpire');
  if (thirdUmpireEl) thirdUmpireEl.innerText = data.thirdumpire || 'Samir Bandekar';

  const refereeEl = document.getElementById('infoReferee');
  if (refereeEl) refereeEl.innerText = data.referee || 'Jermaine Lindo';

  // 6. Match Result
  const resultEl = document.getElementById('infoResult');
  if (resultEl) resultEl.innerText = data.status || matchMeta.status || 'Match Complete';

  // 7. Playing XI Squads
  const team1Title = document.getElementById('xiTeam1Title');
  if (team1Title) team1Title.innerText = inn1.batteamname || 'Team 1';

  const team2Title = document.getElementById('xiTeam2Title');
  if (team2Title) team2Title.innerText = inn2.batteamname || 'Team 2';

  // Team 1 players
  const list1 = document.getElementById('xiTeam1List');
  if (list1) {
    list1.innerHTML = '';
    const players1 = inn1.batsman || [];
    players1.forEach(p => {
      let roleHtml = '';
      if (p.iscaptain && p.iskeeper) roleHtml = '<span class="xi-player-role xi-captain" style="color:var(--accent-amber);">C & WK</span>';
      else if (p.iscaptain) roleHtml = '<span class="xi-player-role xi-captain" style="color:var(--accent-amber);">Captain</span>';
      else if (p.iskeeper) roleHtml = '<span class="xi-player-role xi-keeper" style="color:var(--accent-blue);">Wicketkeeper</span>';

      const item = document.createElement('div');
      item.className = 'xi-player-item';
      item.innerHTML = `
        <span class="xi-player-name"><i class="fa-solid fa-user" style="font-size:0.75rem; color:var(--text-muted); margin-right:6px;"></i>${escapeHtml(p.name)}</span>
        ${roleHtml}
      `;
      list1.appendChild(item);
    });
  }

  // Team 2 players
  const list2 = document.getElementById('xiTeam2List');
  if (list2) {
    list2.innerHTML = '';
    const players2 = inn2.batsman || [];
    players2.forEach(p => {
      let roleHtml = '';
      if (p.iscaptain && p.iskeeper) roleHtml = '<span class="xi-player-role xi-captain" style="color:var(--accent-amber);">C & WK</span>';
      else if (p.iscaptain) roleHtml = '<span class="xi-player-role xi-captain" style="color:var(--accent-amber);">Captain</span>';
      else if (p.iskeeper) roleHtml = '<span class="xi-player-role xi-keeper" style="color:var(--accent-blue);">Wicketkeeper</span>';

      const item = document.createElement('div');
      item.className = 'xi-player-item';
      item.innerHTML = `
        <span class="xi-player-name"><i class="fa-solid fa-user" style="font-size:0.75rem; color:var(--text-muted); margin-right:6px;"></i>${escapeHtml(p.name)}</span>
        ${roleHtml}
      `;
      list2.appendChild(item);
    });
  }
}




