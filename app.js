// ============================================================
// app.js - আযকার অ্যাপের মূল লজিক
// ============================================================

// ===================== STATE MANAGEMENT =====================
const AppState = {
  currentPage: 'home',
  currentDhikrCategory: null,
  settings: {
    arabicFontSize: 26,
    banglaFontSize: 15,
    theme: 'dark',
    showArabic: true,
    showTransliteration: true,
    showTranslation: true,
    showBenefit: true
  },
  tasbih: {
    current: 0,
    target: 33,
    rounds: 0,
    totalToday: 0,
    selectedDhikr: 'subhanallah',
    customArabic: '',
    customBangla: '',
    customTarget: 33
  },
  progress: {},  // { categoryKey: { itemId: currentCount } }
  favorites: [], // [{ id, categoryKey, arabic, translation, benefit }]
  history: [],   // [{ date, category, percent, completedCount, totalCount }]
  dailyHadithIndex: 0
};

// ===================== LOCAL STORAGE =====================
function saveToStorage() {
  try {
    localStorage.setItem('azkar_state', JSON.stringify({
      settings: AppState.settings,
      tasbih: AppState.tasbih,
      progress: AppState.progress,
      favorites: AppState.favorites,
      history: AppState.history,
      dailyHadithIndex: AppState.dailyHadithIndex
    }));
  } catch(e) { console.warn('Storage save failed:', e); }
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('azkar_state');
    if (!saved) return;
    const data = JSON.parse(saved);
    if (data.settings) AppState.settings = { ...AppState.settings, ...data.settings };
    if (data.tasbih) AppState.tasbih = { ...AppState.tasbih, ...data.tasbih };
    if (data.progress) AppState.progress = data.progress;
    if (data.favorites) AppState.favorites = data.favorites;
    if (data.history) AppState.history = data.history;
    if (data.dailyHadithIndex !== undefined) AppState.dailyHadithIndex = data.dailyHadithIndex;
  } catch(e) { console.warn('Storage load failed:', e); }
}

// ===================== UTILITIES =====================
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, duration);
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getTodayKey() { return getDateKey(); }

function getBanglaDay(index) {
  const days = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
  return days[index];
}

function formatTime(date) {
  let h = date.getHours(), m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
}

function formatDateBangla(date) {
  const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  const days = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ===================== SETTINGS APPLICATION =====================
function applySettings() {
  document.documentElement.dataset.theme = AppState.settings.theme;
  document.documentElement.style.setProperty('--arabic-font-size', AppState.settings.arabicFontSize + 'px');
  document.documentElement.style.setProperty('--bangla-font-size', AppState.settings.banglaFontSize + 'px');

  const showArabic = AppState.settings.showArabic;
  const showTrans = AppState.settings.showTransliteration;
  const showTransl = AppState.settings.showTranslation;
  const showBenefit = AppState.settings.showBenefit;

  document.querySelectorAll('.arabic-text').forEach(el => el.style.display = showArabic ? '' : 'none');
  document.querySelectorAll('.transliteration').forEach(el => el.style.display = showTrans ? '' : 'none');
  document.querySelectorAll('.translation-text').forEach(el => el.style.display = showTransl ? '' : 'none');
  document.querySelectorAll('.benefit-text').forEach(el => el.style.display = showBenefit ? '' : 'none');
}

// ===================== PROGRESS MANAGEMENT =====================
function getProgress(categoryKey) {
  if (!AppState.progress[categoryKey]) return {};
  return AppState.progress[categoryKey];
}

function setItemCount(categoryKey, itemId, count) {
  if (!AppState.progress[categoryKey]) AppState.progress[categoryKey] = {};
  AppState.progress[categoryKey][itemId] = count;
  saveToStorage();
}

function getCategoryCompletion(categoryKey) {
  const data = DHIKR_DATA[categoryKey];
  if (!data) return { completed: 0, total: 0, percent: 0 };
  const progress = getProgress(categoryKey);
  let completed = 0;
  data.items.forEach(item => {
    const current = progress[item.id] || 0;
    if (current >= item.repeat) completed++;
  });
  const total = data.items.length;
  return { completed, total, percent: total > 0 ? Math.round((completed/total)*100) : 0 };
}

// ===================== HOME PAGE =====================
function updateHomePage() {
  // Morning/Evening progress rings
  ['morning', 'evening'].forEach(cat => {
    const { percent } = getCategoryCompletion(cat);
    const ring = document.getElementById(`${cat}-progress-ring`);
    const text = document.getElementById(`${cat}-progress-text`);
    if (ring) {
      const circumference = 2 * Math.PI * 15.9;
      const offset = circumference - (percent / 100) * circumference;
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = offset;
    }
    if (text) text.textContent = percent + '%';
  });

  // Prayer progress bars
  ['fajr','dhuhr','asr','maghrib','isha'].forEach(cat => {
    const { percent } = getCategoryCompletion(cat);
    const fill = document.getElementById(`${cat}-mini-fill`);
    const perc = document.getElementById(`${cat}-percent`);
    if (fill) fill.style.width = percent + '%';
    if (perc) perc.textContent = percent + '%';
  });

  // Daily hadith
  const hadith = DAILY_HADITHS[AppState.dailyHadithIndex % DAILY_HADITHS.length];
  const arabicEl = document.getElementById('daily-hadith-arabic');
  const textEl = document.getElementById('daily-hadith-text');
  const sourceEl = document.querySelector('.quote-source');
  if (arabicEl) arabicEl.textContent = hadith.arabic;
  if (textEl) textEl.textContent = hadith.text;
  if (sourceEl) sourceEl.textContent = hadith.source;
}

// ===================== CLOCK & DATE =====================
function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('current-time');
  const dateEl = document.getElementById('current-date');
  if (timeEl) timeEl.textContent = formatTime(now);
  if (dateEl) dateEl.textContent = formatDateBangla(now);
  updateNextPrayer();
}

function updateNextPrayer() {
  const el = document.getElementById('next-prayer');
  if (!el) return;
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const total = h * 60 + m;

  const prayers = [
    { name: 'ফজর', start: 4 * 60, end: 5 * 60 + 30 },
    { name: 'যোহর', start: 12 * 60, end: 15 * 60 },
    { name: 'আসর', start: 15 * 60, end: 17 * 60 + 30 },
    { name: 'মাগরিব', start: 17 * 60 + 30, end: 19 * 60 },
    { name: 'ইশা', start: 19 * 60, end: 22 * 60 }
  ];

  let current = prayers.find(p => total >= p.start && total <= p.end);
  if (current) {
    el.textContent = `🕌 ${current.name} নামাজের সময়`;
  } else {
    let next = prayers.find(p => total < p.start);
    if (next) {
      const diff = next.start - total;
      el.textContent = `⏰ ${next.name} - ${Math.floor(diff/60)}ঘ ${diff%60}মি পরে`;
    } else {
      el.textContent = `⏰ ফজর - আসছে`;
    }
  }
}

// ===================== DHIKR PAGE =====================
function renderDhikrPage(categoryKey) {
  AppState.currentDhikrCategory = categoryKey;
  const data = DHIKR_DATA[categoryKey];
  if (!data) return;

  // Update header
  document.getElementById('dhikr-page-title').textContent = data.title;
  document.getElementById('dhikr-page-subtitle').textContent = data.subtitle;

  // Render items
  const list = document.getElementById('dhikr-list');
  list.innerHTML = '';

  const progress = getProgress(categoryKey);

  data.items.forEach((item, index) => {
    const currentCount = progress[item.id] || 0;
    const isComplete = currentCount >= item.repeat;
    const card = createDhikrCard(item, index + 1, currentCount, isComplete, categoryKey);
    list.appendChild(card);
  });

  updateDhikrProgress();
  updateCompleteBanner();
  applySettings();
}

function createDhikrCard(item, num, currentCount, isComplete, categoryKey) {
  const div = document.createElement('div');
  div.className = `dhikr-card${isComplete ? ' completed' : ''}`;
  div.dataset.itemId = item.id;

  const isFav = AppState.favorites.some(f => f.id === item.id);

  div.innerHTML = `
    <div class="dhikr-card-top">
      <div class="dhikr-card-meta">
        <div class="dhikr-number">${num}</div>
        <div class="dhikr-card-actions">
          <button class="action-btn fav-btn ${isFav ? 'liked' : ''}" data-item-id="${item.id}" title="${isFav ? 'প্রিয় থেকে সরান' : 'প্রিয়তে যোগ করুন'}">
            ${isFav ? '❤️' : '🤍'}
          </button>
          ${isComplete ? '<span class="action-btn" style="color:#2ecc71">✅</span>' : ''}
        </div>
      </div>
      <div class="arabic-text">${item.arabic}</div>
      <div class="transliteration">${item.transliteration}</div>
      <div class="translation-text">${item.translation}</div>
      <div class="benefit-text">${item.benefit}</div>
    </div>
    <div class="repeat-section">
      <div class="repeat-info">
        <div class="repeat-count">${currentCount} / ${item.repeat}</div>
        <div class="repeat-label">${item.repeat > 1 ? `${item.repeat} বার পড়ুন` : 'একবার পড়ুন'}</div>
      </div>
      <div class="counter-controls">
        ${item.repeat > 1 ? `
          <button class="counter-btn minus-btn" data-item-id="${item.id}">−</button>
          <div class="counter-display" id="counter-${item.id}">${currentCount}</div>
          <button class="counter-btn plus-btn" data-item-id="${item.id}">+</button>
        ` : ''}
        <button class="tap-complete-btn ${isComplete ? 'done' : ''}" data-item-id="${item.id}">
          ${isComplete ? '✅ সম্পন্ন' : (item.repeat > 1 ? '✓ সম্পন্ন' : '✓ পড়া হয়েছে')}
        </button>
      </div>
    </div>
  `;

  // Attach events
  div.querySelector('.fav-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(item, categoryKey, div.querySelector('.fav-btn'));
  });

  if (item.repeat > 1) {
    div.querySelector('.minus-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      adjustCount(categoryKey, item, -1, div);
    });
    div.querySelector('.plus-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      adjustCount(categoryKey, item, 1, div);
    });
  }

  div.querySelector('.tap-complete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const prog = getProgress(categoryKey);
    const cur = prog[item.id] || 0;
    if (cur < item.repeat) {
      const newCount = item.repeat;
      setItemCount(categoryKey, item.id, newCount);
      updateCardUI(div, item, newCount);
      updateDhikrProgress();
      updateHomePage();
      if (checkAllComplete(categoryKey)) showCompleteBanner();
      logHistory(categoryKey);
    } else {
      // Reset this item
      setItemCount(categoryKey, item.id, 0);
      updateCardUI(div, item, 0);
      updateDhikrProgress();
      updateHomePage();
      document.getElementById('dhikr-complete-banner').classList.add('hidden');
    }
  });

  return div;
}

function adjustCount(categoryKey, item, delta, card) {
  const prog = getProgress(categoryKey);
  const cur = prog[item.id] || 0;
  const newVal = Math.max(0, Math.min(item.repeat, cur + delta));
  setItemCount(categoryKey, item.id, newVal);
  updateCardUI(card, item, newVal);
  updateDhikrProgress();
  updateHomePage();
  if (newVal >= item.repeat) {
    if (checkAllComplete(categoryKey)) showCompleteBanner();
    logHistory(categoryKey);
  }
}

function updateCardUI(card, item, count) {
  const isComplete = count >= item.repeat;
  card.className = `dhikr-card${isComplete ? ' completed' : ''}`;

  const countDisplay = card.querySelector(`#counter-${item.id}`);
  if (countDisplay) countDisplay.textContent = count;

  const repeatCount = card.querySelector('.repeat-count');
  if (repeatCount) repeatCount.textContent = `${count} / ${item.repeat}`;

  const btn = card.querySelector('.tap-complete-btn');
  if (btn) {
    btn.className = `tap-complete-btn${isComplete ? ' done' : ''}`;
    btn.textContent = isComplete ? '✅ সম্পন্ন' : (item.repeat > 1 ? '✓ সম্পন্ন' : '✓ পড়া হয়েছে');
  }

  const checkMark = card.querySelector('.action-btn[style]');
  if (isComplete && !checkMark) {
    const actions = card.querySelector('.dhikr-card-actions');
    const span = document.createElement('span');
    span.className = 'action-btn';
    span.style.color = '#2ecc71';
    span.textContent = '✅';
    actions.appendChild(span);
  } else if (!isComplete && checkMark) {
    checkMark.remove();
  }
}

function updateDhikrProgress() {
  const categoryKey = AppState.currentDhikrCategory;
  if (!categoryKey) return;
  const { completed, total, percent } = getCategoryCompletion(categoryKey);
  const fill = document.getElementById('dhikr-fill');
  const label = document.getElementById('dhikr-progress-label');
  if (fill) fill.style.width = percent + '%';
  if (label) label.textContent = `${completed}/${total} সম্পন্ন`;
}

function checkAllComplete(categoryKey) {
  const { completed, total } = getCategoryCompletion(categoryKey);
  return completed === total && total > 0;
}

function showCompleteBanner() {
  const banner = document.getElementById('dhikr-complete-banner');
  if (banner) {
    banner.classList.remove('hidden');
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateCompleteBanner() {
  const categoryKey = AppState.currentDhikrCategory;
  const banner = document.getElementById('dhikr-complete-banner');
  if (!banner) return;
  if (checkAllComplete(categoryKey)) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// ===================== HISTORY LOGGING =====================
function logHistory(categoryKey) {
  const { completed, total, percent } = getCategoryCompletion(categoryKey);
  const data = DHIKR_DATA[categoryKey];
  const today = getTodayKey();

  // Remove existing entry for same day & category
  AppState.history = AppState.history.filter(h => !(h.date === today && h.category === categoryKey));

  AppState.history.unshift({
    date: today,
    category: categoryKey,
    categoryTitle: data.title,
    percent,
    completedCount: completed,
    totalCount: total,
    timestamp: Date.now()
  });

  // Keep only last 100 entries
  if (AppState.history.length > 100) AppState.history = AppState.history.slice(0, 100);
  saveToStorage();
}

// ===================== FAVORITES =====================
function toggleFavorite(item, categoryKey, btn) {
  const data = DHIKR_DATA[categoryKey];
  const idx = AppState.favorites.findIndex(f => f.id === item.id);
  if (idx === -1) {
    AppState.favorites.push({
      id: item.id,
      categoryKey,
      categoryTitle: data.title,
      arabic: item.arabic,
      translation: item.translation,
      benefit: item.benefit
    });
    btn.textContent = '❤️';
    btn.classList.add('liked');
    showToast('❤️ প্রিয় তালিকায় যোগ হয়েছে');
  } else {
    AppState.favorites.splice(idx, 1);
    btn.textContent = '🤍';
    btn.classList.remove('liked');
    showToast('প্রিয় তালিকা থেকে সরানো হয়েছে');
  }
  saveToStorage();
}

function renderFavoritesPage() {
  const list = document.getElementById('favorites-list');
  if (!list) return;

  if (AppState.favorites.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💔</div>
      <h3>কোনো প্রিয় দোয়া নেই</h3>
      <p>দোয়া পড়ার সময় হৃদয় আইকনে ট্যাপ করে প্রিয় তালিকায় যোগ করুন</p>
    </div>`;
    return;
  }

  list.innerHTML = AppState.favorites.map((fav, idx) => `
    <div class="fav-card">
      <div class="fav-card-top">
        <span class="fav-category">${fav.categoryTitle}</span>
        <button class="fav-remove-btn" data-idx="${idx}">✕</button>
      </div>
      <div class="fav-arabic">${fav.arabic.substring(0, 100)}${fav.arabic.length > 100 ? '...' : ''}</div>
      <div class="fav-translation">${fav.translation}</div>
    </div>
  `).join('');

  list.querySelectorAll('.fav-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      AppState.favorites.splice(idx, 1);
      saveToStorage();
      renderFavoritesPage();
      showToast('প্রিয় তালিকা থেকে সরানো হয়েছে');
    });
  });
}

// ===================== HISTORY PAGE =====================
function renderHistoryPage() {
  renderHistorySummary();
  renderBarChart();
  renderHistoryList();
}

function renderHistorySummary() {
  const summary = document.getElementById('history-summary');
  if (!summary) return;

  const today = getTodayKey();
  const todayEntries = AppState.history.filter(h => h.date === today);
  const totalCompleted = AppState.history.filter(h => h.percent === 100).length;
  const streak = calculateStreak();

  summary.innerHTML = `
    <div class="history-stat">
      <div class="history-stat-num">${todayEntries.length}</div>
      <div class="history-stat-label">আজকের আমল</div>
    </div>
    <div class="history-stat">
      <div class="history-stat-num">${totalCompleted}</div>
      <div class="history-stat-label">সম্পূর্ণ আমল</div>
    </div>
    <div class="history-stat">
      <div class="history-stat-num">${streak}</div>
      <div class="history-stat-label">দিনের ধারা</div>
    </div>
  `;
}

function calculateStreak() {
  if (AppState.history.length === 0) return 0;
  const dates = [...new Set(AppState.history.map(h => h.date))].sort().reverse();
  let streak = 0;
  const today = getTodayKey();
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    if (dates[i] === getDateKey(expected)) {
      streak++;
    } else break;
  }
  return streak;
}

function renderBarChart() {
  const chart = document.getElementById('bar-chart');
  if (!chart) return;
  chart.innerHTML = '';

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: getDateKey(d), label: getBanglaDay(d.getDay()) });
  }

  days.forEach(day => {
    const entries = AppState.history.filter(h => h.date === day.date);
    const avgPercent = entries.length > 0
      ? Math.round(entries.reduce((s, h) => s + h.percent, 0) / entries.length)
      : 0;
    const height = Math.max(4, avgPercent);

    const item = document.createElement('div');
    item.className = 'bar-item';
    item.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;">
        <div class="bar-fill" style="height:${height}%"></div>
      </div>
      <div class="bar-label">${day.label}</div>
    `;
    chart.appendChild(item);
  });
}

function renderHistoryList() {
  const list = document.getElementById('history-list');
  if (!list) return;

  if (AppState.history.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📊</div>
      <h3>কোনো ইতিহাস নেই</h3>
      <p>আযকার পড়া শুরু করুন, ইতিহাস এখানে সংরক্ষিত হবে</p>
    </div>`;
    return;
  }

  list.innerHTML = AppState.history.slice(0, 50).map(entry => `
    <div class="history-item">
      <div class="history-item-info">
        <div class="history-item-title">${entry.categoryTitle}</div>
        <div class="history-item-date">${formatDateBangla(new Date(entry.date))} • ${entry.completedCount}/${entry.totalCount} সম্পন্ন</div>
      </div>
      <div class="history-item-badge ${entry.percent === 100 ? 'badge-complete' : 'badge-partial'}">
        ${entry.percent}%
      </div>
    </div>
  `).join('');
}

// ===================== TASBIH PAGE =====================
function initTasbih() {
  const select = document.getElementById('tasbih-dhikr-select');
  const tapBtn = document.getElementById('tasbih-tap');
  const resetBtn = document.getElementById('tasbih-reset');
  const minusBtn = document.getElementById('tasbih-minus');
  const customSection = document.getElementById('custom-dhikr-section');
  const saveCustomBtn = document.getElementById('save-custom-dhikr');

  updateTasbihDisplay();

  select.value = AppState.tasbih.selectedDhikr;
  select.addEventListener('change', () => {
    AppState.tasbih.selectedDhikr = select.value;
    AppState.tasbih.current = 0;
    AppState.tasbih.rounds = 0;
    if (select.value === 'custom') {
      customSection.classList.remove('hidden');
    } else {
      customSection.classList.add('hidden');
    }
    updateTasbihDisplay();
    saveToStorage();
  });

  tapBtn.addEventListener('click', () => {
    AppState.tasbih.current++;
    AppState.tasbih.totalToday++;

    const target = getCurrentTasbihTarget();
    if (AppState.tasbih.current > target) {
      AppState.tasbih.current = 1;
      AppState.tasbih.rounds++;
      showToast('🎉 আলহামদুলিল্লাহ! এক রাউন্ড সম্পন্ন');
    }

    updateTasbihDisplay();

    // Ripple effect
    const ripple = tapBtn.querySelector('.tasbih-tap-ripple');
    ripple.style.transform = 'scale(0)';
    ripple.style.opacity = '0.3';
    requestAnimationFrame(() => {
      ripple.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
      ripple.style.transform = 'scale(2)';
      ripple.style.opacity = '0';
    });

    // Vibrate
    if (navigator.vibrate) navigator.vibrate(30);

    saveToStorage();
  });

  minusBtn.addEventListener('click', () => {
    if (AppState.tasbih.current > 0) {
      AppState.tasbih.current--;
      updateTasbihDisplay();
      saveToStorage();
    }
  });

  resetBtn.addEventListener('click', () => {
    AppState.tasbih.current = 0;
    AppState.tasbih.rounds = 0;
    updateTasbihDisplay();
    saveToStorage();
    showToast('রিসেট করা হয়েছে');
  });

  saveCustomBtn.addEventListener('click', () => {
    const arabic = document.getElementById('custom-arabic').value.trim();
    const bangla = document.getElementById('custom-bangla').value.trim();
    const target = parseInt(document.getElementById('custom-target').value) || 33;
    if (bangla) {
      AppState.tasbih.customArabic = arabic;
      AppState.tasbih.customBangla = bangla;
      AppState.tasbih.customTarget = target;
      AppState.tasbih.current = 0;
      AppState.tasbih.rounds = 0;
      updateTasbihDisplay();
      saveToStorage();
      showToast('✅ সংরক্ষিত হয়েছে');
    }
  });

  if (select.value === 'custom') customSection.classList.remove('hidden');
}

function getCurrentTasbihTarget() {
  const sel = AppState.tasbih.selectedDhikr;
  if (sel === 'custom') return AppState.tasbih.customTarget || 33;
  return TASBIH_DHIKR[sel]?.target || 33;
}

function updateTasbihDisplay() {
  const sel = AppState.tasbih.selectedDhikr;
  let arabic, bangla, target;

  if (sel === 'custom') {
    arabic = AppState.tasbih.customArabic || 'اذكر الله';
    bangla = AppState.tasbih.customBangla || 'কাস্টম জিকির';
    target = AppState.tasbih.customTarget || 33;
  } else {
    const d = TASBIH_DHIKR[sel];
    arabic = d.arabic;
    bangla = d.bangla;
    target = d.target;
  }

  document.getElementById('tasbih-arabic-display').textContent = arabic;
  document.getElementById('tasbih-bangla-display').textContent = bangla;
  document.getElementById('counter-number').textContent = AppState.tasbih.current;
  document.getElementById('counter-target').textContent = `/ ${target}`;
  document.getElementById('tasbih-total-rounds').textContent = AppState.tasbih.rounds;
  document.getElementById('tasbih-total-count').textContent = AppState.tasbih.totalToday;
  document.getElementById('tasbih-today').textContent = AppState.tasbih.totalToday;

  // Update SVG circle
  const circle = document.getElementById('counter-svg-circle');
  if (circle) {
    const circumference = 2 * Math.PI * 85; // r=85
    const percent = AppState.tasbih.current / target;
    const offset = circumference - percent * circumference;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = offset;

    // Color change at completion
    if (AppState.tasbih.current >= target) {
      circle.style.stroke = '#2ecc71';
    } else {
      circle.style.stroke = 'var(--accent-gold)';
    }
  }
}

// ===================== SEARCH =====================
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { resultsEl.innerHTML = ''; return; }

    const results = [];
    Object.entries(DHIKR_DATA).forEach(([catKey, catData]) => {
      catData.items.forEach(item => {
        if (
          item.translation.toLowerCase().includes(q) ||
          item.transliteration.toLowerCase().includes(q) ||
          item.benefit.toLowerCase().includes(q) ||
          catData.title.toLowerCase().includes(q)
        ) {
          results.push({ item, catKey, catData });
        }
      });
    });

    if (results.length === 0) {
      resultsEl.innerHTML = `<div class="empty-state" style="padding:30px 20px">
        <div class="empty-icon">🔍</div>
        <p>কোনো ফলাফল পাওয়া যায়নি</p>
      </div>`;
      return;
    }

    resultsEl.innerHTML = results.map(({ item, catKey, catData }, i) => `
      <div class="search-result-item" data-cat="${catKey}" data-idx="${i}">
        <div class="search-result-title">${catData.title}</div>
        <div class="search-result-subtitle">${item.translation.substring(0, 80)}...</div>
      </div>
    `).join('');

    resultsEl.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        closeAllModals();
        navigateTo(results[i].catKey);
      });
    });
  });
}

// ===================== NAVIGATION =====================
function navigateTo(page) {
  AppState.currentPage = page;
  const mainContent = document.getElementById('main-content');

  // Hide all pages
  mainContent.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });

  // Update bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Update sidebar links
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const activeSidebar = document.querySelector(`.sidebar-link[data-page="${page}"]`);
  if (activeSidebar) activeSidebar.classList.add('active');

  closeSidebar();

  if (page === 'home') {
    const homePage = document.getElementById('page-home');
    homePage.classList.remove('hidden');
    homePage.classList.add('active');
    document.getElementById('header-title').textContent = 'আযকার';
    updateHomePage();

  } else if (['morning', 'evening', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(page)) {
    const dhikrPage = document.getElementById('page-dhikr');
    dhikrPage.classList.remove('hidden');
    dhikrPage.classList.add('active');
    renderDhikrPage(page);
    const data = DHIKR_DATA[page];
    document.getElementById('header-title').textContent = data.title;

  } else if (page === 'tasbih') {
    const tasbihPage = document.getElementById('page-tasbih');
    tasbihPage.classList.remove('hidden');
    tasbihPage.classList.add('active');
    document.getElementById('header-title').textContent = 'তাসবিহ কাউন্টার';

  } else if (page === 'favorites') {
    const favPage = document.getElementById('page-favorites');
    favPage.classList.remove('hidden');
    favPage.classList.add('active');
    document.getElementById('header-title').textContent = 'প্রিয় দোয়া';
    renderFavoritesPage();

  } else if (page === 'history') {
    const histPage = document.getElementById('page-history');
    histPage.classList.remove('hidden');
    histPage.classList.add('active');
    document.getElementById('header-title').textContent = 'আমলের ইতিহাস';
    renderHistoryPage();
  }
}

// ===================== SIDEBAR =====================
function openSidebar() {
  document.getElementById('sidebar').classList.remove('hidden');
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  setTimeout(() => document.getElementById('sidebar').classList.add('hidden'), 350);
  document.getElementById('sidebar-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ===================== MODALS =====================
function closeAllModals() {
  document.getElementById('search-modal').classList.add('hidden');
  document.getElementById('settings-modal').classList.add('hidden');
}

// ===================== SETTINGS MODAL =====================
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  modal.classList.remove('hidden');

  // Populate current values
  document.getElementById('arabic-font-size').value = AppState.settings.arabicFontSize;
  document.getElementById('arabic-font-size-val').textContent = AppState.settings.arabicFontSize + 'px';
  document.getElementById('bangla-font-size').value = AppState.settings.banglaFontSize;
  document.getElementById('bangla-font-size-val').textContent = AppState.settings.banglaFontSize + 'px';
  document.getElementById('show-arabic').checked = AppState.settings.showArabic;
  document.getElementById('show-transliteration').checked = AppState.settings.showTransliteration;
  document.getElementById('show-translation').checked = AppState.settings.showTranslation;
  document.getElementById('show-benefit').checked = AppState.settings.showBenefit;

  // Theme buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === AppState.settings.theme);
  });
}

// ===================== RESET =====================
function resetCategoryProgress(categoryKey) {
  if (AppState.progress[categoryKey]) {
    AppState.progress[categoryKey] = {};
    saveToStorage();
    renderDhikrPage(categoryKey);
    updateHomePage();
    showToast('রিসেট করা হয়েছে');
  }
}

// ===================== INITIALIZATION =====================
function init() {
  loadFromStorage();

  // Show splash then reveal app
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      updateHomePage();
      startClock();
      setupEventListeners();
      applySettings();
    }, 500);
  }, 2000);

  // Change daily hadith
  const today = getTodayKey();
  const lastDate = localStorage.getItem('azkar_hadith_date');
  if (lastDate !== today) {
    AppState.dailyHadithIndex = (AppState.dailyHadithIndex + 1) % DAILY_HADITHS.length;
    localStorage.setItem('azkar_hadith_date', today);
    saveToStorage();
  }
}

function startClock() {
  updateClock();
  setInterval(updateClock, 10000); // update every 10s
}

function setupEventListeners() {
  // NAVIGATION - bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // NAVIGATION - sidebar links
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // NAVIGATION - home cards & tools
  document.querySelectorAll('[data-page]').forEach(el => {
    if (!el.classList.contains('nav-btn') && !el.classList.contains('sidebar-link') && !el.classList.contains('theme-btn')) {
      el.addEventListener('click', () => {
        if (el.dataset.page) navigateTo(el.dataset.page);
      });
    }
  });

  // SIDEBAR
  document.getElementById('menu-btn').addEventListener('click', openSidebar);
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // SEARCH
  document.getElementById('search-btn').addEventListener('click', () => {
    document.getElementById('search-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('search-input').focus(), 100);
  });
  document.getElementById('search-close').addEventListener('click', closeAllModals);
  document.getElementById('search-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('search-modal')) closeAllModals();
  });
  setupSearch();

  // SETTINGS
  document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
  document.getElementById('settings-close').addEventListener('click', closeAllModals);
  document.getElementById('settings-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settings-modal')) closeAllModals();
  });

  // Settings changes
  document.getElementById('arabic-font-size').addEventListener('input', (e) => {
    AppState.settings.arabicFontSize = parseInt(e.target.value);
    document.getElementById('arabic-font-size-val').textContent = e.target.value + 'px';
    applySettings();
    saveToStorage();
  });

  document.getElementById('bangla-font-size').addEventListener('input', (e) => {
    AppState.settings.banglaFontSize = parseInt(e.target.value);
    document.getElementById('bangla-font-size-val').textContent = e.target.value + 'px';
    applySettings();
    saveToStorage();
  });

  ['show-arabic', 'show-transliteration', 'show-translation', 'show-benefit'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      const key = id.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      AppState.settings[key] = e.target.checked;
      applySettings();
      saveToStorage();
    });
  });

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.settings.theme = btn.dataset.theme;
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applySettings();
      saveToStorage();
    });
  });

  // CLEAR/RESET
  document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (confirm('সব ইতিহাস মুছে দিবেন?')) {
      AppState.history = [];
      saveToStorage();
      closeAllModals();
      showToast('✅ ইতিহাস মুছে দেওয়া হয়েছে');
    }
  });

  document.getElementById('reset-all-btn').addEventListener('click', () => {
    if (confirm('সব ডেটা রিসেট করবেন? এটি পূর্বাবস্থায় ফেরানো যাবে না।')) {
      AppState.progress = {};
      AppState.favorites = [];
      AppState.history = [];
      AppState.tasbih.current = 0;
      AppState.tasbih.rounds = 0;
      AppState.tasbih.totalToday = 0;
      saveToStorage();
      closeAllModals();
      updateHomePage();
      showToast('✅ সব রিসেট হয়েছে');
    }
  });

  // DHIKR BACK BUTTONS
  document.getElementById('back-btn').addEventListener('click', () => navigateTo('home'));
  document.getElementById('reset-page-btn').addEventListener('click', () => {
    if (AppState.currentDhikrCategory) {
      resetCategoryProgress(AppState.currentDhikrCategory);
    }
  });

  document.getElementById('restart-btn').addEventListener('click', () => {
    if (AppState.currentDhikrCategory) {
      resetCategoryProgress(AppState.currentDhikrCategory);
    }
  });

  // TASBIH BACK
  document.getElementById('tasbih-back-btn').addEventListener('click', () => navigateTo('home'));

  // FAVORITES BACK
  document.getElementById('fav-back-btn').addEventListener('click', () => navigateTo('home'));

  // HISTORY BACK
  document.getElementById('history-back-btn').addEventListener('click', () => navigateTo('home'));

  // Initialize Tasbih
  initTasbih();

  // Keyboard escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}

// ===================== START =====================
document.addEventListener('DOMContentLoaded', init);
