console.log('Global JavaScript file loaded');
try { if (typeof window.__ASSET_VERSION__ !== 'string') { window.__ASSET_VERSION__ = '20251127'; } } catch(e) {}
// 站点前缀（用于子路径部署）：可通过 window.SITE_PREFIX 或 localStorage('site_prefix') 设置，如 '/wangzhan'
(function(){
  try {
    var p1 = typeof window.SITE_PREFIX === 'string' ? window.SITE_PREFIX : '';
    var p2 = '';
    try { p2 = localStorage.getItem('site_prefix') || ''; } catch(e){}
    window.__SITE_PREFIX__ = p1 || p2 || '';
  } catch(e){ window.__SITE_PREFIX__ = ''; }
})();
function resolveRootUrl(u){
  try {
    var pref = window.__SITE_PREFIX__ || '';
    if (!pref) return u;
    if (typeof u !== 'string') return u;
    if (u.startsWith('/')) return (pref + u).replace(/\/+/, '/');
    return u;
  } catch(e){ return u; }
}
window.YX_PREVIEW = (function(){
  try {
    var u = new URL(window.location.href);
    var qp = u.searchParams;
    var p = window.location.protocol;
    var host = window.location.hostname || '';
    var ls = '';
    try { ls = localStorage.getItem('yx_preview') || ''; } catch(e){}
    return (qp.get('preview') === '1') || (ls === '1') || (p === 'file:') || (host === 'localhost' || host === '127.0.0.1');
  } catch (e) { return false; }
})();

// 组件加载函数
async function loadComponent(containerId, componentPath) {
  try {
    const path = resolveRootUrl(componentPath);
    const ver = (typeof window.__ASSET_VERSION__ === 'string' && window.__ASSET_VERSION__) ? window.__ASSET_VERSION__ : '';
    const url = ver ? (path + (path.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(ver)) : path;
    const response = await fetch(url);
    const html = await response.text();
    document.getElementById(containerId).innerHTML = html;
    if (typeof window.initHeaderControls === 'function') {
      window.initHeaderControls();
    }
    if (typeof window.initUserSidebarHighlight === 'function') {
      window.initUserSidebarHighlight();
    }
    if (containerId === 'header-container' && typeof window.initHeaderFunctions === 'function') {
      if (!window.__header_init_done__) {
        window.initHeaderFunctions();
        window.__header_init_done__ = true;
        setTimeout(() => { try { window.initHeaderFunctions(); } catch (e) {} }, 200);
      }
    }
    if (containerId === 'footer-container') {
      if (typeof window.initFooterFunctions === 'function') {
        window.initFooterFunctions();
      }
      if (typeof window.initGlobalFooter === 'function') {
        window.initGlobalFooter();
      }
    }
  } catch (error) {
    console.error('组件加载失败:', error);
  }
}

// 语言与页眉交互初始化
window.initHeaderControls = function () {
  try {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get('lang') || 'zh';
    document.documentElement.lang = currentLang;

    const flagImgEl = document.getElementById('lang-flag-img');
    const toggleBtn = document.getElementById('lang-toggle');
    if (flagImgEl) {
      // 中文页面显示英国国旗（en.png），英文页面显示中国国旗（cn.png）
      flagImgEl.src = resolveRootUrl(currentLang === 'zh' ? '/assets/images/en.png' : '/assets/images/cn.png');
      flagImgEl.alt = currentLang === 'zh' ? 'English' : '中文';
    }
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const nextLang = (document.documentElement.lang || 'zh') === 'zh' ? 'en' : 'zh';
        const newParams = new URLSearchParams(window.location.search);
        newParams.set('lang', nextLang);
        const newUrl = window.location.pathname + '?' + newParams.toString() + window.location.hash;
        window.location.assign(newUrl);
      };
    }

    // 设置导航高亮
    const path = window.location.pathname || '/';
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      const prefix = link.getAttribute('data-prefix');
      const href = link.getAttribute('href');
      let match = false;
      if (prefix) {
        match = path.startsWith(prefix);
      } else if (href) {
        try {
          const navPath = new URL(href, window.location.origin).pathname;
          match = path === navPath;
        } catch (e) {}
      }
      if (match) {
        link.classList.add('text-white', 'font-semibold', 'border-b', 'border-yellow-500');
      } else {
        link.classList.remove('text-white', 'font-semibold', 'border-b', 'border-yellow-500');
      }
    });
  } catch (e) {
    console.warn('初始化页眉交互失败:', e);
  }
};

// 运行时修复：统一将旧资源路径 '/imp/' 替换为 '/assets/images/'，并应用站点前缀
(function(){
  try {
    function fixAttr(el, attr){
      try {
        var v = el.getAttribute(attr);
        if (!v) return;
        var nv = v;
        if (nv.indexOf('/imp/') >= 0 || nv.indexOf('imp/') >= 0) {
          nv = nv.replace(/(^|\s|"|\')\.{0,2}\/?imp\//g, function(m){ return m.replace(/imp\//, 'assets/images/'); });
          nv = nv.replace('/imp/', '/assets/images/');
        }
        nv = resolveRootUrl(nv);
        if (nv !== v) el.setAttribute(attr, nv);
      } catch(e){}
    }
    function runFix(){
      var all = document.querySelectorAll('img[src], link[href], script[src], a[href]');
      all.forEach(function(el){ fixAttr(el, 'src'); fixAttr(el, 'href'); });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runFix);
    } else { runFix(); }
  } catch(e){}
})();

// 页眉功能初始化（认证与下拉菜单）
window.initHeaderFunctions = function () {
  try {
    const authArea = document.getElementById('auth-area');
    if (authArea) {
      const raw = localStorage.getItem('yx_user');
      if (!raw) {
        authArea.innerHTML = '<a href="/pages/user/login.html" class="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 transition flex items-center space-x-1"><i class="fas fa-user"></i><span>注册/登录</span></a>';
      } else {
        let u;
        try { u = JSON.parse(raw); } catch (e) { u = {}; }
        const uname = u && (u.username || u.name) ? String(u.username || u.name) : '';
        function roleName(r){ if (r==='super_admin') return '超级管理员'; if (r==='admin') return '管理员'; return '普通会员'; }
        function getPoints(){ try { return JSON.parse(localStorage.getItem('yx_points')||'{}'); } catch(e){ return {}; } }
        function getRegistry(){ try { return JSON.parse(localStorage.getItem('yx_users')||'{}'); } catch(e){ return {}; } }
        function setRegistry(obj){ try { localStorage.setItem('yx_users', JSON.stringify(obj)); } catch(e){} }
        function generateInviteCodeUnique(reg){ function gen(){ return 'YX' + Math.random().toString(36).slice(2,10).toUpperCase(); } var code = gen(); var exists = Object.keys(reg).some(function(k){ var v = reg[k]; return v && v.my_invite === code; }); while (exists){ code = gen(); exists = Object.keys(reg).some(function(k){ var v = reg[k]; return v && v.my_invite === code; }); } return code; }
        const pts = getPoints(); const p = typeof pts[uname]==='number' ? pts[uname] : 0;
        const hrefUserCenter = resolveRootUrl('/pages/user/index.html');
        const hrefAdminIndex = resolveRootUrl('/pages/admin/index.html');
        const hrefMuseum = resolveRootUrl('/pages/jika-museum/index.html');
        const hrefPointsMall = resolveRootUrl('/pages/points-mall/index.html');
        const hrefUpgrade = resolveRootUrl('/pages/user/upgrade.html');
        const panelHtml = (
          '<div class="relative" id="user-menu">'
          + '<button id="user-menu-btn" class="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 transition flex items-center space-x-1" type="button">'
          + '<i class="fas fa-user"></i><span id="user-menu-name">' + uname + '</span><i class="fas fa-chevron-down text-xs"></i>'
          + '</button>'
          + '<div id="user-menu-panel" class="absolute right-0 mt-2 w-64 bg-white text-gray-700 rounded-lg shadow-xl border border-yellow-500 divide-y divide-gray-100 hidden">'
          + '<div class="px-4 py-2 text-sm bg-gray-50">用户名：<span id="menu-username">' + uname + '</span></div>'
          + '<div class="px-4 py-2 text-sm bg-gray-50">等级：<span id="menu-role">' + roleName(u.role) + '</span></div>'
          + '<div class="px-4 py-2 text-sm bg-gray-50">积分：<span id="menu-points">' + String(p) + '</span></div>'
          + '<a href="' + hrefUserCenter + '" class="block w-full text-left px-4 py-2 text-sm font-semibold hover:bg-gray-100">我的中心</a>'
          + (u && u.role === 'super_admin' ? '<a href="' + hrefAdminIndex + '" class="block w-full text-left px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50"><i class="fas fa-cog mr-2"></i>进入后台</a>' : '')
          + '<a href="' + hrefMuseum + '" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">我的博物馆</a>'
          + '<a href="' + hrefPointsMall + '" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">积分兑换</a>'
          + '<a href="' + hrefUpgrade + '" class="inline-flex items-center w-full text-left px-4 py-2 text-sm font-semibold text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"><i class="fas fa-crown mr-2"></i>升级 Pro</a>'
          + '<button id="menu-invite" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100" type="button">生成邀请链接</button>'
          + '<button id="menu-logout" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100" type="button">退出</button>'
          + '</div>'
          + '</div>'
        );
        authArea.innerHTML = panelHtml;
        const btn = document.getElementById('user-menu-btn');
        const panel = document.getElementById('user-menu-panel');
        if (btn && panel) {
          btn.addEventListener('click', function(){ panel.classList.toggle('hidden'); });
          document.addEventListener('click', function(e){ if (!panel.classList.contains('hidden')){ const m = document.getElementById('user-menu'); if (m && !m.contains(e.target)) panel.classList.add('hidden'); } });
        }
        const inviteBtn = document.getElementById('menu-invite');
        if (inviteBtn) {
          inviteBtn.addEventListener('click', function(){
            const reg = getRegistry(); const info = reg[uname] || {};
            let code = info.my_invite;
            if (!code) { code = generateInviteCodeUnique(reg); info.my_invite = code; reg[uname] = info; setRegistry(reg); }
            const link = (location.origin || '') + resolveRootUrl('/pages/user/login.html') + '?invite=' + encodeURIComponent(code);
            try { navigator.clipboard && navigator.clipboard.writeText(link).then(function(){ alert('邀请链接已生成并复制：' + link); }).catch(function(){ alert('邀请链接：' + link); }); } catch (e) { alert('邀请链接：' + link); }
          });
        }
        const logoutBtn = document.getElementById('menu-logout');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function(){ try { localStorage.removeItem('yx_user'); } catch(e){} window.location.reload(); });
        }
      }
    }
    const servicesBtn = document.querySelector('nav .group > button');
    const servicesPanel = document.getElementById('services-dropdown');
    const servicesGroup = servicesBtn ? servicesBtn.parentElement : null;
    if (servicesBtn && servicesPanel && servicesGroup) {
      let sdHideTimer = null;
      function showServices(){ if (sdHideTimer) { clearTimeout(sdHideTimer); sdHideTimer = null; } servicesPanel.classList.remove('hidden'); }
      function hideServicesDelayed(){ sdHideTimer = setTimeout(() => { servicesPanel.classList.add('hidden'); }, 180); }
      servicesBtn.addEventListener('mouseenter', showServices);
      servicesPanel.addEventListener('mouseenter', showServices);
      servicesGroup.addEventListener('mouseleave', hideServicesDelayed);
      servicesBtn.addEventListener('click', function(){ showServices(); });
      document.addEventListener('click', function(e){ if (!servicesGroup.contains(e.target)) servicesPanel.classList.add('hidden'); });
    }
  } catch (e) {
    console.warn('初始化页眉功能失败:', e);
  }
};

// 连续重试以确保登录态替换生效
try {
  (function(){
    let tries = 0; const max = 12; const iv = setInterval(function(){
      try {
        const raw = localStorage.getItem('yx_user');
        const authArea = document.getElementById('auth-area');
        if (!authArea) { clearInterval(iv); return; }
        const hasMenu = !!authArea.querySelector('#user-menu');
        if (raw && !hasMenu) { window.initHeaderFunctions(); }
        tries++; if (tries >= max) clearInterval(iv);
      } catch { tries++; if (tries >= max) clearInterval(iv); }
    }, 200);
  })();
} catch {}

window.updateUserStatus = function(){
  try { window.initHeaderFunctions(); } catch (e) {}
};

try {
  (function(){
    const p = window.location.pathname || '/';
    var preview = !!window.YX_PREVIEW;
    const adminOnly = p.indexOf('/pages/admin/') === 0;
    if (adminOnly && !preview) {
      const raw = localStorage.getItem('yx_user');
      if (!raw) {
        alert('请先注册/登录');
        window.location.href = '/pages/user/login.html';
      } else {
        try { const u = JSON.parse(raw); if (!u || u.role !== 'super_admin') { alert('该页面仅限超级管理员访问'); window.location.href = '/pages/user/login.html'; } } catch(_) { window.location.href = '/pages/user/login.html'; }
      }
    }
  })();
} catch (e) {}

try {
  window.addEventListener('storage', function(e){ if (e.key === 'yx_user') { try { window.initHeaderFunctions(); } catch (err) {} } });
} catch (e) {}

// 用户中心侧栏高亮初始化
window.initUserSidebarHighlight = function () {
  try {
    const path = window.location.pathname || '/';
    const sidebar = document.getElementById('user-sidebar');
    if (!sidebar) return;
    const links = sidebar.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      try {
        const navPath = new URL(href, window.location.origin).pathname;
        const match = path === navPath;
        if (match) {
          link.classList.add('bg-gray-200', 'text-gray-900', 'font-semibold');
        } else {
          link.classList.remove('bg-gray-200', 'text-gray-900', 'font-semibold');
        }
      } catch (e) {}
    });
  } catch (e) {
    console.warn('初始化用户侧栏高亮失败:', e);
  }
};
window.initGlobalFooter = function(){
  try {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem('home_news')||'[]'); } catch(e){}
    for (var i=0; i<4; i++){
      var a = document.getElementById('footer-news-'+i);
      var item = arr[i];
      if (a && item && item.title){
        var t = item.title || '';
        var s = t;
        try { var idx = t.indexOf('：'); if (idx < 0) idx = t.indexOf(':'); if (idx >= 0) s = t.slice(idx+1).trim(); } catch(e){}
        a.textContent = s || t;
        if (item.href) a.href = item.href;
      }
    }
  } catch (e) {}
};
try {
  (function(){
    var base = '';
    try { base = (typeof window.SERVER_API_BASE==='string' && window.SERVER_API_BASE) ? window.SERVER_API_BASE : (localStorage.getItem('server_api_base')||''); } catch(e){}
    var map = {
      home_hero_config: '/api/config/home-hero',
      site_home_config: '/api/config/home-modules',
      trackingSettings: '/api/config/tracking-settings',
      shipowner_schedule_links: '/api/shipowners/schedule-links',
      home_news: '/api/content/home-news',
      home_shipowners_cards: '/api/content/home-shipowners',
      ports_db: '/api/data/ports',
      origin_ports_db: '/api/data/origin-ports',
      destination_ports_db: '/api/data/destination-ports',
      freight_marquee: '/api/config/freight-marquee'
    };
    function apiGet(k){
      if (!base) { try { var raw = localStorage.getItem(k)||''; return Promise.resolve(raw?JSON.parse(raw):null); } catch(e){ return Promise.resolve(null); } }
      var url = base + (map[k]||'');
      return fetch(url, { cache: 'no-store' }).then(function(r){ if(!r.ok) throw new Error(''); return r.json(); }).catch(function(){ try { var raw = localStorage.getItem(k)||''; return raw?JSON.parse(raw):null; } catch(e){ return null; } });
    }
    function apiSet(k, v){
      if (!base) { try { localStorage.setItem(k, JSON.stringify(v)); return Promise.resolve(true); } catch(e){ return Promise.resolve(false); } }
      var url = base + (map[k]||'');
      var token = '';
      try { token = localStorage.getItem('auth_token') || localStorage.getItem('yx_auth_token') || ''; } catch(e){}
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      return fetch(url, { method: 'PUT', headers: headers, body: JSON.stringify(v) }).then(function(r){ return r.ok; }).catch(function(){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } });
    }
    window.APP_AUTH = {
      login: function(identifier, password){
        if (!base) return Promise.reject(new Error('No SERVER_API_BASE'));
        var url = base + '/api/auth/login';
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: identifier, password: password }) })
          .then(function(r){ if(!r.ok) throw new Error(''); return r.json(); })
          .then(function(res){ try { localStorage.setItem('auth_token', res.token||''); localStorage.setItem('yx_user', JSON.stringify({ username: res.username, role: res.role, login_at: Date.now() })); } catch(e){} return res; });
      }
    };
    window.APP_API = { get: apiGet, set: apiSet, base: base };
  })();
} catch(e){}
