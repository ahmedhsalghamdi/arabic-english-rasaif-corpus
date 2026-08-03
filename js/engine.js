/* =========================================================
   Raṣāʾif Engine v5 — Typesense backend
   25 books, chronological metadata, up/down navigation
   ========================================================= */

const RasaifEngine = (() => {

  const WORKER_URL = 'https://rasaif-search.ahmed-hs-alghamdi.workers.dev';

  /* ── Book metadata — sorted by death_ah ── */
  const BOOK_META = {

  'Al-Asnam - Ibn al-Kalbi': {
    title_en: 'The Book of Idols',
    title_ar: 'كتاب الأصنام',
    author_en: 'Ibn al-Kalbī',
    author_ar: 'ابن الكلبي',
    death_ah: 204,
    death_label_en: 'd. 204 AH / 819 CE',
    death_label_ar: 'ت. 204 هـ'
  },

  'Al-Amwal - Ibn Sallam': {
    title_en: 'The Book of Revenue',
    title_ar: 'كتاب الأموال',
    author_en: 'Abū ʿUbayd al-Qāsim ibn Sallām',
    author_ar: 'أبو عبيد القاسم بن سلام',
    death_ah: 224,
    death_label_en: 'd. 224 AH / 838 CE',
    death_label_ar: 'ت. 224 هـ'
  },

  'Risala - Al-Shafii': {
    // VERIFIED: Library of Arabic Literature edition (trans. Joseph E. Lowry)
    // is titled exactly "The Epistle on Legal Theory" — confirmed correct as-is.
    title_en: 'The Epistle on Legal Theory',
    title_ar: 'الرسالة',
    author_en: 'Al-Shāfiʿī',
    author_ar: 'الإمام الشافعي',
    death_ah: 204,
    death_label_en: 'd. 204 AH / 820 CE',
    death_label_ar: 'ت. 204 هـ'
  },

  'Al-Bukhala - Al-Jahiz': {
    title_en: 'The Book of Misers',
    title_ar: 'البخلاء',
    author_en: 'Al-Jāḥiẓ',
    author_ar: 'الجاحظ',
    death_ah: 255,
    death_label_en: 'd. 255 AH / 869 CE',
    death_label_ar: 'ت. 255 هـ'
  },

  'The Excellence of the Arabs - Ibn Qutaybah': {
    // Matches title page exactly (Library of Arabic Literature ed.,
    // trans. Sarah Bowen Savant & Peter Webb)
    title_en: 'The Excellence of the Arabs',
    title_ar: 'فضل العرب',
    author_en: 'Ibn Qutayba',
    author_ar: 'ابن قتيبة',
    death_ah: 276,
    death_label_en: 'd. 276 AH / 889 CE',
    death_label_ar: 'ت. 276 هـ'
  },

  'Al-Futuwwa - Al-Sulami': {
    // Matches title page exactly (trans. Tosun Bayrak)
    title_en: 'Book of Sufi Chivalry',
    title_ar: 'كتاب الفتوة',
    author_en: 'Al-Sulamī',
    author_ar: 'أبو عبد الرحمن السُّلَمي',
    death_ah: 412,
    death_label_en: 'd. 412 AH / 1021 CE',
    death_label_ar: 'ت. 412 هـ'
  },

  'Adab al-Ghuraba - Al-Isfahani': {
    // CORRECTED: previous entry ("The Manners of Strangers") was not the
    // published title. Verified published translation is Crone & Moreh,
    // "The Book of Strangers" (Princeton: Markus Wiener, 2000).
    // Note: authorship of this work is disputed among scholars.
    title_en: 'The Book of Strangers',
    title_ar: 'كتاب أدب الغرباء',
    author_en: 'Al-Iṣfahānī',
    author_ar: 'أبو الفرج الأصفهاني',
    death_ah: 356,
    death_label_en: 'd. 356 AH / 967 CE',
    death_label_ar: 'ت. 356 هـ'
  },

  'Akhbar Abi Tammam - Al-Suli': {
    // Matches title page exactly
    title_en: 'The Life and Times of Abū Tammām',
    title_ar: 'أخبار أبي تمام',
    author_en: 'Al-Ṣūlī',
    author_ar: 'أبو بكر الصولي',
    death_ah: 335,
    death_label_en: 'd. 335 AH / 946 CE',
    death_label_ar: 'ت. 335 هـ'
  },

  'Tasrif - Al-Zahrawi': {
    // CORRECTED: previous entry ("The Method of Medicine") was not the
    // published title. The authoritative English translation (of the
    // surgical 30th treatise) is M.S. Spink & G.L. Lewis,
    // "Albucasis on Surgery and Instruments" (UC Press, 1973).
    title_en: 'Albucasis on Surgery and Instruments',
    title_ar: 'التصريف لمن عجز عن التأليف',
    author_en: 'Al-Zahrāwī',
    author_ar: 'الزهراوي',
    death_ah: 404,
    death_label_en: 'd. 404 AH / 1013 CE',
    death_label_ar: 'ت. 404 هـ'
  },

  'Nahj al-Balagha - ash-Sharif ar-Radi': {
    title_en: 'Peak of Eloquence',
    title_ar: 'نهج البلاغة',
    author_en: 'Compiled by al-Sharīf al-Raḍī',
    author_ar: 'جمعه الشريف الرضي',
    death_ah: 406,
    death_label_en: 'd. 406 AH / 1016 CE',
    death_label_ar: 'ت. 406 هـ'
  },

  'Canon - Ibn Sina': {
    title_en: 'The Canon of Medicine',
    title_ar: 'القانون في الطب',
    author_en: 'Ibn Sīnā',
    author_ar: 'ابن سينا',
    death_ah: 428,
    death_label_en: 'd. 428 AH / 1037 CE',
    death_label_ar: 'ت. 428 هـ'
  },

  'Optics - Ibn al-Haytham': {
    // CORRECTED: matches the actual published translation title exactly —
    // A.I. Sabra, "The Optics of Ibn al-Haytham" (Warburg Institute, 1989) —
    // and matches this file's own title page.
    title_en: 'The Optics of Ibn al-Haytham',
    title_ar: 'كتاب المناظر',
    author_en: 'Ibn al-Haytham',
    author_ar: 'ابن الهيثم',
    death_ah: 430,
    death_label_en: 'd. 430 AH / 1040 CE',
    death_label_ar: 'ت. 430 هـ'
  },

  'Al-Akhlaq wa al-Siyar - Ibn Hazm': {
    // NOT FULLY VERIFIED — flagging for your review. Current title is
    // a reasonable working translation but I could not confirm one
    // single standard published English title against a specific
    // edition. If you know the edition you're using, tell me and I'll
    // match it exactly.
    title_en: 'Morals and Behaviour',
    title_ar: 'الأخلاق والسير',
    author_en: 'Ibn Ḥazm',
    author_ar: 'ابن حزم',
    death_ah: 456,
    death_label_en: 'd. 456 AH / 1064 CE',
    death_label_ar: 'ت. 456 هـ'
  },

  'Tawq al-Hamama - Ibn Hazm': {
    // Matches title page and A.J. Arberry's well-known translation
    title_en: 'The Ring of the Dove',
    title_ar: 'طوق الحمامة',
    author_en: 'Ibn Ḥazm',
    author_ar: 'ابن حزم',
    death_ah: 456,
    death_label_en: 'd. 456 AH / 1064 CE',
    death_label_ar: 'ت. 456 هـ'
  },

  'Al-Farq bayn al-Firaq - Al-Baghdadi': {
    // Matches title page exactly (Kate Chambers Seelye translation)
    title_en: 'Moslem Schisms and Sects',
    title_ar: 'الفرق بين الفرق',
    author_en: 'Al-Baghdādī',
    author_ar: 'عبد القاهر البغدادي',
    death_ah: 429,
    death_label_en: 'd. 429 AH / 1037 CE',
    death_label_ar: 'ت. 429 هـ'
  },

  'Al-Itibar - Ibn Munqidh': {
    // VERIFIED — modern standard is Paul M. Cobb's Penguin Classics
    // translation, "The Book of Contemplation" (2008)
    title_en: 'The Book of Contemplation',
    title_ar: 'كتاب الاعتبار',
    author_en: 'Usāma ibn Munqidh',
    author_ar: 'أسامة بن منقذ',
    death_ah: 584,
    death_label_en: 'd. 584 AH / 1188 CE',
    death_label_ar: 'ت. 584 هـ'
  },

  'Hayy ibn Yaqzan - Ibn Tufayl': {
    // Matches title page and Lenn Evan Goodman's standard translation
    title_en: 'Ḥayy ibn Yaqẓān: A Philosophical Tale',
    title_ar: 'حي بن يقظان',
    author_en: 'Ibn Ṭufayl',
    author_ar: 'ابن طفيل',
    death_ah: 581,
    death_label_en: 'd. 581 AH / 1185 CE',
    death_label_ar: 'ت. 581 هـ'
  },

  'Al-Nawadir al-Sultaniyya - Ibn Shaddad': {
    // VERIFIED — D.S. Richards translation (Ashgate/Routledge, 2001)
    title_en: 'The Rare and Excellent History of Saladin',
    title_ar: 'النوادر السلطانية',
    author_en: 'Bahāʾ al-Dīn Ibn Shaddād',
    author_ar: 'بهاء الدين ابن شداد',
    death_ah: 632,
    death_label_en: 'd. 632 AH / 1234 CE',
    death_label_ar: 'ت. 632 هـ'
  },

  'Tafrij al-Kurub - Ibn Abi al-Rabi': {
    // Matches title page exactly
    title_en: 'A Muslim Manual of War',
    title_ar: 'تفريج الكروب في تدبير الحروب',
    author_en: 'Ibn Abī al-Rabīʿ',
    author_ar: 'ابن أبي الربيع',
    death_ah: 688,
    death_label_en: 'd. 688 AH / 1289 CE',
    death_label_ar: 'ت. 688 هـ'
  },

  'Wafayat al-Ayan - Ibn Khallikan': {
    // CORRECTED: previous entry ("Deaths of Eminent Men") was not the
    // published title. Standard translation is William MacGuckin de
    // Slane's "Ibn Khallikan's Biographical Dictionary" (1842–71) —
    // matches this file's own title page exactly.
    title_en: "Ibn Khallikan's Biographical Dictionary",
    title_ar: 'وفيات الأعيان',
    author_en: 'Ibn Khallikān',
    author_ar: 'ابن خلِّكان',
    death_ah: 681,
    death_label_en: 'd. 681 AH / 1282 CE',
    death_label_ar: 'ت. 681 هـ'
  },

  'Nishwar al-Muhadara - al-Tanukhi': {
    // VERIFIED — D.S. Margoliouth's standard translation
    title_en: 'Table-Talk of a Mesopotamian Judge',
    title_ar: 'نشوار المحاضرة',
    author_en: 'Al-Tanūkhī',
    author_ar: 'التنوخي',
    death_ah: 384,
    death_label_en: 'd. 384 AH / 994 CE',
    death_label_ar: 'ت. 384 هـ'
  },

  'Al-Iqd al-Farid - Ibn Abd Rabbih': {
    // Matches title page and Issa J. Boullata's standard translation
    title_en: 'The Unique Necklace',
    title_ar: 'العقد الفريد',
    author_en: 'Ibn ʿAbd Rabbih',
    author_ar: 'ابن عبد ربه',
    death_ah: 328,
    death_label_en: 'd. 328 AH / 940 CE',
    death_label_ar: 'ت. 328 هـ'
  },

  'Rihla - Ibn Battuta': {
    // Standard translation: H.A.R. Gibb, "The Travels of Ibn Battuta"
    title_en: 'The Travels of Ibn Battuta',
    title_ar: 'رحلة ابن بطوطة',
    author_en: 'Ibn Baṭṭūṭa',
    author_ar: 'ابن بطوطة',
    death_ah: 779,
    death_label_en: 'd. 779 AH / 1377 CE',
    death_label_ar: 'ت. 779 هـ'
  },

  'Muqaddima - Ibn Khaldun': {
    // Standard translation: Franz Rosenthal, "The Muqaddimah:
    // An Introduction to History"
    title_en: 'The Muqaddimah: An Introduction to History',
    title_ar: 'المقدمة',
    author_en: 'Ibn Khaldūn',
    author_ar: 'ابن خلدون',
    death_ah: 808,
    death_label_en: 'd. 808 AH / 1406 CE',
    death_label_ar: 'ت. 808 هـ'
  },

  'Futuh ash-Sham - Pseudo-Waqidi': {
    // NOT FULLY VERIFIED — authorship itself is pseudonymous/contested
    // (traditionally misattributed to al-Waqidi), and I could not confirm
    // a single standard scholarly edition's title against this specific
    // translation. Kept as working title; matches this file's own text.
    title_en: 'The Conquests of Syria',
    title_ar: 'فتوح الشام',
    author_en: 'Pseudo-Wāqidī',
    author_ar: 'المؤلف مجهول',
    death_ah: 9999,
    death_label_en: 'Date unknown (post 8th c. AH)',
    death_label_ar: 'تاريخه مجهول (بعد القرن الثامن)'
  },

  /* ── New books ── */

  'Tarikh al-Tabari - Al-Tabari': {
    // Matches title page exactly (SUNY Press "The History of al-Tabari" series)
    title_en: 'The History of al-Ṭabarī',
    title_ar: 'تاريخ الطبري',
    author_en: 'Al-Ṭabarī',
    author_ar: 'الطبري',
    death_ah: 310,
    death_label_en: 'd. 310 AH / 923 CE',
    death_label_ar: 'ت. 310 هـ'
  },

  "al-Dhari'a ila Makarim al-Shari'a - al-Raghib al-Isfahani": {
    // Matches title page text closely ("The Means to Noble Qualities of the Law")
    title_en: 'The Means to Noble Qualities of the Law',
    title_ar: 'الذريعة إلى مكارم الشريعة',
    author_en: 'Al-Rāghib al-Iṣfahānī',
    author_ar: 'أبو القاسم الحسين بن محمد الراغب الأصفهاني',
    death_ah: 502,
    death_label_en: 'd. 502 AH / 1108 CE',
    death_label_ar: 'ت. 502 هـ'
  },

  'Kitab al-Qiyan - Al-Jahiz': {
    // Matches title page exactly
    title_en: 'The Epistle on Singing-Girls',
    title_ar: 'كتاب القيان',
    author_en: 'Al-Jāḥiẓ',
    author_ar: 'الجاحظ',
    death_ah: 255,
    death_label_en: 'd. 255 AH / 869 CE',
    death_label_ar: 'ت. 255 هـ'
  },

  "Rasa'il al-Jahiz - Al-Jahiz": {
    // NOT FULLY VERIFIED — this file appears to be a selection/anthology
    // of Al-Jahiz's epistles rather than a single standardly-titled work;
    // "Selections" is what appears on this file's own title page.
    title_en: 'Selections from the Epistles of al-Jāḥiẓ',
    title_ar: 'منتخبات من مجموع رسائل الجاحظ',
    author_en: 'Al-Jāḥiẓ',
    author_ar: 'الجاحظ',
    death_ah: 255,
    death_label_en: 'd. 255 AH / 869 CE',
    death_label_ar: 'ت. 255 هـ'
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
    if (!name) return _fallback(name);
    if (BOOK_META[name]) return BOOK_META[name];
    // fuzzy match
    const lower = name.toLowerCase();
    for (const key of Object.keys(BOOK_META)) {
      if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
        return BOOK_META[key];
      }
    }
    return _fallback(name);
  }

  function _fallback(name) {
    return {
      title_en: name || '',
      title_ar: name || '',
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

  /* ── Search ── */
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
      const enHL = h.highlights?.find(hl => hl.field === 'en');
      const arHL = h.highlights?.find(hl => hl.field === 'ar');
      return {
        id:    doc.id    || '',
        seq:   doc.seq   || 0,
        en:    doc.en    || '',
        ar:    doc.ar    || '',
        src:   doc.source || '',
        score: h.text_match_score || h.text_match || 0,
        // For each field, Typesense returns:
        //   .value = full text with <mark> tags injected everywhere the term appears
        //   .snippet = short excerpt around match with <mark> tags
        // Strategy: use .value (full highlighted text) as the display
        //           Fall back to esc(doc.en) if no highlight available
        hlEn:    enHL?.value ?? esc(doc.en || ''),
        hlAr:    arHL?.value ?? esc(doc.ar || ''),
        fullEn:  esc(doc.en || ''),
        fullAr:  esc(doc.ar || ''),
        snippetEn: enHL?.snippet || '',
        snippetAr: arHL?.snippet || ''
      };
    });

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

  /* ── Fetch adjacent sentence for up/down navigation ── */
  async function fetchSibling(src, seq, direction) {
    const targetSeq = direction === 'up' ? seq - 1 : seq + 1;
    if (targetSeq < 1) return null;

    const sourceId = src
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const docId = `${sourceId}_${String(targetSeq).padStart(5, '0')}`;

    try {
      const url = new URL(WORKER_URL);
      url.searchParams.set('fetch_id', docId);
      const r = await fetch(url.toString());
      if (!r.ok) return null;
      const data = await r.json();
      // Typesense returns the document directly when fetching by ID
      return data.id ? data : (data.document || null);
    } catch(e) {
      return null;
    }
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
            pre:   tokens.slice(Math.max(0, i-win), i).join(' '),
            kw:    tokens[i],
            post:  tokens.slice(i+1, i+1+win).join(' '),
            lang:  l,
            src:   r.src,
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
      i+1, r.src,
      (r.ar||'').replace(/"/g,'""'),
      (r.en||'').replace(/"/g,'""')
    ]));
    return rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  }

  function downloadCSV(content, filename) {
    const blob = new Blob(['\uFEFF'+content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  return {
    loadBooks, rebuild,
    books:    () => books,
    getMeta,  fetchSibling,
    search,   makeConcordance,
    exportCSV, downloadCSV,
    esc, arClean, enLemma
  };

})();
