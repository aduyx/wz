export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    // CORS
    const allowOrigin = (env.ALLOW_ORIGIN && typeof env.ALLOW_ORIGIN === 'string') ? env.ALLOW_ORIGIN : '*';
    function json(body, status=200){ return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowOrigin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS' } }); }
    if (request.method === 'OPTIONS') return json({ ok: true });

    // Auth helpers
    function bearer(){ const a = request.headers.get('Authorization')||''; const m = a.match(/^Bearer\s+(.+)$/i); return m?m[1]:''; }
    async function verify(token){
      try {
        const parts = token.split('.');
        if (parts.length!==3) return null;
        const [h, pl, sig] = parts;
        const secret = String(env.JWT_SECRET||'');
        if (!secret) return null;
        const data = h + '.' + pl;
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const expectedBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
        const expected = new Uint8Array(expectedBuf);
        function b64urlDecode(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); const pad = s.length % 4; if (pad) s += '='.repeat(4-pad); const bin = atob(s); const arr = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++){ arr[i] = bin.charCodeAt(i); } return arr; }
        const given = b64urlDecode(sig);
        if (expected.length !== given.length) return null;
        for (let i=0;i<expected.length;i++){ if (expected[i] !== given[i]) return null; }
        function b64urlJsonDecode(s){ const bytes = b64urlDecode(s); return JSON.parse(new TextDecoder().decode(bytes)); }
        const payload = b64urlJsonDecode(pl);
        const exp = payload.exp||0;
        if (Date.now()/1000 > exp) return null;
        return payload;
      } catch(e){ return null; }
    }
    async function sign(payload){
      const exp = Math.floor(Date.now()/1000) + parseInt(env.JWT_EXPIRES||'86400');
      const p = { ...payload, exp };
      const header = { alg: 'HS256', typ: 'JWT' };
      function b64urlEncode(bytes){ let str = btoa(String.fromCharCode(...new Uint8Array(bytes))); return str.replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
      const h = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
      const pl = b64urlEncode(new TextEncoder().encode(JSON.stringify(p)));
      const data = h + '.' + pl;
      const secret = String(env.JWT_SECRET||'');
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
      const sig = b64urlEncode(new Uint8Array(sigBuf));
      return data + '.' + sig;
    }

    // KV helpers
    async function kvGet(key){ const v = await env.DATA_KV.get(key); return v ? JSON.parse(v) : null; }
    async function kvPut(key, val){ await env.DATA_KV.put(key, JSON.stringify(val)); return true; }
    async function sha256Hex(s){ const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); const b = new Uint8Array(d); return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join(''); }
    function randomString(n){ let r = ''; const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; for (let i=0;i<n;i++){ r += chars[Math.floor(Math.random()*chars.length)]; } return r; }

    // Auth routes
    if (pathname === '/api/auth/login' && request.method === 'POST'){
      const body = await request.json().catch(()=>({}));
      const id = String(body.identifier||'').trim();
      const pw = String(body.password||'');
      const users = (await kvGet('users')) || {};
      const u = users[id];
      if (!u) return json({ error: 'invalid credentials' }, 401);
      let ok = false;
      if (u && typeof u.password === 'string'){ ok = (u.password === pw); }
      if (!ok && u && typeof u.password_hash === 'string'){ const salt = String(u.salt||''); const hash = await sha256Hex(salt + '|' + pw); ok = (hash === u.password_hash); }
      if (!ok) return json({ error: 'invalid credentials' }, 401);
      const token = await sign({ username: id, role: u.role });
      return json({ token, username: id, role: u.role });
    }

    // Authorization: PUT requires super_admin
    async function requireSuperAdmin(){ const tok = bearer(); const p = await verify(tok); if (!p || p.role!=='super_admin') return json({ error: 'forbidden' }, 403); return p; }

    const keys = {
      '/api/config/home-hero': 'home_hero_config',
      '/api/config/home-modules': 'site_home_config',
      '/api/config/tracking-settings': 'trackingSettings',
      '/api/config/freight-marquee': 'freight_marquee',
      '/api/content/home-news': 'home_news',
      '/api/content/home-shipowners': 'home_shipowners_cards',
      '/api/shipowners/schedule-links': 'shipowner_schedule_links',
      '/api/data/ports': 'ports_db',
      '/api/data/origin-ports': 'origin_ports_db',
      '/api/data/destination-ports': 'destination_ports_db',
    };

    // GET/PUT for mapped keys
    for (const route in keys){
      if (pathname === route){
        const k = keys[route];
        if (request.method === 'GET'){
          const v = await kvGet(k);
          return json(v ?? null);
        }
        if (request.method === 'PUT'){
          const auth = await requireSuperAdmin(); if (auth && auth.error) return auth;
          const body = await request.json().catch(()=>null);
          await kvPut(k, body);
          return json({ ok: true });
        }
      }
    }

    if (pathname === '/api/admin/users'){
      const usersExisting = await kvGet('users');
      let allowBootstrap = false;
      if (!usersExisting || Object.keys(usersExisting).length === 0){ allowBootstrap = (String(env.ALLOW_BOOTSTRAP||'0') === '1'); }
      const tok = bearer();
      const p = await verify(tok);
      if (!allowBootstrap && (!p || p.role!=='super_admin')) return json({ error: 'forbidden' }, 403);
      if (request.method === 'GET'){
        const users = (await kvGet('users')) || {};
        return json(users);
      }
      if (request.method === 'PUT'){
        const body = await request.json().catch(()=>({}));
        const username = String(body.username||'').trim();
        const password = String(body.password||'');
        const role = String(body.role||'user');
        if (!username || !password) return json({ error: 'invalid' }, 400);
        if (allowBootstrap && role !== 'super_admin') return json({ error: 'bootstrap requires super_admin' }, 400);
        const users = (await kvGet('users')) || {};
        const salt = randomString(16);
        const password_hash = await sha256Hex(salt + '|' + password);
        users[username] = { password_hash, salt, role };
        await kvPut('users', users);
        return json({ ok: true });
      }
    }

    return json({ error: 'not found' }, 404);
  }
}