export default {
  async fetch(request, env) {

    const origin = request.headers.get('Origin') || '';
    const allowed = [
      'https://rasaif.com',
      'https://www.rasaif.com',
      'https://ahmedhsalghamdi.github.io'
    ];

    if (request.method === 'OPTIONS') {
      return corsResponse('', 204, origin, allowed);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Lataif endpoints ──
    if (path === '/lataif' || path.startsWith('/lataif/')) {
      return handleLataif(request, env, url, path, origin, allowed);
    }

    // ── Rate limiting for search ──
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ratKey = `rate:${ip}`;
    let current = 0;
    try {
      const val = await env.RATE_LIMIT.get(ratKey);
      current = parseInt(val || '0');
    } catch(e) { current = 0; }

    if (current >= 30) {
      return corsResponse(
        JSON.stringify({ error: 'Too many searches. Please wait a moment.' }),
        429, origin, allowed
      );
    }
    await env.RATE_LIMIT.put(ratKey, String(current + 1), { expirationTtl: 60 });

    const fetchId  = url.searchParams.get('fetch_id') || '';
    const query    = url.searchParams.get('q')         || '*';
    const filterBy = url.searchParams.get('filter_by') || '';
    const page     = url.searchParams.get('page')      || '1';
    const language = url.searchParams.get('lang')      || 'both';
    const facetBy  = url.searchParams.get('facet_by')  || '';

    const base = `https://${env.TYPESENSE_HOST}`;
    const key  = env.TYPESENSE_API_KEY;

    // ── Fetch single document by ID ──
    if (fetchId) {
      try {
        const r = await fetch(
          `${base}/collections/rasaif/documents/${encodeURIComponent(fetchId)}`,
          { headers: { 'X-TYPESENSE-API-KEY': key } }
        );
        const data = await r.text();
        return corsResponse(data, r.status, origin, allowed);
      } catch(e) {
        return corsResponse(JSON.stringify({ error: 'Not found' }), 404, origin, allowed);
      }
    }

    // ── Search ──
    let queryBy = 'en,ar';
    if (language === 'en') queryBy = 'en';
    if (language === 'ar') queryBy = 'ar';

    const tsUrl = new URL(`${base}/collections/rasaif/documents/search`);
    tsUrl.searchParams.set('q',                     query);
    tsUrl.searchParams.set('query_by',              queryBy);
    tsUrl.searchParams.set('per_page',              '50');
    tsUrl.searchParams.set('page',                  page);
    tsUrl.searchParams.set('highlight_full_fields', 'en,ar');
    tsUrl.searchParams.set('snippet_threshold',     '0');
    if (filterBy) tsUrl.searchParams.set('filter_by', filterBy);
    if (facetBy)  tsUrl.searchParams.set('facet_by',  facetBy);

    let tsResponse;
    try {
      tsResponse = await fetch(tsUrl.toString(), {
        headers: { 'X-TYPESENSE-API-KEY': key }
      });
    } catch(e) {
      return corsResponse(
        JSON.stringify({ error: 'Search service unavailable.' }),
        503, origin, allowed
      );
    }

    const data = await tsResponse.text();
    return corsResponse(data, tsResponse.status, origin, allowed);
  }
};

/* ════════════════════════════════
   LATAIF HANDLER
   GET  /lataif          → list all posts
   POST /lataif          → create/update post (requires secret)
   DELETE /lataif/:id    → delete post (requires secret)
   ════════════════════════════════ */
async function handleLataif(request, env, url, path, origin, allowed) {
  const SECRET = 'secretgateofwriting';

  // GET — public, return all posts
  if (request.method === 'GET') {
    try {
      const raw = await env.RATE_LIMIT.get('lataif_posts');
      const posts = raw ? JSON.parse(raw) : [];
      // Filter out drafts for public
      const pub = posts.filter(p => !p.draft);
      return corsResponse(JSON.stringify({ posts: pub }), 200, origin, allowed);
    } catch(e) {
      return corsResponse(JSON.stringify({ posts: [] }), 200, origin, allowed);
    }
  }

  // Check secret for write operations
  const secret = request.headers.get('X-Lataif-Secret');
  if (secret !== SECRET) {
    return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401, origin, allowed);
  }

  // POST — create or update
  if (request.method === 'POST') {
    try {
      const post = await request.json();
      const raw  = await env.RATE_LIMIT.get('lataif_posts');
      const posts = raw ? JSON.parse(raw) : [];
      const idx = posts.findIndex(p => p.id === post.id);
      if (idx >= 0) posts[idx] = post;
      else posts.unshift(post);
      await env.RATE_LIMIT.put('lataif_posts', JSON.stringify(posts));
      return corsResponse(JSON.stringify({ ok: true }), 200, origin, allowed);
    } catch(e) {
      return corsResponse(JSON.stringify({ error: e.message }), 500, origin, allowed);
    }
  }

  // DELETE — remove a post
  if (request.method === 'DELETE') {
    try {
      const id  = path.replace('/lataif/', '');
      const raw = await env.RATE_LIMIT.get('lataif_posts');
      const posts = raw ? JSON.parse(raw) : [];
      const filtered = posts.filter(p => p.id !== id);
      await env.RATE_LIMIT.put('lataif_posts', JSON.stringify(filtered));
      return corsResponse(JSON.stringify({ ok: true }), 200, origin, allowed);
    } catch(e) {
      return corsResponse(JSON.stringify({ error: e.message }), 500, origin, allowed);
    }
  }

  return corsResponse('Method not allowed', 405, origin, allowed);
}

function corsResponse(body, status, origin, allowed) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Lataif-Secret',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Origin': '*'
  };
  return new Response(body, { status, headers });
}
