document.addEventListener('DOMContentLoaded', () => {
  // Search Elements
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const sectionSelect = document.getElementById('section-select');
  const sortSelect = document.getElementById('sort-select');
  const visibleCount = document.getElementById('visible-count');
  const totalCount = document.getElementById('total-count');
  const statStudents = document.getElementById('stat-students');
  
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const leaderboardContainer = document.getElementById('leaderboard-container');
  const leaderboardBody = document.getElementById('leaderboard-body');

  const paginationContainer = document.getElementById('pagination-container');
  const pageSizeSelect = document.getElementById('page-size');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const pageNumbersContainer = document.getElementById('page-numbers');

  // Student Modal Elements
  const studentModal = document.getElementById('student-modal');
  const studentModalInner = document.getElementById('student-modal-inner');
  const studentModalClose = document.getElementById('student-modal-close');
  const modalImg = document.getElementById('modal-img');
  const modalName = document.getElementById('modal-name');
  const modalRollBadge = document.getElementById('modal-roll-badge');
  const modalSl = document.getElementById('modal-sl');
  const modalRoll = document.getElementById('modal-roll');
  const modalSection = document.getElementById('modal-section');
  const modalDept = document.getElementById('modal-dept');
  const modalSession = document.getElementById('modal-session');
  const modalSscSection = document.getElementById('modal-ssc-section');
  const modalSscMarks = document.getElementById('modal-ssc-marks');
  const modalSscGpa = document.getElementById('modal-ssc-gpa');
  const modalSchool = document.getElementById('modal-school');
  const modalSscUnlinked = document.getElementById('modal-ssc-unlinked');
  const modalCopyBtn = document.getElementById('modal-copy-btn');

  // Search Context Banner
  const searchContextBanner = document.getElementById('search-context-banner');

  // Privacy Policy Elements
  const openPrivacyBtn = document.getElementById('open-privacy-btn');
  const privacyModal = document.getElementById('privacy-modal');
  const privacyModalInner = document.getElementById('privacy-modal-inner');
  const privacyModalClose = document.getElementById('privacy-modal-close');
  const privacyModalOkBtn = document.getElementById('privacy-modal-ok-btn');

  // Welcome / Notice Modal Elements
  const welcomeModal = document.getElementById('welcome-modal');
  const welcomeModalInner = document.getElementById('welcome-modal-inner');
  const welcomeClose = document.getElementById('welcome-close');

  // Auth Modal Elements
  const authModal = document.getElementById('auth-modal');
  const authModalInner = document.getElementById('auth-modal-inner');
  const authModalClose = document.getElementById('auth-modal-close');
  const authLoginBtn = document.getElementById('auth-login-btn');

  // Toast
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');

  const AUTH_STORAGE_KEY = 'hscstack_auth_user';

  // State
  let isLoggedIn = null;
  let currentUser = null;
  let inFlightAuthPromise = null;

  // Restore authenticated session instantly from localStorage
  try {
    const cachedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (cachedAuth) {
      const parsed = JSON.parse(cachedAuth);
      if (parsed && parsed.authenticated && parsed.user) {
        isLoggedIn = true;
        currentUser = parsed.user;
      }
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  // Render initial profile state immediately (0ms delay)
  renderUserProfileWidget();
  initStaticEventListeners();

  let rawData = [];
  let filteredData = [];
  let currentPage = 1;
  let itemsPerPage = 25;
  let selectedStudent = null;
  let selectedSection = 'all';

  // Section calculation logic: 190 students per section (A: 1-190, B: 191-380, C: 381-570, D: 571-750)
  function getPossibleSection(indexNumber) {
    if (!indexNumber || indexNumber < 1) return 'A';
    if (indexNumber <= 190) return 'A';
    if (indexNumber <= 380) return 'B';
    if (indexNumber <= 570) return 'C';
    return 'D';
  }

  function getSectionBadgeClass(section) {
    switch (section) {
      case 'A':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
      case 'B':
        return 'bg-blue-50 text-blue-700 border border-blue-200/80';
      case 'C':
        return 'bg-purple-50 text-purple-700 border border-purple-200/80';
      case 'D':
        return 'bg-amber-50 text-amber-700 border border-amber-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  }

  // Search UI Mode State: 'all' | 'multi_select' | 'sequence_context'
  let currentViewMode = 'all';
  let lastSearchQuery = '';
  let multiMatchList = [];
  let focusedTargetRoll = null;

  function initStaticEventListeners() {
    if (authLoginBtn) {
      authLoginBtn.href = 'https://hscstack.site/login?redirect=' + encodeURIComponent(window.location.href);
      authLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'https://hscstack.site/login?redirect=' + encodeURIComponent(window.location.href);
      });
    }
    if (authModalClose) {
      authModalClose.addEventListener('click', closeAuthModal);
    }
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
      });
    }

    if (welcomeClose) {
      welcomeClose.addEventListener('click', closeWelcomeModal);
    }
    if (welcomeModal) {
      welcomeModal.addEventListener('click', (e) => {
        if (e.target === welcomeModal) closeWelcomeModal();
      });
    }

    if (openPrivacyBtn) openPrivacyBtn.addEventListener('click', openPrivacyModal);
    if (privacyModalClose) privacyModalClose.addEventListener('click', closePrivacyModal);
    if (privacyModalOkBtn) privacyModalOkBtn.addEventListener('click', closePrivacyModal);
    if (privacyModal) {
      privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) closePrivacyModal();
      });
    }

    if (studentModalClose) {
      studentModalClose.addEventListener('click', closeStudentModal);
    }
    if (studentModal) {
      studentModal.addEventListener('click', (e) => {
        if (e.target === studentModal) closeStudentModal();
      });
    }
    if (modalCopyBtn) {
      modalCopyBtn.addEventListener('click', () => {
        if (selectedStudent && selectedStudent.Roll) {
          copyToClipboard(selectedStudent.Roll);
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (welcomeModal && !welcomeModal.classList.contains('hidden')) closeWelcomeModal();
        if (studentModal && !studentModal.classList.contains('hidden')) closeStudentModal();
        if (privacyModal && !privacyModal.classList.contains('hidden')) closePrivacyModal();
        if (authModal && !authModal.classList.contains('hidden')) closeAuthModal();
      }
    });
  }

  // Initialize
  init();

  async function init() {
    try {
      showState('loading');

      // Check auth and load data
      const [, response] = await Promise.all([
        checkUserAuth(),
        loadStudentsData()
      ]);

      // Sort initially by Roll Number
      const sortedData = (response || []).slice().sort((a, b) => {
        return (a.Roll || '').localeCompare(b.Roll || '');
      });

      rawData = sortedData.map((item, idx) => {
        const indexNumber = idx + 1;
        const section = getPossibleSection(indexNumber);
        return {
          ...item,
          indexNumber,
          section,
          searchIndex: `${item.Roll || ''} ${item.Name || ''} ${item.Previous_School || ''} section ${section} sec ${section}`.toLowerCase()
        };
      });

      totalCount.textContent = rawData.length;
      if (statStudents) statStudents.textContent = rawData.length;

      renderTopFeederSchools(rawData);

      const allOption = pageSizeSelect ? pageSizeSelect.querySelector('option[value="all"]') : null;
      if (allOption) {
        allOption.textContent = `All (${rawData.length})`;
      }

      if (rawData.length === 0) {
        showState('empty');
        return;
      }

      resetToAllStudents();

      // Auto-show Welcome Notice once per new browser tab/session
      try {
        if (!sessionStorage.getItem('rgc_welcome_notice_tab_seen')) {
          setTimeout(() => {
            openWelcomeModal();
          }, 350);
        }
      } catch (e) {}

      // Event Listeners for Search
      if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
          e.preventDefault();
          if (isLoggedIn === false) {
            openAuthModal();
            return;
          }
          executeSearch();
        });
      }

      searchInput.addEventListener('click', handleSearchFocusOrClick);
      searchInput.addEventListener('focus', handleSearchFocusOrClick);
      searchInput.addEventListener('input', () => {
        const val = searchInput.value.trim();
        if (val.length > 0) {
          searchClearBtn.classList.remove('hidden');
          searchClearBtn.classList.add('flex');
        } else {
          searchClearBtn.classList.add('hidden');
          searchClearBtn.classList.remove('flex');
        }
      });

      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        searchClearBtn.classList.remove('flex');
        resetToAllStudents();
      });

      // Guard select auth check
      function guardSelectAuth(e, selectEl, defaultVal) {
        if (isLoggedIn === false) {
          e.preventDefault();
          selectEl.blur();
          if (defaultVal) selectEl.value = defaultVal;
          openAuthModal();
          return true;
        }
        return false;
      }

      // Section select auth check & handlers
      if (sectionSelect) {
        sectionSelect.addEventListener('mousedown', (e) => guardSelectAuth(e, sectionSelect, 'all'));
        sectionSelect.addEventListener('click', (e) => guardSelectAuth(e, sectionSelect, 'all'));
        sectionSelect.addEventListener('focus', (e) => guardSelectAuth(e, sectionSelect, 'all'));
        sectionSelect.addEventListener('change', (e) => {
          if (guardSelectAuth(e, sectionSelect, 'all')) return;
          selectedSection = sectionSelect.value;
          if (searchInput.value.trim()) {
            executeSearch();
          } else {
            resetToAllStudents();
          }
        });
      }

      // Sort select auth check & handlers
      sortSelect.addEventListener('mousedown', (e) => guardSelectAuth(e, sortSelect, 'roll-asc'));
      sortSelect.addEventListener('click', (e) => guardSelectAuth(e, sortSelect, 'roll-asc'));
      sortSelect.addEventListener('focus', (e) => guardSelectAuth(e, sortSelect, 'roll-asc'));
      sortSelect.addEventListener('change', (e) => {
        if (guardSelectAuth(e, sortSelect, 'roll-asc')) return;
        if (currentViewMode === 'all') {
          applySorting();
          renderLeaderboard();
        }
      });

      // Page size select auth check & handlers
      pageSizeSelect.addEventListener('mousedown', (e) => guardSelectAuth(e, pageSizeSelect, '25'));
      pageSizeSelect.addEventListener('click', (e) => guardSelectAuth(e, pageSizeSelect, '25'));
      pageSizeSelect.addEventListener('focus', (e) => guardSelectAuth(e, pageSizeSelect, '25'));
      pageSizeSelect.addEventListener('change', (e) => {
        if (guardSelectAuth(e, pageSizeSelect, '25')) return;
        const val = e.target.value;
        itemsPerPage = val === 'all' ? (rawData.length || 1000) : (parseInt(val, 10) || 25);
        currentPage = 1;
        renderLeaderboard();
      });

      btnPrev.addEventListener('click', () => {
        if (isLoggedIn === false) {
          openAuthModal();
          return;
        }
        if (currentPage > 1) {
          currentPage--;
          renderLeaderboard();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });

      btnNext.addEventListener('click', () => {
        if (isLoggedIn === false) {
          openAuthModal();
          return;
        }
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < totalPages) {
          currentPage++;
          renderLeaderboard();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });

    } catch (err) {
      console.error('Initialization error:', err);
      showState('empty');
    }
  }

  async function loadStudentsData() {
    if (window.INITIAL_STUDENTS_DATA && Array.isArray(window.INITIAL_STUDENTS_DATA)) {
      return window.INITIAL_STUDENTS_DATA;
    }
    try {
      const res = await fetch('students.json');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Direct fetch failed, falling back:', e);
    }
    return [];
  }

  // Auth System
  async function checkUserAuth() {
    if (isLoggedIn === true) {
      return true;
    }

    if (inFlightAuthPromise) {
      return inFlightAuthPromise;
    }

    inFlightAuthPromise = (async () => {
      let serverErrorOrTimeout = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch('https://hscstack.site/api/auth/status', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            isLoggedIn = true;
            currentUser = data.user || { name: 'User' };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ authenticated: true, user: currentUser }));
          } else {
            isLoggedIn = false;
            currentUser = null;
          }
        } else {
          serverErrorOrTimeout = true;
        }
      } catch (e) {
        serverErrorOrTimeout = true;
      } finally {
        inFlightAuthPromise = null;
        renderUserProfileWidget();
      }

      if (serverErrorOrTimeout) {
        return true;
      }

      return Boolean(isLoggedIn);
    })();

    return inFlightAuthPromise;
  }

  function renderUserProfileWidget() {
    const container = document.getElementById('user-profile-widget');

    if (!isLoggedIn || !currentUser) {
      if (container) {
        container.innerHTML = `
          <button
            type="button"
            id="top-profile-login-btn"
            class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-slate-800 hover:shadow-md active:scale-95 cursor-pointer"
          >
            <span class="material-symbols-rounded text-white text-[16px]">login</span>
            <span>Login</span>
          </button>
        `;
        const btn = document.getElementById('top-profile-login-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            openAuthModal();
          });
        }
      }
      return;
    }

    const name = currentUser.name || 'User';
    const rawImage = currentUser.image_url || currentUser.avatar || '';
    let imageUrl = '';
    if (rawImage) {
      imageUrl = rawImage.startsWith('http') ? rawImage : `https://hscstack.site${rawImage}`;
    }
    const profileUrl = currentUser.username
      ? `https://hscstack.site/u/${encodeURIComponent(currentUser.username)}`
      : 'https://hscstack.site/profile';
    const initial = name.trim().charAt(0).toUpperCase() || 'U';

    const avatarHtml = imageUrl
      ? `<img src="${imageUrl}" alt="${name}" class="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200" onerror="this.outerHTML='<span class=\\'flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white\\'>${initial}</span>'" />`
      : `<span class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white">${initial}</span>`;

    if (container) {
      container.innerHTML = `
        <a
          href="${profileUrl}"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 rounded-full border border-slate-200/90 bg-white py-1 pr-3 pl-1 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-98"
        >
          ${avatarHtml}
          <span class="max-w-[120px] truncate text-xs font-bold text-slate-800 hidden sm:inline-block">
            ${escapeHTML(name)}
          </span>
        </a>
      `;
    }
  }

  function handleSearchFocusOrClick(e) {
    if (isLoggedIn === false) {
      e.target.blur();
      openAuthModal();
    }
  }

  function resetToAllStudents() {
    currentViewMode = 'all';
    lastSearchQuery = '';
    multiMatchList = [];
    focusedTargetRoll = null;

    if (searchContextBanner) {
      searchContextBanner.classList.add('hidden');
      searchContextBanner.classList.remove('flex');
      searchContextBanner.innerHTML = '';
    }

    let baseList = rawData;
    if (selectedSection !== 'all') {
      baseList = rawData.filter(s => s.section === selectedSection);
    }

    filteredData = baseList.map(s => ({
      ...s,
      isDirectMatch: false,
      matchContext: null
    }));

    applySorting();

    visibleCount.textContent = filteredData.length;
    currentPage = 1;
    renderLeaderboard();
  }

  function applySorting() {
    const sort = sortSelect.value;
    filteredData.sort((a, b) => {
      if (sort === 'roll-asc') return (a.Roll || '').localeCompare(b.Roll || '');
      if (sort === 'roll-desc') return (b.Roll || '').localeCompare(a.Roll || '');
      if (sort === 'name-asc') return (a.Name || '').localeCompare(b.Name || '');
      if (sort === 'name-desc') return (b.Name || '').localeCompare(a.Name || '');
      return 0;
    });
  }

  function executeSearch() {
    const q = searchInput.value.trim().toLowerCase();
    lastSearchQuery = q;

    if (!q) {
      resetToAllStudents();
      return;
    }

    let sourceList = rawData;
    if (selectedSection !== 'all') {
      sourceList = rawData.filter(s => s.section === selectedSection);
    }

    // Find all matches
    const matches = sourceList.filter(s => s.searchIndex.includes(q));

    if (matches.length === 0) {
      currentViewMode = 'empty';
      filteredData = [];
      visibleCount.textContent = 0;
      if (searchContextBanner) {
        searchContextBanner.classList.add('hidden');
        searchContextBanner.classList.remove('flex');
      }
      showState('empty');
      return;
    }

    if (matches.length === 1) {
      // Exactly one match: display surrounding roll sequence directly
      showStudentSequence(matches[0], false);
    } else {
      // Multiple matches: show picker
      showMultiMatchPicker(matches, q);
    }
  }

  function showStudentSequence(targetStudent, hasParentMultiList) {
    currentViewMode = 'sequence_context';
    focusedTargetRoll = targetStudent.Roll;

    const targetIdx = rawData.findIndex(s => s.Roll === targetStudent.Roll);
    const WINDOW_SIZE = 3;
    const startIdx = Math.max(0, targetIdx - WINDOW_SIZE);
    const endIdx = Math.min(rawData.length - 1, targetIdx + WINDOW_SIZE);

    filteredData = rawData.slice(startIdx, endIdx + 1).map((item) => {
      const isDirectMatch = item.Roll === targetStudent.Roll;
      let matchContext = null;
      if (!isDirectMatch) {
        matchContext = item.indexNumber < targetStudent.indexNumber ? 'before' : 'after';
      }
      return {
        ...item,
        isDirectMatch,
        matchContext
      };
    });

    visibleCount.textContent = filteredData.length;
    currentPage = 1;

    // Render Clean Context Banner
    if (searchContextBanner) {
      searchContextBanner.classList.remove('hidden');
      searchContextBanner.classList.add('flex');
      searchContextBanner.className = 'flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs mb-2';
      
      const backBtnText = hasParentMultiList ? '← Matches' : `Show All (${rawData.length})`;

      searchContextBanner.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">${escapeHTML(targetStudent.Roll)}</span>
          <span class="text-slate-600 truncate text-[11px] sm:text-xs">Classmates sequence</span>
        </div>
        <button id="btn-banner-action" class="text-[11px] sm:text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer touch-manipulation">
          ${backBtnText}
        </button>
      `;

      const btnAction = document.getElementById('btn-banner-action');
      if (btnAction) {
        btnAction.addEventListener('click', () => {
          if (hasParentMultiList) {
            showMultiMatchPicker(multiMatchList, lastSearchQuery);
          } else {
            searchInput.value = '';
            searchClearBtn.classList.add('hidden');
            searchClearBtn.classList.remove('flex');
            resetToAllStudents();
          }
        });
      }
    }

    renderLeaderboard();
  }

  function showMultiMatchPicker(matches, query) {
    currentViewMode = 'multi_select';
    multiMatchList = matches;

    filteredData = matches.map(s => ({
      ...s,
      isDirectMatch: false,
      matchContext: null
    }));

    visibleCount.textContent = filteredData.length;
    currentPage = 1;

    // Render Multi Match Banner
    if (searchContextBanner) {
      searchContextBanner.classList.remove('hidden');
      searchContextBanner.classList.add('flex');
      searchContextBanner.className = 'flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs mb-2';
      searchContextBanner.innerHTML = `
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-bold text-slate-900 shrink-0">${matches.length} matches</span>
          <span class="text-slate-500 truncate text-[11px] sm:text-xs">Select to view roll sequence</span>
        </div>
        <button id="btn-reset-multi-banner" class="text-[11px] sm:text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer touch-manipulation">
          Show All
        </button>
      `;

      const btnResetBanner = document.getElementById('btn-reset-multi-banner');
      if (btnResetBanner) {
        btnResetBanner.addEventListener('click', () => {
          searchInput.value = '';
          searchClearBtn.classList.add('hidden');
          searchClearBtn.classList.remove('flex');
          resetToAllStudents();
        });
      }
    }

    renderLeaderboard();
  }

  function renderLeaderboard() {
    showState('leaderboard');

    const isPickerMode = currentViewMode === 'multi_select';
    const isSequenceMode = currentViewMode === 'sequence_context';

    const totalPages = isSequenceMode ? 1 : Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }

    const startIndex = isSequenceMode ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = isSequenceMode ? filteredData.length : Math.min(startIndex + itemsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);

    leaderboardBody.innerHTML = '';
    const q = lastSearchQuery;

    pageData.forEach(student => {
      const row = document.createElement('div');

      const highlightedName = highlight(student.Name, q);
      const highlightedRoll = highlight(student.Roll, q);

      const isDirectMatch = student.isDirectMatch;
      const matchContext = student.matchContext;

      // Clean, elegant card styling
      let cardStyle = 'group flex flex-col sm:flex-row sm:items-center bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 cursor-pointer hover:border-slate-300 hover:bg-slate-50/70 transition-all shadow-2xs touch-manipulation active:scale-[0.99]';
      let badgeHtml = '';

      if (isSequenceMode) {
        if (isDirectMatch) {
          cardStyle = 'group flex flex-col sm:flex-row sm:items-center bg-indigo-50/40 border border-indigo-200 ring-1 ring-indigo-500/20 rounded-xl p-3 sm:p-3.5 cursor-pointer hover:bg-indigo-50/60 transition-all shadow-xs touch-manipulation active:scale-[0.99]';
          badgeHtml = `
            <span class="inline-flex items-center gap-1 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 border border-indigo-200/60">
              Searched
            </span>
          `;
        } else if (matchContext === 'before') {
          badgeHtml = `
            <span class="inline-flex items-center rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 border border-slate-200/60">
              Before
            </span>
          `;
        } else if (matchContext === 'after') {
          badgeHtml = `
            <span class="inline-flex items-center rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 border border-slate-200/60">
              After
            </span>
          `;
        }
      }

      const rollBadgeClass = isSequenceMode && isDirectMatch
        ? 'font-mono text-xs sm:text-sm font-bold text-indigo-800 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-2xs'
        : 'font-mono text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200';

      const rollBadgeMobileClass = isSequenceMode && isDirectMatch
        ? 'font-mono text-xs font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200'
        : 'font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200';

      const nameClass = 'font-bold text-slate-900 text-sm sm:text-base leading-snug truncate group-hover:text-indigo-600 transition-colors';

      const actionButtonHtml = isPickerMode
        ? `<div class="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold group-hover:bg-slate-800 transition-colors shrink-0">
             <span>Select</span>
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
           </div>`
        : `<div class="w-8 flex justify-end shrink-0 pl-2">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5 text-slate-300 group-hover:text-slate-600 transition-colors" viewBox="0 0 20 20" fill="currentColor">
               <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
             </svg>
           </div>`;

      row.className = cardStyle;

      row.innerHTML = `
        <!-- Mobile View (visible block sm:hidden) -->
        <div class="flex sm:hidden items-center justify-between gap-2.5 w-full">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="font-mono text-xs font-bold text-slate-400 w-7 text-center shrink-0">
              #${student.indexNumber}
            </span>
            <div class="relative w-10 h-10 rounded-xl border border-slate-200 shrink-0 shadow-2xs overflow-hidden bg-slate-100">
              <img src="${escapeHTML(student.Image_URL)}" alt="" referrerpolicy="no-referrer" class="w-full h-full object-cover" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' fill=\\'%2394a3b8\\' viewBox=\\'0 0 24 24\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">
            </div>
            <div class="flex flex-col min-w-0 flex-1 gap-0.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="${nameClass}">
                  ${highlightedName}
                </span>
                ${badgeHtml}
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="${rollBadgeMobileClass}">
                  ${highlightedRoll}
                </span>
                <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${getSectionBadgeClass(student.section)}">
                  Sec ${student.section}
                </span>
              </div>
            </div>
          </div>
          <div class="shrink-0 text-slate-300 group-hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
        </div>

        <!-- Desktop View (visible sm:flex hidden) -->
        <div class="hidden sm:flex w-full items-center">
          <div class="w-12 text-center shrink-0 font-mono text-xs font-bold text-slate-400">
            ${student.indexNumber}
          </div>
          <div class="w-32 flex justify-center shrink-0">
            <div class="${rollBadgeClass}">
              ${highlightedRoll}
            </div>
          </div>
          <div class="w-12 flex justify-center shrink-0 ml-1">
            <div class="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
              <img src="${escapeHTML(student.Image_URL)}" alt="" referrerpolicy="no-referrer" class="w-full h-full object-cover" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' fill=\\'%2394a3b8\\' viewBox=\\'0 0 24 24\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">
            </div>
          </div>
          <div class="flex-1 px-4 min-w-0 flex items-center gap-3">
            <div class="${nameClass}">
              ${highlightedName}
            </div>
            ${badgeHtml}
          </div>
          <div class="w-24 flex justify-center shrink-0">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold ${getSectionBadgeClass(student.section)}">
              Sec ${student.section}
            </span>
          </div>
          ${actionButtonHtml}
        </div>
      `;

      row.addEventListener('click', () => {
        if (isPickerMode) {
          showStudentSequence(student, true);
        } else {
          openStudentModal(student);
        }
      });

      leaderboardBody.appendChild(row);
    });

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      paginationContainer.classList.add('hidden');
      return;
    }

    paginationContainer.classList.remove('hidden');
    paginationContainer.classList.add('flex');

    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;

    pageNumbersContainer.innerHTML = '';

    const isMobile = window.innerWidth < 640;
    const windowSize = isMobile ? 3 : 5;
    const half = Math.floor(windowSize / 2);

    let startPage = Math.max(1, currentPage - half);
    let endPage = Math.min(totalPages, startPage + windowSize - 1);

    if (endPage - startPage < windowSize - 1) {
      startPage = Math.max(1, endPage - windowSize + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl cursor-pointer text-xs sm:text-sm font-bold shrink-0 transition-all touch-manipulation ${
        currentPage === i
          ? 'bg-slate-900 text-white shadow-xs'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200'
      }`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        if (isLoggedIn === false) {
          openAuthModal();
          return;
        }
        currentPage = i;
        renderLeaderboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      pageNumbersContainer.appendChild(btn);
    }
  }

  // Modals
  function openStudentModal(student) {
    selectedStudent = student;
    modalImg.src = student.Image_URL || '';
    modalName.textContent = student.Name || 'Student';
    modalRollBadge.textContent = student.Roll || '-';
    if (modalSl) modalSl.textContent = student.indexNumber || '-';
    modalRoll.textContent = student.Roll || '-';
    if (modalSection) {
      modalSection.textContent = `Section ${student.section || 'A'}`;
      modalSection.className = `font-bold text-xs sm:text-sm font-mono px-2.5 py-0.5 rounded-lg ${getSectionBadgeClass(student.section)}`;
    }
    if (modalDept) {
      modalDept.textContent = student.Department || 'HSC - Science';
    }
    modalSession.textContent = student.Session || '2026-2027';

    // Populate SSC Data
    const hasSscData = student.SSC_Marks !== null && student.SSC_Marks !== undefined && student.SSC_Marks !== '';
    if (hasSscData) {
      if (modalSscSection) modalSscSection.classList.remove('hidden');
      if (modalSscUnlinked) modalSscUnlinked.classList.add('hidden');
      
      if (modalSscMarks) {
        modalSscMarks.textContent = student.SSC_Marks;
      }
      if (modalSscGpa) {
        const gpaVal = typeof student.SSC_GPA === 'number' ? student.SSC_GPA.toFixed(2) : (student.SSC_GPA || '5.00');
        modalSscGpa.textContent = `GPA ${gpaVal}`;
      }
      if (modalSchool) {
        modalSchool.textContent = student.Previous_School || 'Dinajpur Board School';
      }
    } else {
      if (modalSscSection) modalSscSection.classList.add('hidden');
      if (modalSscUnlinked) modalSscUnlinked.classList.remove('hidden');
    }

    studentModal.classList.remove('hidden');
    setTimeout(() => {
      studentModal.classList.add('opacity-100');
      studentModal.classList.remove('opacity-0', 'pointer-events-none');
      studentModalInner.classList.remove('scale-95', 'translate-y-8');
      studentModalInner.classList.add('scale-100', 'translate-y-0');
    }, 10);
    document.body.style.overflow = 'hidden';
  }

  function closeStudentModal() {
    studentModal.classList.remove('opacity-100');
    studentModal.classList.add('opacity-0', 'pointer-events-none');
    studentModalInner.classList.add('scale-95', 'translate-y-8');
    studentModalInner.classList.remove('scale-100', 'translate-y-0');
    setTimeout(() => {
      studentModal.classList.add('hidden');
    }, 250);
    document.body.style.overflow = '';
  }

  function openPrivacyModal() {
    if (!privacyModal) return;
    privacyModal.classList.remove('hidden');
    setTimeout(() => {
      privacyModal.classList.add('opacity-100');
      privacyModal.classList.remove('opacity-0', 'pointer-events-none');
      if (privacyModalInner) {
        privacyModalInner.classList.remove('scale-95');
        privacyModalInner.classList.add('scale-100');
      }
    }, 10);
    document.body.style.overflow = 'hidden';
  }

  function closePrivacyModal() {
    if (!privacyModal) return;
    privacyModal.classList.remove('opacity-100');
    privacyModal.classList.add('opacity-0', 'pointer-events-none');
    if (privacyModalInner) {
      privacyModalInner.classList.add('scale-95');
      privacyModalInner.classList.remove('scale-100');
    }
    setTimeout(() => {
      privacyModal.classList.add('hidden');
    }, 250);
    document.body.style.overflow = '';
  }

  function openAuthModal() {
    if (!authModal) return;
    authModal.classList.remove('hidden');
    setTimeout(() => {
      authModal.classList.add('opacity-100');
      authModal.classList.remove('opacity-0', 'pointer-events-none');
      authModalInner.classList.remove('scale-95');
      authModalInner.classList.add('scale-100');
    }, 10);
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    if (!authModal) return;
    authModal.classList.remove('opacity-100');
    authModal.classList.add('opacity-0', 'pointer-events-none');
    authModalInner.classList.add('scale-95');
    authModalInner.classList.remove('scale-100');
    setTimeout(() => {
      authModal.classList.add('hidden');
    }, 250);
    document.body.style.overflow = '';
  }

  function openWelcomeModal() {
    if (!welcomeModal) return;
    welcomeModal.classList.remove('hidden');
    setTimeout(() => {
      welcomeModal.classList.add('opacity-100');
      welcomeModal.classList.remove('opacity-0', 'pointer-events-none');
      if (welcomeModalInner) {
        welcomeModalInner.classList.remove('scale-95', 'translate-y-8');
        welcomeModalInner.classList.add('scale-100', 'translate-y-0');
      }
    }, 10);
    document.body.style.overflow = 'hidden';
  }

  function closeWelcomeModal() {
    if (!welcomeModal) return;
    welcomeModal.classList.remove('opacity-100');
    welcomeModal.classList.add('opacity-0', 'pointer-events-none');
    if (welcomeModalInner) {
      welcomeModalInner.classList.add('scale-95', 'translate-y-8');
      welcomeModalInner.classList.remove('scale-100', 'translate-y-0');
    }
    try {
      sessionStorage.setItem('rgc_welcome_notice_tab_seen', 'true');
    } catch (e) {}
    setTimeout(() => {
      welcomeModal.classList.add('hidden');
    }, 250);
    document.body.style.overflow = '';
  }

  function showToast(msg) {
    toastText.textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 2200);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Roll ${text} copied!`);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`Roll ${text} copied!`);
    });
  }

  function showState(state) {
    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');
    leaderboardContainer.classList.add('hidden');

    if (state === 'loading') {
      loadingState.classList.remove('hidden');
    } else if (state === 'empty') {
      emptyState.classList.remove('hidden');
    } else if (state === 'leaderboard') {
      leaderboardContainer.classList.remove('hidden');
    }
  }

  function renderTopFeederSchools(data) {
    const container = document.getElementById('top-schools-list');
    if (!container) return;

    const counts = {};
    data.forEach(student => {
      const school = (student.Previous_School || '').trim();
      if (school) {
        counts[school] = (counts[school] || 0) + 1;
      }
    });

    const sortedSchools = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (sortedSchools.length === 0) {
      const section = document.getElementById('top-schools-section');
      if (section) section.classList.add('hidden');
      return;
    }

    const rankConfig = [
      {
        rank: 1,
        medal: '🥇',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-300/80',
        cardBg: 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/30 border-amber-200/90',
        countBg: 'bg-amber-600 text-white'
      },
      {
        rank: 2,
        medal: '🥈',
        badgeBg: 'bg-slate-100 text-slate-800 border-slate-300/80',
        cardBg: 'bg-gradient-to-br from-slate-50/90 via-white to-slate-50/40 border-slate-200',
        countBg: 'bg-slate-700 text-white'
      },
      {
        rank: 3,
        medal: '🥉',
        badgeBg: 'bg-orange-100 text-orange-900 border-orange-300/80',
        cardBg: 'bg-gradient-to-br from-orange-50/80 via-white to-orange-50/20 border-orange-200/90',
        countBg: 'bg-orange-600 text-white'
      }
    ];

    container.innerHTML = sortedSchools.map(([schoolName, count], idx) => {
      const conf = rankConfig[idx] || rankConfig[2];
      const parts = schoolName.split(',');
      const mainName = parts[0].trim();
      const location = parts.slice(1).join(',').trim();

      return `
        <div
          class="flex flex-col justify-between w-[72vw] xs:w-[240px] sm:w-auto shrink-0 snap-start p-3 sm:p-3.5 rounded-2xl border ${conf.cardBg} shadow-2xs"
        >
          <div class="flex items-center justify-between gap-1.5 mb-1.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-black ${conf.badgeBg}">
              <span>${conf.medal}</span>
              <span>#${conf.rank}</span>
            </span>
            <span class="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-2xs ${conf.countBg}">
              ${count} Students
            </span>
          </div>

          <div class="min-w-0">
            <h4 class="text-xs sm:text-sm font-black text-slate-900 line-clamp-2 leading-snug">
              ${escapeHTML(mainName)}
            </h4>
            ${location ? `<p class="text-[11px] font-medium text-slate-500 mt-0.5 truncate">${escapeHTML(location)}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function highlight(text, query) {
    if (!query || !text) return escapeHTML(text);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escapeHTML(text).replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-amber-200 text-amber-900 rounded px-0.5">$1</mark>');
  }
});
