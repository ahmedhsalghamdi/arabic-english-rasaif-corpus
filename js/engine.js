/* =========================================================
   Raṣāʾif — Search & Analysis Engine
   BM25 + proximity + exact bonus ranking
   Arabic root stemmer · English lemmatiser
   PMI collocations · N-grams · Statistics
   ========================================================= */

const RasaifEngine = (() => {

  /* ── state ── */
  let catalogue = null;
  const fileCache = {};
  const pairCache = {};

  /* ── English irregular verbs ── */
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

  /* ── English stopwords ── */
  const EN_STOP = new Set('a an the and or but in on at to of for with by from as is was are were be been being have has had do does did will would could should may might must shall can this that these those it its i we you he she they them their our your his her my me us him all also just not no nor so if when where which who whom what how then than there here s t ve re ll d'.split(' '));

  /* ── Arabic stopwords ── */
  const AR_STOP = new Set('في على من إلى عن مع أن ما لا هو هي هم هن نحن أنت أنتم كان كانت كانوا يكون تكون وقد قد لقد هذا هذه ذلك تلك الذي التي الذين وهو وهي وهم أو ثم لكن بل حتى إذا لما كما مما بما فما وما لأن بأن إن ولا فلا كل بعض له لها لهم لنا لكم بين عند عنه عنها منه منها به بها فيه فيها أي أيضا'.split(' '));

  /* ── Arabic normalisation ── */
  function arClean(s) {
    return s
      .replace(/[\u064B-\u065F\u0670\u0640\u0671]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ت')
      .replace(/ى/g, 'ي');
  }

  /* ── Arabic light stemmer ── */
  const AR_PRE = ['وال','فال','بال','كال','لل','ال','وا','فا','با','كا','لا','و','ف','ب','ك','ل','س','أ'];
  const AR_SUF_L = ['ونني','وني','تني','تموني','ونه','ونها','تموه','وهم','وهن','تان','ون','ين','ات','ان','تا','ها','هم','هن','كم','كن','نا','ني','تم','تن'];
  const AR_SUF_S = ['ته','ية','ي','ة','ت','ن','ا','و'];

  function arRoot(word) {
    let w = arClean(word);
    if (w.length <= 2) return w;
    for (const p of AR_PRE) {
      const pc = arClean(p);
      if (w.startsWith(pc) && w.length - pc.length >= 3) { w = w.slice(pc.length); break; }
    }
    if (w.length > 4 && 'وفب'.includes(w[0])) w = w.slice(1);
    for (const s of AR_SUF_L) {
      const sc = arClean(s);
      if (w.endsWith(sc) && w.length - sc.length >= 3) { w = w.slice(0, -sc.length); break; }
    }
    if (w.length > 3) {
      for (const s of AR_SUF_S) {
        const sc = arClean(s);
        if (w.endsWith(sc) && w.length - sc.length >= 3) { w = w.slice(0, -sc.length); break; }
      }
    }
    if (w.length === 4 && w[1] === 'ا') return w[0]+w[2]+w[3];
    if (w.length === 5 && w[0] === 'م' && w[3] === 'و') return w[1]+w[2]+w[4];
    if (w.length === 4 && w[0] === 'م') return w.slice(1);
    if (w.length >= 5 && w.startsWith('ان')) return w.slice(2);
    if (w.length >= 6 && w.startsWith('است')) return w.slice(3);
    if (w.length >= 4 && w[0] === 'ت') return w.slice(1);
    return w;
  }

  /* ── English lemmatiser ── */
  function enLemma(w) {
    w = w.toLowerCase().replace(/[.,;:!?"'()\-–—]/g, '');
    if (EN_IRREG[w]) return EN_IRREG[w];
    if (w.endsWith('ies') && w.length > 4) return w.slice(0,-3)+'y';
    if (w.endsWith('ied') && w.length > 4) return w.slice(0,-3)+'y';
    if (w.endsWith('ing') && w.length > 5) {
      const s = w.slice(0,-3);
      return (s.length > 3 && s[s.length-1] === s[s.length-2]) ? s.slice(0,-1) : s;
    }
    if (w.endsWith('ed') && w.length > 4) {
      const s = w.slice(0,-2);
      return (s.length > 3 && s[s.length-1] === s[s.length-2]) ? s.slice(0,-1) : s;
    }
    if (w.endsWith('er') && w.length > 4) return w.slice(0,-2);
    if (w.endsWith('ly') && w.length > 4) return w.slice(0,-2);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0,-1);
    return w;
  }

  function enTok(t)  { return (t.toLowerCase().match(/[a-zA-Z']+/g) || []).filter(w => w.length > 1); }
  function arTok(t)  { return (arClean(t).match(/[\u0600-\u06FF]+/g) || []).filter(w => w.length > 1); }

  /* ── Index building (BM25 prereqs) ── */
  function buildIndex(pairs, useMorpho) {
    const N = pairs.length;
    const enLems = [], arRoots = [], enDF = {}, arDF = {};
    for (const p of pairs) {
      const el = enTok(p.en).map(w => useMorpho ? enLemma(w) : w.toLowerCase());
      const ar = arTok(p.ar).map(w => useMorpho ? arRoot(w) : arClean(w));
      enLems.push(el); arRoots.push(ar);
      for (const t of new Set(el)) enDF[t] = (enDF[t]||0)+1;
      for (const t of new Set(ar))  arDF[t] = (arDF[t]||0)+1;
    }
    const enAvgLen = enLems.reduce((a,b)=>a+b.length,0) / Math.max(N,1);
    const arAvgLen = arRoots.reduce((a,b)=>a+b.length,0) / Math.max(N,1);
    return { pairs, enLems, arRoots, enDF, arDF, enAvgLen, arAvgLen, N };
  }

  /* ── BM25 ── */
  const K1 = 1.5, B = 0.75;
  function bm25(qTerms, docTerms, df, N, avgLen) {
    const tf = {};
    for (const t of docTerms) tf[t] = (tf[t]||0)+1;
    let score = 0;
    const dl = docTerms.length;
    for (const qt of qTerms) {
      const f = tf[qt]||0;
      if (!f) continue;
      const idf = Math.log((N-(df[qt]||0)+0.5)/((df[qt]||0)+0.5)+1);
      const tfn  = (f*(K1+1))/(f+K1*(1-B+B*dl/avgLen));
      score += idf * tfn;
    }
    return score;
  }

  function proximityBonus(qTerms, docTerms) {
    if (qTerms.length < 2) return 0;
    const pos = {};
    docTerms.forEach((t,i) => { if (qTerms.includes(t)) (pos[t]=pos[t]||[]).push(i); });
    const covered = Object.keys(pos).length;
    if (covered < 2) return covered * 0.3;
    const iters = Object.fromEntries(Object.entries(pos).map(([k,v])=>[k,{arr:v,i:0}]));
    let best = Infinity;
    while (true) {
      const vals = Object.fromEntries(Object.entries(iters).map(([k,v])=>[k,v.arr[v.i]]));
      const mn = Math.min(...Object.values(vals)), mx = Math.max(...Object.values(vals));
      best = Math.min(best, mx-mn);
      const minKey = Object.keys(vals).reduce((a,b)=>vals[a]<vals[b]?a:b);
      iters[minKey].i++;
      if (iters[minKey].i >= iters[minKey].arr.length) break;
    }
    return Math.max(0, 4.0 - best*0.2);
  }

  function exactBonus(query, text, cleanFn) {
    const t = cleanFn ? cleanFn(text) : text.toLowerCase();
    const q = cleanFn ? cleanFn(query) : query.toLowerCase();
    if (!t.includes(q)) return 0;
    const count = t.split(q).length - 1;
    const pos = t.indexOf(q);
    return 12 + count*2 + Math.max(0, 1-pos/500);
  }

  /* ── Matching ── */
  function testMatch(pair, idx, qTermsEn, qTermsAr, qRaw, lang, mode, ix) {
    if (lang !== 'ar') {
      const t = pair.en.toLowerCase(), ql = qRaw.toLowerCase();
      if (mode === 'exact') return t.includes(ql);
      const doc = ix.enLems[idx];
      if (mode === 'or') return qTermsEn.some(l => doc.includes(l));
      return qTermsEn.every(l => doc.includes(l));
    }
    if (lang !== 'en') {
      const tc = arClean(pair.ar), qc = arClean(qRaw);
      if (mode === 'exact') return tc.includes(qc);
      const doc = ix.arRoots[idx];
      if (mode === 'or') return qTermsAr.some(r => doc.includes(r));
      return qTermsAr.every(r => doc.includes(r));
    }
    return testMatch(pair,idx,qTermsEn,qTermsAr,qRaw,'en',mode,ix) ||
           testMatch(pair,idx,qTermsEn,qTermsAr,qRaw,'ar',mode,ix);
  }

  /* ── Highlight ── */
  function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  function hlEn(text, q, excl, useMorpho, mode) {
    let out = esc(text);
    if (excl) out = out.replace(new RegExp('('+reEsc(excl)+')','gi'),'<mark class="x">$1</mark>');
    if (!q) return out;
    out = out.replace(new RegExp('('+reEsc(q)+')','gi'),'<mark>$1</mark>');
    if (useMorpho && mode !== 'exact') {
      for (const w of q.split(/\s+/).filter(Boolean)) {
        const l = enLemma(w);
        if (l !== w) out = out.replace(new RegExp('(?<![a-zA-Z])('+reEsc(l)+'[a-z]{0,5})(?![a-zA-Z])','gi'),
          m => m.startsWith('<') ? m : '<mark class="m">'+m+'</mark>');
      }
    }
    return out;
  }

  function hlAr(text, q, excl) {
    let out = esc(text);
    if (excl) out = out.replace(new RegExp('('+reEsc(excl)+')','g'),'<mark class="x">$1</mark>');
    if (!q) return out;
    out = out.replace(new RegExp('('+reEsc(arClean(q))+')','g'),'<mark>$1</mark>');
    return out;
  }

  /* ── File loading ── */
  async function loadFile(path) {
    if (fileCache[path] !== undefined) return fileCache[path];
    try {
      const r = await fetch(path);
      if (!r.ok) { fileCache[path] = null; return null; }
      fileCache[path] = await r.text();
      return fileCache[path];
    } catch { fileCache[path] = null; return null; }
  }

  async function loadPair(tm) {
    if (pairCache[tm.id]) return pairCache[tm.id];
    const [arRaw, enRaw] = await Promise.all([loadFile(tm.file_ar), loadFile(tm.file_en)]);
    if (!arRaw || !enRaw) { pairCache[tm.id] = []; return []; }
    const arLines = arRaw.split('\n').map(l=>l.trim()).filter(Boolean);
    const enLines = enRaw.split('\n').map(l=>l.trim()).filter(Boolean);
    const pairs = [];
    const len = Math.min(arLines.length, enLines.length);
    for (let i = 0; i < len; i++) {
      pairs.push({ ar: arLines[i], en: enLines[i],
                   textId: tm.id, title_ar: tm.title_ar, title_en: tm.title_en,
                   author_ar: tm.author_ar, author_en: tm.author_en });
    }
    pairCache[tm.id] = pairs;
    return pairs;
  }

  /* ── Catalogue ── */
  async function loadCatalogue() {
    if (catalogue) return catalogue;
    const r = await fetch('corpus/index.json');
    catalogue = await r.json();
    return catalogue;
  }

  function allTexts(cat) {
    const out = [];
    const src = cat || catalogue;
    if (!src) return out;
    for (const category of src.categories) {
      if (category.subcategories) {
        for (const sub of category.subcategories) out.push(...(sub.texts||[]));
      } else {
        out.push(...(category.texts||[]));
      }
    }
    return out;
  }

  /* ── Main search ── */
  async function search({ query, lang, mode, useMorpho, exclude, textIds }) {
    const cat  = await loadCatalogue();
    const texts = allTexts(cat).filter(t => !textIds || textIds.has(t.id));
    const results = [];
    const excl = (exclude||'').trim().toLowerCase();
    const q = (query||'').trim();

    const qTermsEn = enTok(q).map(w => useMorpho ? enLemma(w) : w.toLowerCase());
    const qTermsAr = arTok(q).map(w => useMorpho ? arRoot(w) : arClean(w));

    for (const tm of texts) {
      const pairs = await loadPair(tm);
      const ix = buildIndex(pairs, useMorpho);

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];

        if (excl) {
          const el = excl.toLowerCase();
          if (pair.en.toLowerCase().includes(el) || arClean(pair.ar).includes(arClean(excl))) continue;
        }

        if (q && !testMatch(pair, i, qTermsEn, qTermsAr, q, lang, mode, ix)) continue;

        let score = 0;
        if (q) {
          if (lang !== 'ar') {
            score += bm25(qTermsEn, ix.enLems[i], ix.enDF, ix.N, ix.enAvgLen);
            score += proximityBonus(qTermsEn, ix.enLems[i]);
            score += exactBonus(q, pair.en);
          }
          if (lang !== 'en') {
            score += bm25(qTermsAr, ix.arRoots[i], ix.arDF, ix.N, ix.arAvgLen);
            score += proximityBonus(qTermsAr, ix.arRoots[i]);
            score += exactBonus(q, pair.ar, arClean);
          }
        }

        results.push({
          ...pair, score,
          hlEn: hlEn(pair.en, q, excl, useMorpho, mode),
          hlAr: hlAr(pair.ar, q, excl)
        });
      }
    }

    if (q) results.sort((a,b) => b.score - a.score);
    return results;
  }

  /* ── Concordance (KWIC) ── */
  function makeConcordance(results, query, lang, win=8) {
    const lines = [];
    const fw = (query||'').split(/\s+/)[0] || '';
    for (const r of results) {
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
            pre:  tokens.slice(Math.max(0,i-win), i).join(' '),
            kw:   tokens[i],
            post: tokens.slice(i+1, i+1+win).join(' '),
            lang: l,
            title_ar: r.title_ar, title_en: r.title_en,
            author_ar: r.author_ar, author_en: r.author_en,
            score: r.score
          });
        }
      }
    }
    return lines;
  }

  /* ── Statistics ── */
  async function computeStats(textIds) {
    const cat = await loadCatalogue();
    const texts = allTexts(cat).filter(t => !textIds || textIds.has(t.id));
    let tokAr=0, tokEn=0, pairs=0;
    const typeAr=new Set(), typeEn=new Set();
    const freqAr={}, freqEn={};

    for (const tm of texts) {
      const ps = await loadPair(tm);
      pairs += ps.length;
      for (const p of ps) {
        const tAr = arTok(p.ar);
        const tEn = enTok(p.en);
        tokAr += tAr.length; tokEn += tEn.length;
        for (const tok of tAr) {
          const s = arRoot(tok);
          if (!AR_STOP.has(tok) && tok.length > 2) { typeAr.add(s); freqAr[s]=(freqAr[s]||0)+1; }
        }
        for (const tok of tEn) {
          const l = enLemma(tok);
          if (!EN_STOP.has(l) && l.length > 2) { typeEn.add(l); freqEn[l]=(freqEn[l]||0)+1; }
        }
      }
    }

    return {
      pairs, tokAr, tokEn,
      typeAr: typeAr.size, typeEn: typeEn.size,
      ttrAr: typeAr.size / Math.max(tokAr,1),
      ttrEn: typeEn.size / Math.max(tokEn,1),
      avgAr: (tokAr / Math.max(pairs,1)).toFixed(1),
      avgEn: (tokEn / Math.max(pairs,1)).toFixed(1),
      freqAr: sortFreq(freqAr),
      freqEn: sortFreq(freqEn)
    };
  }

  function sortFreq(obj) {
    return Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  }

  /* ── N-grams ── */
  async function nGrams(n, lang, textIds) {
    const cat = await loadCatalogue();
    const texts = allTexts(cat).filter(t => !textIds || textIds.has(t.id));
    const freq = {};
    for (const tm of texts) {
      const ps = await loadPair(tm);
      for (const p of ps) {
        const toks = lang === 'ar'
          ? arTok(p.ar).filter(t=>!AR_STOP.has(t)&&t.length>2).map(arRoot)
          : enTok(p.en).filter(t=>!EN_STOP.has(enLemma(t))&&t.length>2).map(enLemma);
        for (let i=0; i<=toks.length-n; i++) {
          const gram = toks.slice(i,i+n).join(' ');
          freq[gram] = (freq[gram]||0)+1;
        }
      }
    }
    return sortFreq(freq).filter(([,c])=>c>1);
  }

  /* ── PMI Collocations ── */
  async function collocations(lang, win=4, minFreq=3, textIds) {
    const cat = await loadCatalogue();
    const texts = allTexts(cat).filter(t => !textIds || textIds.has(t.id));
    const wc={}, pc={}; let total=0;

    for (const tm of texts) {
      const ps = await loadPair(tm);
      for (const p of ps) {
        const toks = lang === 'ar'
          ? arTok(p.ar).filter(t=>!AR_STOP.has(t)&&t.length>2).map(arRoot)
          : enTok(p.en).filter(t=>!EN_STOP.has(enLemma(t))&&t.length>2).map(enLemma);
        total += toks.length;
        for (const t of toks) wc[t]=(wc[t]||0)+1;
        for (let i=0;i<toks.length;i++) {
          for (let j=Math.max(0,i-win);j<Math.min(toks.length,i+win+1);j++) {
            if (i!==j) { const k=[toks[i],toks[j]].sort().join('|||'); pc[k]=(pc[k]||0)+1; }
          }
        }
      }
    }

    const res = [];
    for (const [k,cnt] of Object.entries(pc)) {
      if (cnt < minFreq) continue;
      const [w1,w2] = k.split('|||');
      if ((wc[w1]||0)<3||(wc[w2]||0)<3) continue;
      const pmi = Math.log2((cnt*total)/((wc[w1]||1)*(wc[w2]||1)));
      if (pmi > 1.5) res.push({w1,w2,count:cnt,pmi:+(pmi.toFixed(2))});
    }
    return res.sort((a,b)=>b.pmi-a.pmi).slice(0,60);
  }

  /* ── Export ── */
  function exportCSV(results) {
    const rows = [['#','Author (AR)','Author (EN)','Title (AR)','Title (EN)','Arabic','English']];
    results.forEach((r,i) => rows.push([
      i+1, r.author_ar||'', r.author_en||'',
      r.title_ar||'', r.title_en||'',
      (r.ar||'').replace(/"/g,'""'), (r.en||'').replace(/"/g,'""')
    ]));
    return rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  }

  function downloadCSV(content, filename) {
    const blob = new Blob(['\uFEFF'+content], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = filename; a.click();
  }

  return {
    loadCatalogue, allTexts, loadPair,
    search, makeConcordance,
    computeStats, nGrams, collocations,
    exportCSV, downloadCSV,
    esc, arClean, arRoot, enLemma
  };
})();
