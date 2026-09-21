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
  const modalName = document.getElementById('modal-name');
  const modalRollBadge = document.getElementById('modal-roll-badge');
  const modalSl = document.getElementById('modal-sl');
  const modalRoll = document.getElementById('modal-roll');
  const modalSection = document.getElementById('modal-section');
  const modalDept = document.getElementById('modal-dept');
  const modalSession = document.getElementById('modal-session');
  const modalSchool = document.getElementById('modal-school');
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

  // Theme system — mirrors platform resources/js/lib/useDarkMode.ts:
  // same 'theme' localStorage key, same light/dark/system cycle.
  // Per-origin storage means this won't sync with hscstack.site;
  // both sides just resolve 'system' from the OS preference.
  var currentTheme = 'system';
  try {
    var storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      currentTheme = storedTheme;
    }
  } catch (e) {}

  function resolveDark(t) {
    if (t === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return t === 'dark';
  }

  function refreshThemeIcon() {
    var icon = document.getElementById('rail-theme-icon') || document.getElementById('theme-toggle-icon');
    if (icon) {
      icon.textContent = currentTheme === 'dark' ? 'dark_mode' : currentTheme === 'light' ? 'light_mode' : 'computer';
    }
    var btn = document.getElementById('rail-theme-toggle');
    if (btn) btn.title = 'Current theme: ' + currentTheme + '. Click to switch.';
    refreshAppearanceSegmented();
  }

  // Platform parity: the Light/Dark/System segmented control in the rail
  // footer + drawer pinned footer highlights the active theme.
  var SEG_ACTIVE = ['bg-white', 'text-slate-900', 'shadow-sm', 'dark:bg-slate-700', 'dark:text-slate-100'];
  var SEG_IDLE = ['text-slate-500', 'hover:text-slate-800', 'dark:text-slate-400', 'dark:hover:text-slate-200'];

  function refreshAppearanceSegmented() {
    document.querySelectorAll('[data-set-theme]').forEach(function (el) {
      var isActive = el.getAttribute('data-set-theme') === currentTheme;
      SEG_ACTIVE.forEach(function (c) { el.classList.toggle(c, isActive); });
      SEG_IDLE.forEach(function (c) { el.classList.toggle(c, !isActive); });
    });
  }

  function applyTheme() {
    var dark = resolveDark(currentTheme);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    var themeColor = dark ? '#030712' : '#f8fafc';
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', themeColor);
    var navButton = document.querySelector('meta[name="msapplication-navbutton-color"]');
    if (navButton) navButton.setAttribute('content', themeColor);
    try {
      localStorage.setItem('theme', currentTheme);
    } catch (e) {}
    refreshThemeIcon();
  }

  function cycleTheme() {
    var order = ['system', 'light', 'dark'];
    currentTheme = order[(order.indexOf(currentTheme) + 1) % order.length];
    applyTheme();
  }

  applyTheme();

  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (currentTheme === 'system') applyTheme();
    });
    window.addEventListener('storage', function (e) {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system')) {
        currentTheme = e.newValue;
        applyTheme();
      }
    });
  } catch (e) {}

  /* ================================================================
   * Platform shell — vanilla port of resources/js/components/
   * navigation/Navigation.tsx (SiteRail/SiteDrawer/SiteBottomNav)
   * plus lib/navigation.ts + lib/useBottomNavCustomization.ts.
   *
   * All links are absolute (https://hscstack.site/...) so the rail,
   * drawer and bottom bar behave like the platform itself.
   * Active states resolve against VIRTUAL_PATH: this directory is
   * reached via More From Us (/projects), so that row renders
   * active — the user feels they never left the site.
   * ================================================================ */
  var PLATFORM_ORIGIN = 'https://hscstack.site';
  var VIRTUAL_PATH = '/projects/rgc-students';
  var NAV_SPEC_CACHE_KEY = 'hscstack_nav_spec_v1';
  var RAIL_KEY = 'rail_collapsed';

  // Baked-in fallback = live platform spec (resources/js/lib/navigation.ts).
  // Refreshed at runtime from GET /api/navigation when available.
  var DEFAULT_NAV_SPEC = {
    primary: [
      { label: 'Home', href: '/', icon: 'home', showInBottom: true },
      { label: 'Tracker', href: '/tracker', icon: 'timer', showInBottom: true },
      { label: 'People', href: '/peers', icon: 'group', showInBottom: true },
      { label: 'Forum', href: '/forum', icon: 'forum', showInBottom: true },
      { label: 'Chat', href: '/chat', icon: 'chat', showInBottom: true },
      { label: 'Blogs', href: '/blogs', icon: 'menu_book', showInBottom: false },
      { label: 'AI', href: '/ai', icon: 'smart_toy', showInBottom: false }
    ],
    overflow: [
      { label: 'Support Center', href: '/support', icon: 'help', showInBottom: false },
      { label: 'Donate', href: '/donate', icon: 'volunteer_activism', showInBottom: false }
    ]
  };

  var currentNavSpec = DEFAULT_NAV_SPEC;

  function absUrl(href) {
    return PLATFORM_ORIGIN + href;
  }

  // Platform preferredHomeHref: users with an SSC preference land on /ssc.
  function homeUrl() {
    try {
      if (localStorage.getItem('preferred_course') === 'ssc') return PLATFORM_ORIGIN + '/ssc';
    } catch (e) {}
    return PLATFORM_ORIGIN;
  }

  function syncHomeLinks() {
    var url = homeUrl();
    document.querySelectorAll('[data-home-link]').forEach(function (a) {
      a.setAttribute('href', url);
    });
  }

  function allNavItems(spec) {
    spec = spec || currentNavSpec;
    return (spec.primary || []).concat(spec.overflow || []);
  }

  function sanitizeNavItem(raw) {
    if (!raw || typeof raw.label !== 'string' || typeof raw.href !== 'string' || typeof raw.icon !== 'string') {
      return null;
    }
    if (raw.href.charAt(0) !== '/' || raw.href.indexOf('//') === 0) return null;
    if (!/^[a-z0-9_]+$/.test(raw.icon)) return null;
    return { label: raw.label.slice(0, 32), href: raw.href.slice(0, 64), icon: raw.icon, showInBottom: raw.showInBottom === true };
  }

  function sanitizeNavSpec(raw) {
    if (!raw || !Array.isArray(raw.primary) || !Array.isArray(raw.overflow)) return null;
    var primary = raw.primary.map(sanitizeNavItem).filter(Boolean);
    var overflow = raw.overflow.map(sanitizeNavItem).filter(Boolean);
    if (primary.length === 0) return null;
    return { primary: primary, overflow: overflow };
  }

  function loadCachedNavSpec() {
    try {
      var raw = localStorage.getItem(NAV_SPEC_CACHE_KEY);
      if (!raw) return null;
      return sanitizeNavSpec(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  // Live nav sync: same channel as the auth check (same-site + CORS-open),
  // so sidebar items follow the platform with zero redeploys.
  var navRefreshInFlight = false;

  function refreshNavSpec() {
    if (navRefreshInFlight) return;
    navRefreshInFlight = true;
    var controller = null;
    try {
      controller = new AbortController();
    } catch (e) {}
    var timeoutId = null;
    if (controller) {
      timeoutId = setTimeout(function () { try { controller.abort(); } catch (e) {} }, 2500);
    }
    fetch(PLATFORM_ORIGIN + '/api/navigation', controller ? { signal: controller.signal } : {})
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (data) {
        var spec = sanitizeNavSpec(data);
        if (!spec) return;
        if (JSON.stringify(spec) === JSON.stringify(currentNavSpec)) return;
        currentNavSpec = spec;
        try {
          localStorage.setItem(NAV_SPEC_CACHE_KEY, JSON.stringify(spec));
        } catch (e) {}
        renderAllNav();
      })
      .catch(function () {})
      .then(function () {
        navRefreshInFlight = false;
        if (timeoutId) clearTimeout(timeoutId);
      });
  }

  // Platform rail label rules (Navigation.tsx): collapsed shortens
  // Support Center; expanded uses Global Chat for /chat.
  function collapsedLabel(item) {
    return item.href === '/support' ? 'Support' : item.label;
  }

  function expandedLabel(item) {
    return item.href === '/chat' ? 'Global Chat' : item.label;
  }

  var RAIL_ROW_BASE = 'group flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium tracking-tight transition-colors duration-150 ';
  var RAIL_ICON_BASE = 'material-symbols-rounded shrink-0 text-[22px] transition-colors duration-150 ';
  var RAIL_IDLE = 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100';
  var RAIL_ICON_IDLE = 'text-slate-500 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300';

  function renderRailNav() {
    var items = allNavItems();
    var col = document.getElementById('rail-nav-collapsed');
    if (col) {
      col.innerHTML = items.map(function (item) {
        var homeAttr = item.href === '/' ? ' data-home-link' : '';
        return '<a href="' + absUrl(item.href) + '"' + homeAttr + ' title="' + escapeHTML(item.label) + '" class="group flex h-[60px] w-full flex-col items-center justify-center rounded-xl px-1 text-center text-slate-600 transition-colors duration-150 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100">' +
          '<span class="' + RAIL_ICON_BASE + 'text-slate-500 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300">' + item.icon + '</span>' +
          '<span class="mt-1 max-w-[64px] truncate text-[10px] font-medium leading-tight">' + escapeHTML(collapsedLabel(item)) + '</span></a>';
      }).join('');
    }
    var exp = document.getElementById('rail-nav-expanded');
    if (exp) {
      var rows = items.map(function (item) {
        var homeAttr = item.href === '/' ? ' data-home-link' : '';
        return '<a href="' + absUrl(item.href) + '"' + homeAttr + ' class="' + RAIL_ROW_BASE + RAIL_IDLE + '">' +
          '<span class="' + RAIL_ICON_BASE + RAIL_ICON_IDLE + '">' + item.icon + '</span>' +
          '<span class="truncate">' + escapeHTML(expandedLabel(item)) + '</span></a>';
      }).join('');
      var platformSection = exp.querySelector('[data-platform-section]');
      if (platformSection) {
        exp.innerHTML = rows;
        exp.appendChild(platformSection);
      } else {
        exp.innerHTML = rows;
      }
    }
    syncHomeLinks();
  }

  function renderBottomNav() {
    var host = document.getElementById('bottom-nav-items');
    if (!host) return;
    // Live platform rule: primary items flagged showInBottom (static, no account tab).
    var items = (currentNavSpec.primary || []).filter(function (i) { return i.showInBottom; });
    host.innerHTML = items.map(function (item) {
      var active = VIRTUAL_PATH.indexOf(item.href) === 0 && item.href !== '/';
      return '' +
        '<a href="' + absUrl(item.href) + '"' + (item.href === '/' ? ' data-home-link' : '') + ' class="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all duration-150 ease-out ' + (active ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200') + '">' +
        '<span class="material-symbols-rounded shrink-0 transition-transform duration-150 text-[26px] ' + (active ? 'scale-[1.02] text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400') + '">' + item.icon + '</span>' +
        '<span class="text-[10px] leading-none tracking-wide antialiased ' + (active ? 'font-bold' : 'font-medium') + '">' + escapeHTML(item.label) + '</span>' +
        '</a>';
    }).join('');
    syncHomeLinks();
  }

  function renderDrawerMore() {
    var host = document.getElementById('drawer-more');
    if (!host) return;
    // Live platform rule: everything not flagged showInBottom.
    var items = allNavItems().filter(function (i) { return !i.showInBottom; });
    if (items.length === 0) {
      host.innerHTML = '<p class="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">All items are in your bottom bar. Customize in Profile → Bottom navigation.</p>';
      return;
    }
    host.innerHTML = items.map(function (item) {
      var active = VIRTUAL_PATH.indexOf(item.href) === 0;
      return '' +
        '<a href="' + absUrl(item.href) + '" data-drawer-link class="group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium tracking-tight transition-all duration-150 ease-out ' + (active ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/20' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100') + '">' +
        '<span class="material-symbols-rounded shrink-0 text-[22px] transition-colors duration-150 ' + (active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300') + '">' + item.icon + '</span>' +
        '<span class="truncate">' + escapeHTML(item.label) + '</span>' +
        (active ? '<span class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>' : '') +
        '</a>';
    }).join('');
    host.querySelectorAll('[data-drawer-link]').forEach(function (a) {
      a.addEventListener('click', closeDrawer);
    });
  }

  function renderAllNav() {
    renderRailNav();
    renderBottomNav();
    renderDrawerMore();
  }

  /* ---- Rail collapse (same `rail_collapsed` key as the platform) ---- */
  function setRailCollapsed(collapsed) {
    var rail = document.getElementById('site-rail');
    if (!rail) return;
    rail.classList.toggle('w-[72px]', collapsed);
    rail.classList.toggle('w-[280px]', !collapsed);
    var pairs = [
      ['rail-nav-collapsed', true], ['rail-nav-expanded', false],
      ['rail-footer-collapsed', true], ['rail-footer-expanded', false]
    ];
    pairs.forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      var showWhenCollapsed = pair[1];
      var show = collapsed === showWhenCollapsed;
      el.classList.toggle('hidden', !show);
      el.classList.toggle('flex', show && showWhenCollapsed);
    });
    var logoWrap = document.getElementById('rail-logo-wrap');
    if (logoWrap) {
      logoWrap.classList.toggle('w-0', collapsed);
      logoWrap.classList.toggle('opacity-0', collapsed);
      logoWrap.classList.toggle('pointer-events-none', collapsed);
      logoWrap.classList.toggle('w-[200px]', !collapsed);
      logoWrap.classList.toggle('opacity-100', !collapsed);
    }
    var toggle = document.getElementById('rail-toggle');
    if (toggle) toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    try {
      localStorage.setItem(RAIL_KEY, String(collapsed));
    } catch (e) {}
  }

  function initRail() {
    var collapsed = false;
    try {
      collapsed = localStorage.getItem(RAIL_KEY) === 'true';
    } catch (e) {}
    setRailCollapsed(collapsed);
    var toggle = document.getElementById('rail-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var rail = document.getElementById('site-rail');
        setRailCollapsed(!rail.classList.contains('w-[72px]'));
      });
    }
    document.querySelectorAll('[data-set-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.getAttribute('data-set-theme');
        if (val === 'light' || val === 'dark' || val === 'system') {
          currentTheme = val;
          applyTheme();
        }
      });
    });
    var cycle = document.getElementById('rail-theme-toggle');
    if (cycle) cycle.addEventListener('click', cycleTheme);
    refreshAppearanceSegmented();
  }

  /* ---- Drawer (focus trap + Escape + overlay + body lock, like useDialogA11y) ---- */
  var drawerLastFocused = null;
  var drawerKeyHandler = null;

  function drawerFocusables() {
    var panel = document.getElementById('drawer-panel');
    if (!panel) return [];
    return Array.from(panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null; });
  }

  function openDrawer() {
    var root = document.getElementById('drawer-root');
    var panel = document.getElementById('drawer-panel');
    if (!root || !panel) return;
    drawerLastFocused = document.activeElement;
    root.classList.remove('hidden');
    root.classList.add('flex');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        panel.classList.remove('-translate-x-full');
      });
    });
    setTimeout(function () {
      var closeBtn = document.getElementById('drawer-close');
      if (closeBtn) closeBtn.focus();
    }, 60);
    drawerKeyHandler = function (e) {
      if (e.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab') return;
      var items = drawerFocusables();
      if (items.length === 0) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', drawerKeyHandler);
  }

  function closeDrawer() {
    var root = document.getElementById('drawer-root');
    var panel = document.getElementById('drawer-panel');
    if (!root || !panel || root.classList.contains('hidden')) return;
    panel.classList.add('-translate-x-full');
    document.body.style.overflow = '';
    if (drawerKeyHandler) {
      document.removeEventListener('keydown', drawerKeyHandler);
      drawerKeyHandler = null;
    }
    // Match the platform's leave transition before unmounting.
    setTimeout(function () {
      root.classList.add('hidden');
      root.classList.remove('flex');
    }, 200);
    if (drawerLastFocused && document.contains(drawerLastFocused) && drawerLastFocused instanceof HTMLElement) {
      drawerLastFocused.focus();
    }
    drawerLastFocused = null;
  }

  function initDrawer() {
    var openBtn = document.getElementById('drawer-open');
    if (openBtn) openBtn.addEventListener('click', openDrawer);
    var closeBtn = document.getElementById('drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    var overlay = document.getElementById('drawer-overlay');
    if (overlay) overlay.addEventListener('click', closeDrawer);
    // Note: [data-drawer-link] rows are rendered by renderDrawerMore(),
    // which binds their close-on-navigate handler itself.
  }

  /* ---- RGC is a web page, not an installable app: no manifest,
     no beforeinstallprompt handling, no install buttons. ---- */

  /* ---- Logout modal ---- */
  function openLogoutModal() {
    var modal = document.getElementById('logout-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeLogoutModal() {
    var modal = document.getElementById('logout-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  function initLogoutModal() {
    var c1 = document.getElementById('logout-modal-cancel');
    if (c1) c1.addEventListener('click', closeLogoutModal);
    var c2 = document.getElementById('logout-modal-cancel-x');
    if (c2) c2.addEventListener('click', closeLogoutModal);
    var ov = document.getElementById('logout-modal-overlay');
    if (ov) ov.addEventListener('click', closeLogoutModal);
    document.querySelectorAll('[data-logout-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        closeDrawer();
        openLogoutModal();
      });
    });
  }

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
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20';
      case 'B':
        return 'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20';
      case 'C':
        return 'bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20';
      case 'D':
        return 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  }

  // Search UI Mode State: 'all' | 'multi_select' | 'sequence_context'
  let currentViewMode = 'all';
  let lastSearchQuery = '';
  let multiMatchList = [];
  let focusedTargetRoll = null;

  function initStaticEventListeners() {
    // Platform shell boot (RGC is not installable: no PWA init by design).
    initRail();
    initDrawer();
    initLogoutModal();
    var cachedSpec = loadCachedNavSpec();
    if (cachedSpec) currentNavSpec = cachedSpec;
    renderAllNav();
    refreshNavSpec();
    syncHomeLinks();
    const toastPill = document.getElementById('toast-pill');
    if (toastPill) toastPill.addEventListener('click', hideToast);
    var themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      refreshThemeIcon();
      themeToggleBtn.addEventListener('click', cycleTheme);
    }
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
        const logoutModal = document.getElementById('logout-modal');
        if (logoutModal && !logoutModal.classList.contains('hidden')) closeLogoutModal();
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

  function authAvatarHtml(sizeClass, textClass) {
    const name = (currentUser && currentUser.name) || 'User';
    const rawImage = (currentUser && (currentUser.image_url || currentUser.avatar)) || '';
    let imageUrl = '';
    if (rawImage) {
      imageUrl = rawImage.startsWith('http') ? rawImage : `https://hscstack.site${rawImage}`;
    }
    const initial = (name.trim().charAt(0).toUpperCase() || 'U').replace(/"/g, '');
    if (imageUrl) {
      return `<img src="${imageUrl}" alt="${escapeHTML(name)}" class="${sizeClass} rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" />`;
    }
    return `<span class="flex ${sizeClass} items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 ${textClass} font-bold text-white ring-1 ring-indigo-600/20">${initial}</span>`;
  }

  function profileUrl() {
    if (currentUser && currentUser.username) {
      return `https://hscstack.site/u/${encodeURIComponent(currentUser.username)}`;
    }
    return 'https://hscstack.site/profile';
  }

  function notifBellHtml(btnClass) {
    return `<a href="https://hscstack.site/notifications" aria-label="Notifications" title="Notifications" class="${btnClass}"><span class="material-symbols-rounded text-[22px]">notifications</span></a>`;
  }

  // Renders every auth-dependent shell slot (rail / drawer / topbar /
  // bottom bar) — the same surfaces the platform fills from page.props.
  function renderUserProfileWidget() {
    const loggedIn = !!(isLoggedIn && currentUser);
    const name = loggedIn ? currentUser.name || 'User' : '';
    const email = loggedIn ? currentUser.email || '' : '';

    // Mobile topbar right: bell when logged in, indigo Login when logged out.
    const topbar = document.getElementById('topbar-auth');
    if (topbar) {
      topbar.innerHTML = loggedIn
        ? notifBellHtml('flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100')
        : `<a href="https://hscstack.site/login" class="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"><span class="material-symbols-rounded text-[18px]">login</span>Login</a>`;
    }

    // Rail expanded footer auth card.
    const railAuth = document.getElementById('rail-auth-expanded');
    if (railAuth) {
      railAuth.innerHTML = loggedIn
        ? `<div class="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">` +
          `<a href="${profileUrl()}" class="flex min-w-0 items-center gap-2.5">${authAvatarHtml('h-8 w-8', 'text-xs')}` +
          `<div class="min-w-0 text-left"><p class="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">${escapeHTML(name)}</p>` +
          `<p class="truncate text-[11px] text-slate-500 dark:text-slate-400">${escapeHTML(email)}</p></div></a>` +
          `<div class="flex shrink-0 items-center gap-1"><button type="button" data-logout-btn title="Log out" aria-label="Log out" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"><span class="material-symbols-rounded text-[20px]">logout</span></button></div></div>`
        : `<a href="https://hscstack.site/login" aria-label="Login" class="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-transparent bg-indigo-600 px-3 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:border-indigo-700 hover:bg-indigo-700 hover:shadow-md dark:border-transparent dark:bg-indigo-500 dark:hover:border-indigo-400 dark:hover:bg-indigo-400"><span class="material-symbols-rounded text-[20px]">login</span><span>Login</span></a>`;
    }

    // Rail collapsed footer auth.
    const railAuthCol = document.getElementById('rail-auth-collapsed');
    if (railAuthCol) {
      railAuthCol.innerHTML = loggedIn
        ? `<a href="${profileUrl()}" title="Profile" aria-label="Profile" class="flex items-center justify-center">${authAvatarHtml('h-8 w-8', 'text-xs')}</a>`
        : `<a href="https://hscstack.site/login" title="Login" aria-label="Login" class="flex h-10 w-full items-center justify-center rounded-xl border border-transparent bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"><span class="material-symbols-rounded text-[20px]">login</span></a>`;
    }

    // Rail notifications rows (deep-link; the live dropdown needs same-origin auth).
    const railNotif = document.getElementById('rail-notif-expanded');
    if (railNotif) {
      railNotif.innerHTML = loggedIn
        ? `<div class="flex h-11 w-full items-center justify-start gap-2.5 px-3">` +
          notifBellHtml('flex items-center justify-center text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100') +
          `<a href="https://hscstack.site/notifications" class="flex-1 truncate text-left text-[13px] font-semibold text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">Notifications</a></div>`
        : '';
    }
    const railNotifCol = document.getElementById('rail-notif-collapsed');
    if (railNotifCol) {
      railNotifCol.innerHTML = loggedIn
        ? notifBellHtml('flex h-10 w-full items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100')
        : '';
    }

    // Drawer pinned footer auth (avatar h-9 + "Sign in", like the platform).
    const drawerAuth = document.getElementById('drawer-auth');
    if (drawerAuth) {
      drawerAuth.innerHTML = loggedIn
        ? `<div class="flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">` +
          `<a href="${profileUrl()}" class="flex min-w-0 flex-1 items-center gap-2.5" title="Profile" aria-label="Profile">${authAvatarHtml('h-9 w-9', 'text-xs')}` +
          `<span class="min-w-0 text-left"><span class="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHTML(name)}</span>` +
          `<span class="block truncate text-xs text-slate-500 dark:text-slate-400">${escapeHTML(email)}</span></span></a>` +
          `<button type="button" data-logout-btn title="Log out" aria-label="Log out" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"><span class="material-symbols-rounded text-[20px]">logout</span></button></div>`
        : `<a href="https://hscstack.site/login" class="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-transparent bg-indigo-600 px-3 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-indigo-700 hover:shadow-md dark:bg-indigo-500 dark:hover:bg-indigo-400"><span class="material-symbols-rounded text-[20px]">login</span>Sign in</a>`;
    }

    // Re-bind freshly rendered logout buttons, then refresh dependent nav.
    initLogoutModal();
    renderBottomNav();
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
      searchContextBanner.className = 'flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs mb-2 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300';
      
      const backBtnText = hasParentMultiList ? '← Matches' : `Show All (${rawData.length})`;

      searchContextBanner.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0 dark:text-indigo-300 dark:bg-indigo-500/10 dark:border-indigo-500/20">${escapeHTML(targetStudent.Roll)}</span>
          <span class="text-slate-600 truncate text-[11px] sm:text-xs dark:text-slate-400">Classmates sequence</span>
        </div>
        <button id="btn-banner-action" class="text-[11px] sm:text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer touch-manipulation dark:text-slate-200 dark:hover:text-white dark:bg-slate-800 dark:hover:bg-slate-700">
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
      searchContextBanner.className = 'flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs mb-2 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300';
      searchContextBanner.innerHTML = `
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-bold text-slate-900 shrink-0 dark:text-gray-100">${matches.length} matches</span>
          <span class="text-slate-500 truncate text-[11px] sm:text-xs dark:text-slate-400">Select to view roll sequence</span>
        </div>
        <button id="btn-reset-multi-banner" class="text-[11px] sm:text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer touch-manipulation dark:text-slate-200 dark:hover:text-white dark:bg-slate-800 dark:hover:bg-slate-700">
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
      let cardStyle = 'group flex flex-col sm:flex-row sm:items-center bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 cursor-pointer hover:border-slate-300 hover:bg-slate-50/70 transition-all shadow-2xs touch-manipulation active:scale-[0.99] dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60';
      let badgeHtml = '';

      if (isSequenceMode) {
        if (isDirectMatch) {
          cardStyle = 'group flex flex-col sm:flex-row sm:items-center bg-indigo-50/40 border border-indigo-200 ring-1 ring-indigo-500/20 rounded-xl p-3 sm:p-3.5 cursor-pointer hover:bg-indigo-50/60 transition-all shadow-xs touch-manipulation active:scale-[0.99] dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:hover:bg-indigo-500/15';
          badgeHtml = `
            <span class="inline-flex items-center gap-1 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 border border-indigo-200/60 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-500/30">
              Searched
            </span>
          `;
        } else if (matchContext === 'before') {
          badgeHtml = `
            <span class="inline-flex items-center rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
              Before
            </span>
          `;
        } else if (matchContext === 'after') {
          badgeHtml = `
            <span class="inline-flex items-center rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
              After
            </span>
          `;
        }
      }

      const rollBadgeClass = isSequenceMode && isDirectMatch
        ? 'font-mono text-xs sm:text-sm font-bold text-indigo-800 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-2xs dark:text-indigo-200 dark:bg-slate-900 dark:border-indigo-500/30'
        : 'font-mono text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700';

      const rollBadgeMobileClass = isSequenceMode && isDirectMatch
        ? 'font-mono text-xs font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 dark:text-indigo-200 dark:bg-indigo-500/20 dark:border-indigo-500/30'
        : 'font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700';

      const nameClass = 'font-bold text-slate-900 text-sm sm:text-base leading-snug truncate group-hover:text-indigo-600 transition-colors dark:text-gray-100 dark:group-hover:text-indigo-300';

      const actionButtonHtml = isPickerMode
        ? `<div class="w-20 hidden sm:flex items-center justify-end shrink-0 pr-2"><div class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold group-hover:bg-slate-800 transition-colors shrink-0 dark:bg-gray-100 dark:text-slate-900">
             <span>Select</span>
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
           </div></div>`
        : `<div class="w-20 flex justify-end shrink-0 pr-2">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5 text-slate-300 group-hover:text-slate-600 transition-colors dark:text-slate-600 dark:group-hover:text-slate-300" viewBox="0 0 20 20" fill="currentColor">
               <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
             </svg>
           </div>`;

      row.className = cardStyle;

      row.innerHTML = `
        <!-- Mobile View (visible block sm:hidden) -->
          <div class="flex sm:hidden items-center justify-between gap-2.5 w-full">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <span class="font-mono text-xs font-bold text-slate-400 dark:text-slate-500 w-7 text-center shrink-0">
              #${student.indexNumber}
            </span>
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
          <div class="shrink-0 text-slate-300 group-hover:text-slate-600 dark:text-slate-600 dark:group-hover:text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
        </div>

        <!-- Desktop View (visible sm:flex hidden) -->
        <div class="hidden sm:flex w-full items-center">
          <div class="w-12 text-center shrink-0 font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
            ${student.indexNumber}
          </div>
          <div class="w-32 flex justify-center shrink-0">
            <div class="${rollBadgeClass}">
              ${highlightedRoll}
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
          ? 'bg-slate-900 text-white shadow-xs dark:bg-gray-100 dark:text-slate-900'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
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

    // Populate Previous School
    if (modalSchool) {
      const school = (student.Previous_School || '').trim();
      if (school) {
        modalSchool.textContent = school;
        modalSchool.className = 'font-bold text-slate-800 text-right leading-snug text-xs sm:text-sm dark:text-slate-100';
      } else {
        modalSchool.textContent = 'Not Found';
        modalSchool.className = 'font-semibold text-slate-400 text-right leading-snug text-xs sm:text-sm dark:text-slate-500';
      }
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

  let toastTimer = null;

  function hideToast() {
    const toast = document.getElementById('toast');
    const pill = document.getElementById('toast-pill');
    if (toast) {
      toast.classList.add('opacity-0');
      setTimeout(() => {
        if (toast.classList.contains('opacity-0')) toast.classList.add('invisible');
      }, 300);
    }
    if (pill) pill.classList.add('-translate-y-4');
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    const pill = document.getElementById('toast-pill');
    if (!toast || !pill) return;
    toastText.textContent = msg;
    toast.classList.remove('invisible', 'opacity-0');
    pill.classList.remove('-translate-y-4');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 2200);
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
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-300/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
        cardBg: 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/30 border-amber-200/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 dark:border-slate-800',
        countBg: 'bg-amber-600 text-white'
      },
      {
        rank: 2,
        medal: '🥈',
        badgeBg: 'bg-slate-100 text-slate-800 border-slate-300/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
        cardBg: 'bg-gradient-to-br from-slate-50/90 via-white to-slate-50/40 border-slate-200 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 dark:border-slate-800',
        countBg: 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
      },
      {
        rank: 3,
        medal: '🥉',
        badgeBg: 'bg-orange-100 text-orange-900 border-orange-300/80 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20',
        cardBg: 'bg-gradient-to-br from-orange-50/80 via-white to-orange-50/20 border-orange-200/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 dark:border-slate-800',
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
            <h4 class="text-xs sm:text-sm font-black text-slate-900 dark:text-gray-100 line-clamp-2 leading-snug">
              ${escapeHTML(mainName)}
            </h4>
            ${location ? `<p class="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">${escapeHTML(location)}</p>` : ''}
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
