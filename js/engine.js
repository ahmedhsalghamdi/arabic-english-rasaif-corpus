/* =========================================================
   Raṣāʾif Engine v4 — Typesense backend
   Clean rebuild. All search handled server-side.
   ========================================================= */

const RasaifEngine = (() => {

  const WORKER_URL = 'https://rasaif-search.ahmed-hs-alghamdi.workers.dev';

  /* ── Book metadata ── */
  const BOOK_META = {
    'Al-Asnam - Ibn al-Kalbi': {
      title_en: 'The Book of Idols',
      title_ar: 'كتاب الأصنام',
      author_en: 'Ibn al-Kalbi',
      author_ar: 'ابن الكلبي',
      death_ah: 204,
      death_label_en: 'd. 204 AH / 819 CE',
      death_label_ar: 'ت. 204 هـ'
    },
    'Al-Amwal - Ibn Sallam': {
      title_en: 'The Book of Revenue',
      title_ar: 'كتاب الأموال',
      author_en: 'Ibn Sallam',
      author_ar: 'أبو عبيد القاسم بن سلام',
      death_ah: 224,
      death_label_en: 'd. 224 AH / 838 CE',
      death_label_ar: 'ت. 224 هـ'
    },
    'The Excellence of the Arabs - Ibn Qutaybah': {
      title_en: 'The Excellence of the Arabs',
      title_ar: 'فضل العرب',
      author_en: 'Ibn Qutaybah',
      author_ar: 'ابن قتيبة',
      death_ah: 276,
      death_label_en: 'd. 276 AH / 889 CE',
      death_label_ar: 'ت. 276 هـ'
    },
    'Canon - Ibn Sina': {
      title_en: 'The Canon of Medicine',
      title_ar: 'القانون في الطب',
      author_en: 'Ibn Sina',
      author_ar: 'ابن سينا',
      death_ah: 428,
      death_label_en: 'd. 428 AH / 1037 CE',
      death_label_ar: 'ت. 428 هـ'
    },
    'Tasrif - Zahrawi': {
      title_en: 'The Method of Medicine',
      title_ar: 'التصريف لمن عجز عن التأليف',
      author_en: 'Al-Zahrawi',
      author_ar: 'الزهراوي',
      death_ah: 404,
      death_label_en: 'd. 404 AH / 1013 CE',
      death_label_ar: 'ت. 404 هـ'
    },
    '1046CE.Al-Akhlaq.Ibn.Hazm': {
      title_en: 'Morals and Behaviour',
      title_ar: 'الأخلاق والسير',
      author_en: 'Ibn Hazm',
      author_ar: 'ابن حزم',
      death_ah: 456,
      death_label_en: 'd. 456 AH / 1064 CE',
      death_label_ar: 'ت. 456 هـ'
    },
    'Nahg al-Balagha compiled by  ash-Sharif ar-Radi': {
      title_en: 'Peak of Eloquence',
      title_ar: 'نهج البلاغة',
      author_en: 'ash-Sharif ar-Radi',
      author_ar: 'الشريف الرضي',
      death_ah: 406,
      death_label_en: 'd. 406 AH / 1016 CE',
      death_label_ar: 'ت. 406 هـ'
    },
    'Muqaddima - Ibn Khaldun': {
      title_en: 'The Muqaddimah',
      title_ar: 'المقدمة',
      author_en: 'Ibn Khaldun',
      author_ar: 'ابن خلدون',
      death_ah: 808,
      death_label_en: 'd. 808 AH / 1406 CE',
      death_label_ar: 'ت. 808 هـ'
    },
    'futuh ash-sham - psuedo-Waqidi': {
      title_en: 'The Conquests of Syria',
      title_ar: 'فتوح الشام',
      author_en: 'Pseudo-Waqidi',
      author_ar: 'المؤلف مجهول',
      death_ah: 9999,
      death_label_en: 'Date unknown (post 8th c. AH)',
      death_label_ar: 'تاريخه مجهول (بعد القرن الثامن)'
    }
  };

  let books = [];

  /* ── Arabic normalisation ── */
  function arClean(s) {
    if (!s) return '';
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

  /* ── Helpers ── */
  function esc(t) {
    return String(t)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  function getMeta(name) {
    return BOOK_META[name] || {
      title_en: name,
      title_ar: name,
      author_en: '',
      author_ar: '',
      death_ah: 9998,
      death_label_en: '',
      death_label_ar: ''
    };
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

      // Sort by death_ah (chronological)
      books = sources
        .map(name => ({ name, checked: true, meta: getMeta(name) }))
        .sort((a, b) => a.meta.death_ah - b.meta.death_ah);

    } catch(e) {
      console.warn('Could not load book list:', e);
      books = [];
    }
    return books;
  }

  function rebuild() { /* index lives in Typesense */ }

  /* ── Search via Typesense Worker ── */
  async function search({ query, lang, mode, useMorpho, exclude, page }) {
    const q = (query || '').trim();
    if (!q) return { hits: [], total: 0 };

    const checkedBooks = books.filter(b => b.checked).map(b => b.name);
    if (!checkedBooks.length) return { hits: [], total: 0 };

    const url = new URL(WORKER_URL);
    url.searchParams.set('q', q);
    url.searchParams.set('lang', lang || 'both');
    url.searchParams.set('page', String(page || 1));

    if (checkedBooks.length < books.length) {
      url.searchParams.set('filter_by',
        `source:[${checkedBooks.map(s => `\`${s}\``).join(',')}]`
      );
    }

    let data;
    try {
      const r = await fetch(url.toString());
      if (r.status === 429) throw new Error('Too many searches — please wait a moment.');
      if (!r.ok) throw new Error(`Search error: ${r.status}`);
      data = await r.json();
    } catch(e) {
      return { hits: [], total: 0, error: e.message };
    }

    const hits = (data.hits || []).map(h => {
      const doc = h.document;
      // Use Typesense highlights if available, otherwise fallback
      const enHL = h.highlights?.find(hl => hl.field === 'en');
      const arHL = h.highlights?.find(hl => hl.field === 'ar');
      const hlEn = enHL?.snippet ?? esc(doc.en || '');
      const hlAr = arHL?.snippet ?? esc(doc.ar || '');
      return {
        en:    doc.en   || '',
        ar:    doc.ar   || '',
        src:   doc.source || '',
        score: h.text_match_score || h.text_match || 0,
        hlEn,
        hlAr
      };
    });

    // Client-side exclusion filter
    const excl = (exclude || '').trim().toLowerCase();
    const filtered = excl
      ? hits.filter(h =>
          !h.en.toLowerCase().includes(excl) &&
          !arClean(h.ar).includes(arClean(excl))
        )
      : hits;

    return {
      hits: filtered,
      total: data.found || 0,
      page:  data.page  || 1,
      totalPages: Math.ceil((data.found || 0) / 50)
    };
  }

  /* ── Concordance ── */
  function makeConcordance(hits, query, lang, win=8) {
    const fw = (query || '').split(/\s+/)[0] || '';
    const lines = [];
    for (const r of hits) {
      const sides = [];
      if (lang !== 'en') sides.push({ text: r.ar, l: 'ar' });
      if (lang !== 'ar') sides.push({ text: r.en, l: 'en' });
      for (const { text, l } of sides) {
        const tokens = text.split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
          const tok = l === 'ar' ? arClean(tokens[i]) : tokens[i].toLowerCase();
          const fwc = l === 'ar' ? arClean(fw) : fw.toLowerCase();
          if (fw && !tok.includes(fwc)) continue;
          lines.push({
            pre:  tokens.slice(Math.max(0, i - win), i).join(' '),
            kw:   tokens[i],
            post: tokens.slice(i + 1, i + 1 + win).join(' '),
            lang: l,
            src:  r.src,
            score: r.score
          });
        }
      }
    }
    return lines;
  }

  /* ── Export ── */
  function exportCSV(hits) {
    const rows = [['#','Source','Arabic','English']];
    hits.forEach((r, i) => rows.push([
      i + 1,
      r.src,
      (r.ar || '').replace(/"/g, '""'),
      (r.en || '').replace(/"/g, '""')
    ]));
    return rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  }

  function downloadCSV(content, filename) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  return {
    loadBooks, rebuild,
    books:    () => books,
    getMeta,
    search, makeConcordance,
    exportCSV, downloadCSV,
    esc, arClean, enLemma
  };

})();
