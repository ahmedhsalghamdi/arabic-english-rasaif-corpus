/* =========================================================
   Raṣāʾif Engine v3 — Typesense backend
   ========================================================= */

const RasaifEngine = (() => {

  const WORKER_URL = 'https://rasaif-search.ahmed-hs-alghamdi.workers.dev';

  let books = [];

  /* ── Arabic normalisation ── */
  function arClean(s) {
    return s
      .replace(/[\u064B-\u065F\u0670\u0640\u0671]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ت')
      .replace(/ى/g, 'ي');
  }

  /* ── English lemmatiser ── */
  const EN_IRREG = {
    ran:'run',runs:'run',running:'run',went:'go',goes:'go',going:'go',gone:'go',
    was:'be',were:'be',is:'be',are:'be',been:'be',being:'be',
    had:'have',has:'have',having:'have',did:'do',does:'do',doing:'do',done:'do',
    said:'say',says:'say',shown:'show',shows:'show',showed:'show',
    made:'make',came:'come',took:'take',taken:'take',knew:'know',known:'know',
    thought:'think',brought:'bring',found:'find',told:'tell',
    men:'man',women:'woman',children:'child',wrote:'write',written:'write',
    spoke:'speak',spoken:'speak',felt:'feel',kept:'keep',saw:'see',seen:'see',
    gave:'give',given:'give',got:'get'
  };

  function enLemma(w) {
    w = w.toLowerCase().replace(/[.,;:!?"'()\-–—]/g, '');
    if (EN_IRREG[w]) return EN_IRREG[w];
    if (w.endsWith('ies') && w.length > 4) return w.slice(0,-3)+'y';
    if (w.endsWith('ied') && w.length > 4) return w.slice(0,-3)+'y';
    if (w.endsWith('ing') && w.length > 5) {
      const s = w.slice(0,-3);
      return (s.length > 3 && s[s.length-1]===s[s.length-2]) ? s.slice(0,-1) : s;
    }
    if (w.endsWith('ed') && w.length > 4) {
      const s = w.slice(0,-2);
      return (s.length > 3 && s[s.length-1]===s[s.length-2]) ? s.slice(0,-1) : s;
    }
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0,-1);
    return w;
  }

  function enTok(t) { return (t.toLowerCase().match(/[a-zA-Z']+/g)||[]).filter(w=>w.length>1); }
  function arTok(t) { return (arClean(t).match(/[\u0600-\u06FF]+/g)||[]).filter(w=>w.length>1); }

  /* ── Highlight ── */
  function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  function hlEn(text, q) {
    let out = esc(text);
    if (!q) return out;
    out = out.replace(new RegExp('('+reEsc(q)+')','gi'),'<mark>$1</mark>');
    return out;
  }

  function hlAr(text, q) {
    let out = esc(text);
    if (!q) return out;
    out = out.replace(new RegExp('('+reEsc(arClean(q))+')','g'),'<mark>$1</mark>');
    return out;
  }

  /* ── Load books list from Typesense ── */
  async function loadBooks(onProgress) {
    if (onProgress) onProgress('Connecting to search database…');
    try {
      const url = new URL(WORKER_URL);
      url.searchParams.set('q', '*');
      url.searchParams.set('per_page', '0');
      url.searchParams.set('facet_by', 'source');
      const r = await fetch(url.toString());
      const data = await r.json();
      const sources = data.facet_counts?.[0]?.counts?.map(c => c.value) || [];
      books = sources.map(name => ({ name, pairs: [], checked: true }));
    } catch(e) {
      console.warn('Could not load book list:', e);
      books = [];
    }
    return books;
  }

  function rebuild() { /* index lives in Typesense — nothing to do locally */ }

  /* ── Search via Typesense ── */
  async function search({ query, lang, mode, useMorpho, exclude, page }) {
    const q = (query || '').trim();
    if (!q) return { hits: [], total: 0 };

    const checkedBooks = books.filter(b => b.checked).map(b => b.name);

    const url = new URL(WORKER_URL);
    url.searchParams.set('q', q);
    url.searchParams.set('lang', lang || 'both');
    url.searchParams.set('page', page || '1');

    if (checkedBooks.length && checkedBooks.length < books.length) {
      url.searchParams.set('filter_by', `source:[${checkedBooks.map(s=>`\`${s}\``).join(',')}]`);
    }

    let data;
    try {
      const r = await fetch(url.toString());
      if (r.status === 429) throw new Error('Too many searches — please wait a moment.');
      data = await r.json();
    } catch(e) {
      return { hits: [], total: 0, error: e.message };
    }

    const hits = (data.hits || []).map(h => {
      const doc = h.document;
      const enSnip = h.highlights?.find(hl=>hl.field==='en')?.snippet || doc.en || '';
      const arSnip = h.highlights?.find(hl=>hl.field==='ar')?.snippet || doc.ar || '';
      return {
        en: doc.en,
        ar: doc.ar,
        src: doc.source,
        score: h.text_match || 0,
        hlEn: enSnip.replace(/<mark>/g,'<mark>').replace(/<\/mark>/g,'</mark>') || hlEn(doc.en, q),
        hlAr: arSnip || hlAr(doc.ar, q)
      };
    });

    // Filter excluded terms client-side
    const excl = (exclude || '').trim().toLowerCase();
    const filtered = excl
      ? hits.filter(h => !h.en.toLowerCase().includes(excl) && !arClean(h.ar).includes(arClean(excl)))
      : hits;

    return {
      hits: filtered,
      total: data.found || 0
    };
  }

  /* ── Concordance ── */
  function makeConcordance(hits, query, lang, win=8) {
    const fw=(query||'').split(/\s+/)[0]||'';
    const lines=[];
    for (const r of hits) {
      const sides=[];
      if (lang!=='en') sides.push({text:r.ar,l:'ar'});
      if (lang!=='ar') sides.push({text:r.en,l:'en'});
      for (const {text,l} of sides) {
        const tokens=text.split(/\s+/);
        for (let i=0;i<tokens.length;i++) {
          const tok=l==='ar'?arClean(tokens[i]):tokens[i].toLowerCase();
          const fwc=l==='ar'?arClean(fw):fw.toLowerCase();
          if (fw && !tok.includes(fwc)) continue;
          lines.push({ pre:tokens.slice(Math.max(0,i-win),i).join(' '),
            kw:tokens[i], post:tokens.slice(i+1,i+1+win).join(' '),
            lang:l, src:r.src, score:r.score });
        }
      }
    }
    return lines;
  }

  /* ── Export ── */
  function exportCSV(hits) {
    const rows=[['#','Source','Arabic','English']];
    hits.forEach((r,i)=>rows.push([i+1,r.src,(r.ar||'').replace(/"/g,'""'),(r.en||'').replace(/"/g,'""')]));
    return rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  }

  function downloadCSV(content, filename) {
    const blob=new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  }

  return {
    loadBooks, rebuild, books: ()=>books,
    search, makeConcordance,
    exportCSV, downloadCSV,
    esc, arClean, enLemma
  };
})();
