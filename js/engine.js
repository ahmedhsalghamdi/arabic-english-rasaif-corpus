/* =========================================================
   Rasaif Corpus Engine
   Handles: loading · morphology · search · concordance ·
            frequency · n-grams · PMI collocations · export
   ========================================================= */

const RasaifEngine = (() => {

  /* ── state ── */
  let catalogue = null;          // parsed corpus/index.json
  const cache = {};              // file_path → raw text
  const parsed = {};             // file_path → [{ar, en}] sentence pairs

  /* ── Arabic stopwords (classical) ── */
  const STOP_AR = new Set([
    'من','إلى','في','على','عن','مع','هذا','هذه','ذلك','تلك','أن','إن',
    'كان','كانت','قال','قالت','الذي','التي','الذين','وقد','قد','لم','لا',
    'ما','أو','ثم','فإن','وأن','بأن','إذ','إذا','حتى','بعد','قبل','عند',
    'كل','هو','هي','هم','هن','أنا','نحن','أنت','وهو','وهي','وقال','فقال',
    'وكان','فكان','إنه','إنها','أنه','أنها','له','لها','لهم','به','بها',
    'فيه','فيها','منه','منها','عنه','عنها','إليه','إليها','وإن','فإنه',
    'عليه','عليها','عليهم','وعن','ومن','وفي','وعلى','وإلى','ولا','ولم'
  ]);

  /* ── English stopwords ── */
  const STOP_EN = new Set([
    'the','a','an','and','of','to','in','is','it','that','he','she','they',
    'we','you','i','was','were','be','been','being','have','has','had','do',
    'does','did','will','would','could','should','may','might','shall','must',
    'not','no','nor','or','but','if','as','at','by','for','from','into','on',
    'out','up','with','about','after','before','between','through','this',
    'these','those','which','who','whom','what','when','where','how','his',
    'her','its','their','our','your','my','said','him','them','us','me','so',
    'than','then','there','here','all','more','also','one','two','each','such'
  ]);

  /* ─────────────────────────────────────────
     ARABIC LIGHT STEMMER  (root approximation)
     strips common prefixes & suffixes
  ───────────────────────────────────────── */
  function stemAr(w) {
    let s = w.replace(/^(وال|فال|بال|كال|لل|ال|وَ|فَ|بِ|لِ|كَ)/, '');
    s = s.replace(/(ون|ات|ين|ان|تان|تين|ة|ه|ها|هم|هن|كم|كن|نا|وا|ني|ية|ي)$/, '');
    return s.length >= 2 ? s : w;
  }

  /* ─────────────────────────────────────────
     ENGLISH LEMMATISER  (rule-based)
  ───────────────────────────────────────── */
  const irregEn = {ran:'run',went:'go',was:'be',were:'be',is:'be',are:'be',
    been:'be',had:'have',has:'have',did:'do',said:'say',told:'tell',
    came:'come',took:'take',made:'make',gave:'give',got:'get',saw:'see',
    knew:'know',thought:'think',found:'find',became:'become',shown:'show'};

  function lemmatiseEn(w) {
    const lw = w.toLowerCase();
    if (irregEn[lw]) return irregEn[lw];
    if (lw.endsWith('ies') && lw.length > 4) return lw.slice(0,-3)+'y';
    if (lw.endsWith('ied') && lw.length > 4) return lw.slice(0,-3)+'y';
    if (lw.endsWith('ing') && lw.length > 5) return lw.slice(0,-3);
    if (lw.endsWith('ed') && lw.length > 4)  return lw.slice(0,-2);
    if (lw.endsWith('er') && lw.length > 4)  return lw.slice(0,-2);
    if (lw.endsWith('est') && lw.length > 5) return lw.slice(0,-3);
    if (lw.endsWith('s') && !lw.endsWith('ss') && lw.length > 3) return lw.slice(0,-1);
    return lw;
  }

  /* ─────────────────────────────────────────
     TOKENISERS
  ───────────────────────────────────────── */
  function tokeniseAr(text) {
    return text.replace(/[٠-٩0-9]/g,'')
               .replace(/[^\u0600-\u06FF\s]/g,' ')
               .split(/\s+/).filter(t => t.length > 1);
  }

  function tokeniseEn(text) {
    return text.toLowerCase().replace(/[^a-z\s'-]/g,' ').split(/\s+/).filter(t => t.length > 1);
  }

  /* ─────────────────────────────────────────
     FILE LOADING
  ───────────────────────────────────────── */
  async function loadFile(path) {
    if (cache[path] !== undefined) return cache[path];
    try {
      const r = await fetch(path);
      if (!r.ok) { cache[path] = null; return null; }
      const t = await r.text();
      cache[path] = t;
      return t;
    } catch { cache[path] = null; return null; }
  }

  /* Parse a pair of parallel files into [{ar, en}] sentence pairs */
  async function loadPair(text_meta) {
    const key = text_meta.id;
    if (parsed[key]) return parsed[key];
    const [arRaw, enRaw] = await Promise.all([
      loadFile(text_meta.file_ar),
      loadFile(text_meta.file_en)
    ]);
    if (!arRaw || !enRaw) { parsed[key] = []; return []; }
    const arLines = arRaw.split('\n').map(l=>l.trim()).filter(Boolean);
    const enLines = enRaw.split('\n').map(l=>l.trim()).filter(Boolean);
    const pairs = [];
    const len = Math.min(arLines.length, enLines.length);
    for (let i = 0; i < len; i++) {
      pairs.push({ ar: arLines[i], en: enLines[i], textId: key,
                   title_ar: text_meta.title_ar, title_en: text_meta.title_en,
                   author_ar: text_meta.author_ar, author_en: text_meta.author_en });
    }
    parsed[key] = pairs;
    return pairs;
  }

  /* ─────────────────────────────────────────
     CATALOGUE
  ───────────────────────────────────────── */
  async function loadCatalogue() {
    if (catalogue) return catalogue;
    const r = await fetch('corpus/index.json');
    catalogue = await r.json();
    return catalogue;
  }

  function allTexts(cat) {
    const texts = [];
    const src = cat || catalogue;
    if (!src) return texts;
    for (const category of src.categories) {
      if (category.subcategories) {
        for (const sub of category.subcategories) {
          texts.push(...sub.texts);
        }
      }
    }
    return texts;
  }

  /* ─────────────────────────────────────────
     SEARCH
  ───────────────────────────────────────── */

  /*
    opts: {
      query: string,
      lang: 'both'|'ar'|'en',
      mode: 'phrase'|'any'|'order'|'morph',
      exclude: string,
      textIds: Set<string>|null   (null = all)
    }
    returns: [{ar, en, textId, title_ar, title_en, author_ar, author_en,
               matchAr: bool, matchEn: bool, highlightAr: string, highlightEn: string}]
  */
  async function search(opts) {
    const cat = await loadCatalogue();
    const texts = allTexts(cat).filter(t => !opts.textIds || opts.textIds.has(t.id));
    const results = [];
    const excl = opts.exclude ? opts.exclude.trim().toLowerCase() : '';

    for (const tm of texts) {
      const pairs = await loadPair(tm);
      for (const pair of pairs) {
        if (excl && (pair.ar.includes(excl) || pair.en.toLowerCase().includes(excl))) continue;
        const [mAr, hAr] = matchSegment(pair.ar, opts.query, 'ar', opts.mode, opts.lang);
        const [mEn, hEn] = matchSegment(pair.en, opts.query, 'en', opts.mode, opts.lang);
        const show = opts.lang === 'ar' ? mAr : opts.lang === 'en' ? mEn : (mAr || mEn);
        if (show) {
          results.push({...pair, matchAr: mAr, matchEn: mEn,
                        highlightAr: hAr, highlightEn: hEn});
        }
      }
    }
    return results;
  }

  function matchSegment(text, query, lang, mode, langFilter) {
    if (langFilter !== 'both' && langFilter !== lang) return [false, text];
    const q = query.trim();
    if (!q) return [false, text];

    if (mode === 'phrase') {
      const re = new RegExp(escapeRe(q), 'gi');
      if (!re.test(text)) return [false, text];
      return [true, text.replace(new RegExp(escapeRe(q),'gi'), m => `<mark>${m}</mark>`)];
    }

    if (mode === 'morph') {
      const qStem = lang === 'ar' ? stemAr(q) : lemmatiseEn(q);
      const tokens = lang === 'ar' ? tokeniseAr(text) : tokeniseEn(text);
      const matched = new Set();
      for (const tok of tokens) {
        const stem = lang === 'ar' ? stemAr(tok) : lemmatiseEn(tok);
        if (stem === qStem || tok.toLowerCase().includes(qStem)) matched.add(tok);
      }
      if (!matched.size) return [false, text];
      let hl = text;
      for (const m of matched) {
        hl = hl.replace(new RegExp(escapeRe(m),'g'), `<mark>${m}</mark>`);
      }
      return [true, hl];
    }

    // 'any' or 'order'
    const words = q.split(/\s+/).filter(Boolean);
    let found = false;
    if (mode === 'any') {
      found = words.some(w => text.toLowerCase().includes(w.toLowerCase()) ||
                              text.includes(w));
    } else { // order
      found = words.every(w => text.toLowerCase().includes(w.toLowerCase()) ||
                               text.includes(w));
    }
    if (!found) return [false, text];
    let hl = text;
    for (const w of words) {
      hl = hl.replace(new RegExp(escapeRe(w),'gi'), m => `<mark>${m}</mark>`);
    }
    return [true, hl];
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  /* ─────────────────────────────────────────
     CONCORDANCE (KWIC)
  ───────────────────────────────────────── */
  function makeConcordance(results, query, lang, windowSize=8) {
    const lines = [];
    for (const r of results) {
      const sides = [];
      if ((lang === 'both' || lang === 'ar') && r.matchAr) sides.push({text: r.ar, l: 'ar'});
      if ((lang === 'both' || lang === 'en') && r.matchEn) sides.push({text: r.en, l: 'en'});
      for (const {text, l} of sides) {
        const tokens = text.split(/\s+/);
        const q = query.trim();
        for (let i = 0; i < tokens.length; i++) {
          if (tokens[i].toLowerCase().includes(q.toLowerCase()) || tokens[i].includes(q)) {
            const pre = tokens.slice(Math.max(0,i-windowSize),i).join(' ');
            const kw  = tokens[i];
            const post= tokens.slice(i+1,i+1+windowSize).join(' ');
            lines.push({pre, kw, post, lang: l,
                        title_ar: r.title_ar, title_en: r.title_en,
                        author_ar: r.author_ar, author_en: r.author_en});
          }
        }
      }
    }
    return lines;
  }

  /* ─────────────────────────────────────────
     STATISTICS & FREQUENCY
  ───────────────────────────────────────── */
  async function computeStats(textIds=null) {
    const cat = await loadCatalogue();
    const texts = allTexts(cat).filter(t => !textIds || textIds.has(t.id));
    let tokAr=0, tokEn=0, typeAr=new Set(), typeEn=new Set(), pairs=0;
    const freqAr={}, freqEn={};

    for (const tm of texts) {
      const ps = await loadPair(tm);
      pairs += ps.length;
      for (const p of ps) {
        const tAr = tokeniseAr(p.ar);
        const tEn = tokeniseEn(p.en);
        tokAr += tAr.length; tokEn += tEn.length;
        for (const t of tAr) {
          const s = stemAr(t);
          if (!STOP_AR.has(t) && t.length > 2) { typeAr.add(s); freqAr[s]=(freqAr[s]||0)+1; }
        }
        for (const t of tEn) {
          const l = lemmatiseEn(t);
          if (!STOP_EN.has(l) && l.length > 2) { typeEn.add(l); freqEn[l]=(freqEn[l]||0)+1; }
        }
      }
    }
    return {
      tokAr, tokEn, typeAr: typeAr.size, typeEn: typeEn.size,
      ttrAr: typeAr.size / Math.max(tokAr,1),
      ttrEn: typeEn.size / Math.max(tokEn,1),
      sentences: pairs,
      freqAr: sortFreq(freqAr), freqEn: sortFreq(freqEn)
    };
  }

  function sortFreq(obj) {
    return Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  }

  /* ─────────────────────────────────────────
     N-GRAMS
  ───────────────────────────────────────── */
  async function nGrams(n, lang, textIds=null) {
    const cat = await loadCatalogue();
    const texts = allTexts(cat).filter(t => !textIds || textIds.has(t.id));
    const freq = {};
    for (const tm of texts) {
      const ps = await loadPair(tm);
      for (const p of ps) {
        const toks = lang === 'ar'
          ? tokeniseAr(p.ar).filter(t=>!STOP_AR.has(t) && t.length>2).map(stemAr)
          : tokeniseEn(p.en).filter(t=>!STOP_EN.has(lemmatiseEn(t)) && t.length>2).map(lemmatiseEn);
        for (let i = 0; i <= toks.length - n; i++) {
          const gram = toks.slice(i,i+n).join(' ');
          freq[gram] = (freq[gram]||0)+1;
        }
      }
    }
    return sortFreq(freq).filter(([,c])=>c>1);
  }

  /* ─────────────────────────────────────────
     PMI COLLOCATIONS
  ───────────────────────────────────────── */
  async function collocations(lang, window=4, minFreq=2, textIds=null) {
    const cat = await loadCatalogue();
    const texts = allTexts(cat).filter(t => !textIds || textIds.has(t.id));
    const coFreq = {}, uFreq = {};
    let total = 0;

    for (const tm of texts) {
      const ps = await loadPair(tm);
      for (const p of ps) {
        let toks = lang === 'ar'
          ? tokeniseAr(p.ar).filter(t=>!STOP_AR.has(t)&&t.length>2).map(stemAr)
          : tokeniseEn(p.en).filter(t=>!STOP_EN.has(lemmatiseEn(t))&&t.length>2).map(lemmatiseEn);
        for (const t of toks) { uFreq[t]=(uFreq[t]||0)+1; total++; }
        for (let i=0;i<toks.length;i++) {
          for (let j=i+1;j<=Math.min(i+window,toks.length-1);j++) {
            const pair = toks[i]<toks[j]?`${toks[i]}|${toks[j]}`:`${toks[j]}|${toks[i]}`;
            coFreq[pair]=(coFreq[pair]||0)+1;
          }
        }
      }
    }
    const N = total;
    return Object.entries(coFreq)
      .filter(([,c])=>c>=minFreq)
      .map(([pair,c])=>{
        const [w1,w2]=pair.split('|');
        const pmi = Math.log2((c/N)/((uFreq[w1]/N)*(uFreq[w2]/N)));
        return {w1,w2,freq:c,pmi};
      })
      .sort((a,b)=>b.pmi-a.pmi)
      .slice(0,50);
  }

  /* ─────────────────────────────────────────
     EXPORT
  ───────────────────────────────────────── */
  function exportCSV(results, lang='both') {
    const rows = [['#','Author (AR)','Author (EN)','Title (AR)','Title (EN)','Arabic','English']];
    results.forEach((r,i)=>{
      rows.push([
        i+1,
        r.author_ar||'', r.author_en||'',
        r.title_ar||'',  r.title_en||'',
        (r.ar||'').replace(/"/g,'""'),
        (r.en||'').replace(/"/g,'""')
      ]);
    });
    return rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  }

  function downloadCSV(content, filename) {
    const blob = new Blob(['\uFEFF'+content], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  function exportConcordanceTSV(lines) {
    const rows = [['Lang','Left context','Keyword','Right context','Title','Author']];
    lines.forEach(l => rows.push([l.lang, l.pre, l.kw, l.post,
      l.lang==='ar'?l.title_ar:l.title_en,
      l.lang==='ar'?l.author_ar:l.author_en]));
    return rows.map(r=>r.join('\t')).join('\n');
  }

  /* ─────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────── */
  return {
    loadCatalogue, allTexts, loadPair,
    search, makeConcordance,
    computeStats, nGrams, collocations,
    exportCSV, downloadCSV, exportConcordanceTSV,
    stemAr, lemmatiseEn
  };
})();
