document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
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
  const modalRoll = document.getElementById('modal-roll');
  const modalSession = document.getElementById('modal-session');
  const modalYear = document.getElementById('modal-year');
  const modalCopyBtn = document.getElementById('modal-copy-btn');
  const modalPrevStudent = document.getElementById('modal-prev-student');
  const modalNextStudent = document.getElementById('modal-next-student');

  // Search Context Banner
  const searchContextBanner = document.getElementById('search-context-banner');

  // Auth Modal Elements
  const authModal = document.getElementById('auth-modal');
  const authModalInner = document.getElementById('auth-modal-inner');
  const authModalClose = document.getElementById('auth-modal-close');
  const authLoginBtn = document.getElementById('auth-login-btn');

  // Mobile Drawer Elements
  const mobileDrawerToggle = document.getElementById('mobile-drawer-toggle');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileDrawerBackdrop = document.getElementById('mobile-drawer-backdrop');
  const mobileDrawerPanel = document.getElementById('mobile-drawer-panel');
  const mobileDrawerClose = document.getElementById('mobile-drawer-close');

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

  let rawData = [];
  let filteredData = [];
  let currentPage = 1;
  let itemsPerPage = 25;
  let selectedStudent = null;

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

      rawData = sortedData.map((item, idx) => ({
        ...item,
        indexNumber: idx + 1,
        searchIndex: `${item.Roll || ''} ${item.Name || ''}`.toLowerCase()
      }));

      totalCount.textContent = rawData.length;
      if (statStudents) statStudents.textContent = rawData.length;

      if (rawData.length === 0) {
        showState('empty');
        return;
      }

      applyFilters();

      // Event Listeners
      searchInput.addEventListener('click', handleSearchFocusOrClick);
      searchInput.addEventListener('focus', handleSearchFocusOrClick);
      searchInput.addEventListener('input', handleSearchInput);
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        searchClearBtn.classList.remove('flex');
        applyFilters();
      });

      // Sort select auth check & handlers
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

      sortSelect.addEventListener('mousedown', (e) => guardSelectAuth(e, sortSelect, 'roll-asc'));
      sortSelect.addEventListener('click', (e) => guardSelectAuth(e, sortSelect, 'roll-asc'));
      sortSelect.addEventListener('focus', (e) => guardSelectAuth(e, sortSelect, 'roll-asc'));
      sortSelect.addEventListener('change', (e) => {
        if (guardSelectAuth(e, sortSelect, 'roll-asc')) return;
        applyFilters();
      });

      // Page size select auth check & handlers
      pageSizeSelect.addEventListener('mousedown', (e) => guardSelectAuth(e, pageSizeSelect, '25'));
      pageSizeSelect.addEventListener('click', (e) => guardSelectAuth(e, pageSizeSelect, '25'));
      pageSizeSelect.addEventListener('focus', (e) => guardSelectAuth(e, pageSizeSelect, '25'));
      pageSizeSelect.addEventListener('change', (e) => {
        if (guardSelectAuth(e, pageSizeSelect, '25')) return;
        itemsPerPage = parseInt(e.target.value, 10);
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

      // Student Modals
      studentModalClose.addEventListener('click', closeStudentModal);
      studentModal.addEventListener('click', (e) => {
        if (e.target === studentModal) closeStudentModal();
      });

      if (modalPrevStudent) {
        modalPrevStudent.addEventListener('click', () => {
          if (!selectedStudent) return;
          const curIdx = rawData.findIndex(s => s.Roll === selectedStudent.Roll);
          if (curIdx > 0) {
            openStudentModal(rawData[curIdx - 1]);
          }
        });
      }

      if (modalNextStudent) {
        modalNextStudent.addEventListener('click', () => {
          if (!selectedStudent) return;
          const curIdx = rawData.findIndex(s => s.Roll === selectedStudent.Roll);
          if (curIdx >= 0 && curIdx < rawData.length - 1) {
            openStudentModal(rawData[curIdx + 1]);
          }
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
      if (authLoginBtn) {
        authLoginBtn.addEventListener('click', () => {
          window.location.href = 'https://hscstack.site/login?redirect=' + encodeURIComponent(window.location.href);
        });
      }

      modalCopyBtn.addEventListener('click', () => {
        if (selectedStudent && selectedStudent.Roll) {
          copyToClipboard(selectedStudent.Roll);
        }
      });

      // Mobile Drawer Listeners
      if (mobileDrawerToggle) mobileDrawerToggle.addEventListener('click', openMobileDrawer);
      if (mobileDrawerClose) mobileDrawerClose.addEventListener('click', closeMobileDrawer);
      if (mobileDrawerBackdrop) mobileDrawerBackdrop.addEventListener('click', closeMobileDrawer);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (mobileDrawer && !mobileDrawer.classList.contains('hidden')) closeMobileDrawer();
          if (!studentModal.classList.contains('hidden')) closeStudentModal();
          if (authModal && !authModal.classList.contains('hidden')) closeAuthModal();
        } else if (e.key === 'ArrowLeft') {
          if (!studentModal.classList.contains('hidden') && selectedStudent) {
            const curIdx = rawData.findIndex(s => s.Roll === selectedStudent.Roll);
            if (curIdx > 0) openStudentModal(rawData[curIdx - 1]);
          }
        } else if (e.key === 'ArrowRight') {
          if (!studentModal.classList.contains('hidden') && selectedStudent) {
            const curIdx = rawData.findIndex(s => s.Roll === selectedStudent.Roll);
            if (curIdx >= 0 && curIdx < rawData.length - 1) openStudentModal(rawData[curIdx + 1]);
          }
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

  // Auth System (Matches HSCStack / Dinajpur standard)
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

  function handleSearchInput() {
    if (isLoggedIn === false) {
      searchInput.value = '';
      openAuthModal();
      return;
    }
    const val = searchInput.value.trim();
    if (val.length > 0) {
      searchClearBtn.classList.remove('hidden');
      searchClearBtn.classList.add('flex');
    } else {
      searchClearBtn.classList.add('hidden');
      searchClearBtn.classList.remove('flex');
    }
    applyFilters();
  }

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    const sort = sortSelect.value;

    if (!q) {
      if (searchContextBanner) {
        searchContextBanner.classList.add('hidden');
        searchContextBanner.classList.remove('flex');
      }

      filteredData = rawData.map(s => ({
        ...s,
        isDirectMatch: false,
        matchContext: null
      }));

      filteredData.sort((a, b) => {
        if (sort === 'roll-asc') return (a.Roll || '').localeCompare(b.Roll || '');
        if (sort === 'roll-desc') return (b.Roll || '').localeCompare(a.Roll || '');
        if (sort === 'name-asc') return (a.Name || '').localeCompare(b.Name || '');
        if (sort === 'name-desc') return (b.Name || '').localeCompare(a.Name || '');
        return 0;
      });
    } else {
      // Find all indices in master roll order (rawData) that match
      const matchIndices = [];
      rawData.forEach((item, idx) => {
        if (item.searchIndex.includes(q)) {
          matchIndices.push(idx);
        }
      });

      if (matchIndices.length === 0) {
        if (searchContextBanner) {
          searchContextBanner.classList.add('hidden');
          searchContextBanner.classList.remove('flex');
        }
        filteredData = [];
      } else {
        // Build surrounding windows (3 in front, 3 after for each match)
        const WINDOW_SIZE = 3;
        const includedIndices = new Set();

        matchIndices.forEach(matchIdx => {
          const start = Math.max(0, matchIdx - WINDOW_SIZE);
          const end = Math.min(rawData.length - 1, matchIdx + WINDOW_SIZE);
          for (let i = start; i <= end; i++) {
            includedIndices.add(i);
          }
        });

        const sortedIndices = Array.from(includedIndices).sort((a, b) => a - b);

        filteredData = sortedIndices.map(idx => {
          const item = rawData[idx];
          const isDirectMatch = matchIndices.includes(idx);
          let matchContext = null;

          if (!isDirectMatch) {
            // Find closest match index
            let minDiff = Infinity;
            let closestMatchIdx = matchIndices[0];
            matchIndices.forEach(mIdx => {
              const diff = Math.abs(idx - mIdx);
              if (diff < minDiff) {
                minDiff = diff;
                closestMatchIdx = mIdx;
              }
            });

            if (idx < closestMatchIdx) {
              matchContext = 'in_front';
            } else {
              matchContext = 'after';
            }
          }

          return {
            ...item,
            isDirectMatch,
            matchContext
          };
        });

        // If user explicitly chose a sort other than roll-asc, respect it or keep natural sequence
        if (sort !== 'roll-asc') {
          filteredData.sort((a, b) => {
            if (sort === 'roll-desc') return (b.Roll || '').localeCompare(a.Roll || '');
            if (sort === 'name-asc') return (a.Name || '').localeCompare(b.Name || '');
            if (sort === 'name-desc') return (b.Name || '').localeCompare(a.Name || '');
            return 0;
          });
        }

        if (searchContextBanner) {
          searchContextBanner.classList.remove('hidden');
          searchContextBanner.classList.add('flex');
        }
      }
    }

    visibleCount.textContent = filteredData.length;
    currentPage = 1;

    if (filteredData.length === 0) {
      showState('empty');
    } else {
      renderLeaderboard();
    }
  }

  function renderLeaderboard() {
    showState('leaderboard');
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);

    leaderboardBody.innerHTML = '';
    const q = searchInput.value.trim();

    pageData.forEach(student => {
      const row = document.createElement('div');

      const highlightedName = highlight(student.Name, q);
      const highlightedRoll = highlight(student.Roll, q);

      const isDirectMatch = student.isDirectMatch;
      const matchContext = student.matchContext;

      // Base style
      let cardStyle = 'group flex flex-col sm:flex-row sm:items-center bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm';
      let badgeHtml = '';

      if (q && isDirectMatch) {
        cardStyle = 'group flex flex-col sm:flex-row sm:items-center bg-indigo-50/50 border-2 border-indigo-500/50 ring-2 ring-indigo-500/20 rounded-xl p-4 cursor-pointer hover:bg-indigo-50/80 transition-all shadow-md';
        badgeHtml = `
          <span class="inline-flex items-center gap-1 rounded-full bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 shadow-2xs">
            <span class="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
            Matched
          </span>
        `;
      } else if (q && matchContext === 'in_front') {
        cardStyle = 'group flex flex-col sm:flex-row sm:items-center bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 cursor-pointer hover:bg-white hover:border-slate-300 transition-all shadow-2xs opacity-90 hover:opacity-100';
        badgeHtml = `
          <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5">
            In Front
          </span>
        `;
      } else if (q && matchContext === 'after') {
        cardStyle = 'group flex flex-col sm:flex-row sm:items-center bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 cursor-pointer hover:bg-white hover:border-slate-300 transition-all shadow-2xs opacity-90 hover:opacity-100';
        badgeHtml = `
          <span class="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-bold px-2 py-0.5">
            After
          </span>
        `;
      }

      row.className = cardStyle;

      row.innerHTML = `
        <!-- Mobile View (visible block sm:hidden) -->
        <div class="flex sm:hidden items-center justify-between gap-3 w-full">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
              <img src="${escapeHTML(student.Image_URL)}" alt="" referrerpolicy="no-referrer" class="w-full h-full object-cover" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' fill=\'%2394a3b8\' viewBox=\'0 0 24 24\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>'">
            </div>
            <div class="flex flex-col min-w-0 flex-1 gap-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-slate-800 text-base leading-snug truncate group-hover:text-indigo-600 transition-colors">
                  ${highlightedName}
                </span>
                ${badgeHtml}
              </div>
              <div>
                <span class="font-mono text-xs font-bold ${isDirectMatch ? 'text-indigo-900 bg-indigo-100 border-indigo-300' : 'text-indigo-700 bg-indigo-50 border-indigo-100'} px-2 py-0.5 rounded-md border">
                  ${highlightedRoll}
                </span>
              </div>
            </div>
          </div>
          <div class="shrink-0 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
        </div>

        <!-- Desktop View (visible sm:flex hidden) -->
        <div class="hidden sm:flex w-full items-center">
          <div class="w-36 flex justify-center shrink-0">
            <div class="font-mono text-sm font-bold ${isDirectMatch ? 'text-indigo-900 bg-indigo-100/90 border-indigo-300 ring-2 ring-indigo-500/20' : 'text-indigo-700 bg-indigo-50 border-indigo-100'} px-3 py-1.5 rounded-xl border transition-all">
              ${highlightedRoll}
            </div>
          </div>
          <div class="w-12 flex justify-center shrink-0 ml-1">
            <div class="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
              <img src="${escapeHTML(student.Image_URL)}" alt="" referrerpolicy="no-referrer" class="w-full h-full object-cover" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' fill=\'%2394a3b8\' viewBox=\'0 0 24 24\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>'">
            </div>
          </div>
          <div class="flex-1 px-4 min-w-0 flex items-center gap-3">
            <div class="font-bold text-slate-800 text-base truncate group-hover:text-indigo-600 transition-colors">
              ${highlightedName}
            </div>
            ${badgeHtml}
          </div>
          <div class="w-8 flex justify-end shrink-0 pl-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
        </div>
      `;

      row.addEventListener('click', () => openStudentModal(student));
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

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement('div');
      btn.className = `w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl cursor-pointer font-bold shrink-0 transition-all ${
        currentPage === i
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
    modalRoll.textContent = student.Roll || '-';
    modalSession.textContent = student.Session || '2026-2027';
    modalYear.textContent = student['Academic Year'] ? `Year ${student['Academic Year']}` : '1st Year';

    // Update In Front (Prev) / After (Next) button states
    const curIdx = rawData.findIndex(s => s.Roll === student.Roll);
    if (modalPrevStudent) {
      modalPrevStudent.disabled = curIdx <= 0;
    }
    if (modalNextStudent) {
      modalNextStudent.disabled = curIdx < 0 || curIdx >= rawData.length - 1;
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

  function openMobileDrawer() {
    if (!mobileDrawer) return;
    mobileDrawer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      if (mobileDrawerBackdrop) mobileDrawerBackdrop.classList.remove('opacity-0');
      if (mobileDrawerBackdrop) mobileDrawerBackdrop.classList.add('opacity-100');
      if (mobileDrawerPanel) mobileDrawerPanel.classList.remove('-translate-x-full');
      if (mobileDrawerPanel) mobileDrawerPanel.classList.add('translate-x-0');
    }, 10);
  }

  function closeMobileDrawer() {
    if (!mobileDrawer) return;
    if (mobileDrawerBackdrop) mobileDrawerBackdrop.classList.remove('opacity-100');
    if (mobileDrawerBackdrop) mobileDrawerBackdrop.classList.add('opacity-0');
    if (mobileDrawerPanel) mobileDrawerPanel.classList.remove('translate-x-0');
    if (mobileDrawerPanel) mobileDrawerPanel.classList.add('-translate-x-full');
    document.body.style.overflow = '';
    setTimeout(() => {
      mobileDrawer.classList.add('hidden');
    }, 250);
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
