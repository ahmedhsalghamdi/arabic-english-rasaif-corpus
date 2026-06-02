/* =========================================================
   Raṣāʾif Engine v2
   Reads CSV files directly from the GitHub repository root.
   Each CSV has two columns: English (col 0), Arabic (col 1).
   The column order is auto-detected by script.
   BM25 + proximity + exact bonus ranking.
   ========================================================= */

const RasaifEngine = (() => {

  const REPO   = 'ahmedhsalghamdi/arabic-english-rasaif-corpus';
  const BRANCH = 'main';

  let books = [];          // [{name, pairs, checked}]
  let bookIndices = [];    // built index per book

  /* ── English irregulars ── */
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
      if (w.endsWith(sc) && w.length - sc.length >= 3) { w = w.slice(0,-sc.length); break; }
    }
    if (w.length > 3) {
      for (const s of AR_SUF_S) {
        const sc = arClean(s);
        if (w.endsWith(sc) && w.length - sc.length >= 3) { w = w.slice(0,-sc.length); break; }
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
      return (s.length > 3 && s[s.length-1]===s[s.length-2]) ? s.slice(0,-1) : s;
    }
    if (w.endsWith('ed') && w.length > 4) {
      const s = w.slice(0,-2);
      return (s.length > 3 && s[s.length-1]===s[s.length-2]) ? s.slice(0,-1) : s;
    }
    if (w.endsWith('er') && w.length > 4) return w.slice(0,-2);
    if (w.endsWith('ly') && w.length > 4) return w.slice(0,-2);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0,-1);
    return w;
  }

  function enTok(t) { return (t.toLowerCase().match(/[a-zA-Z']+/g)||[]).filter(w=>w.length>1); }
  function arTok(t) { return (arClean(t).match(/[\u0600-\u06FF]+/g)||[]).filter(w=>w.length>1); }

  /* ── CSV parser ── */
  function splitCSV(line) {
    const res=[]; let cur='', q=false;
    for (let i=0; i<line.length; i++) {
      if (line[i]==='"') q=!q;
      else if (line[i]===',' && !q) { res.push(cur); cur=''; }
      else cur+=line[i];
    }
    res.push(cur);
    return res;
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    const pairs = [];
    for (const line of lines) {
      const cols = splitCSV(line);
      if (cols.length < 2) continue;
      const c0 = cols[0].replace(/^"|"$/g,'').trim();
      const c1 = cols[1].replace(/^"|"$/g,'').trim();
      if (!c0 || !c1) continue;
      // Auto-detect which column is Arabic
      const c0isAr = /[\u0600-\u06FF]/.test(c0);
      const en = c0isAr ? c1 : c0;
      const ar = c0isAr ? c0 : c1;
      if (en && ar) pairs.push({en, ar});
    }
    return pairs;
  }

  /* ── BM25 index ── */
  function buildIndex(bookObj, useMorpho) {
    const N = bookObj.pairs.length;
    const enLems=[], arRoots=[], enDF={}, arDF={};
    for (const p of bookObj.pairs) {
      const el = enTok(p.en).map(w => useMorpho ? enLemma(w) : w.toLowerCase());
      const ar = arTok(p.ar).map(w => useMorpho ? arRoot(w)  : arClean(w));
      enLems.push(el); arRoots.push(ar);
      for (const t of new Set(el)) enDF[t]=(enDF[t]||0)+1;
      for (const t of new Set(ar))  arDF[t]=(arDF[t]||0)+1;
    }
    const enAvgLen = enLems.reduce((a,b)=>a+b.length,0)/Math.max(N,1);
    const arAvgLen = arRoots.reduce((a,b)=>a+b.length,0)/Math.max(N,1);
    return {...bookObj, enLems, arRoots, enDF, arDF, enAvgLen, arAvgLen, N};
  }

  const K1=1.5, B=0.75;
  function bm25(qTerms, docTerms, df, N, avgLen) {
    const tf={};
    for (const t of docTerms) tf[t]=(tf[t]||0)+1;
    let score=0;
    const dl=docTerms.length;
    for (const qt of qTerms) {
      const f=tf[qt]||0; if(!f) continue;
      const idf=Math.log((N-(df[qt]||0)+0.5)/((df[qt]||0)+0.5)+1);
      const tfn=(f*(K1+1))/(f+K1*(1-B+B*dl/avgLen));
      score+=idf*tfn;
    }
    return score;
  }

  function proximityBonus(qTerms, docTerms) {
    if (qTerms.length<2) return 0;
    const pos={};
    docTerms.forEach((t,i)=>{ if(qTerms.includes(t))(pos[t]=pos[t]||[]).push(i); });
    const covered=Object.keys(pos).length;
    if (covered<2) return covered*0.3;
    const iters=Object.fromEntries(Object.entries(pos).map(([k,v])=>[k,{arr:v,i:0}]));
    let best=Infinity;
    while(true) {
      const vals=Object.fromEntries(Object.entries(iters).map(([k,v])=>[k,v.arr[v.i]]));
      const mn=Math.min(...Object.values(vals)), mx=Math.max(...Object.values(vals));
      best=Math.min(best,mx-mn);
      const minKey=Object.keys(vals).reduce((a,b)=>vals[a]<vals[b]?a:b);
      iters[minKey].i++;
      if(iters[minKey].i>=iters[minKey].arr.length) break;
    }
    return Math.max(0,4.0-best*0.2);
  }

  function exactBonus(query, text, cleanFn) {
    const t=cleanFn?cleanFn(text):text.toLowerCase();
    const q=cleanFn?cleanFn(query):query.toLowerCase();
    if(!t.includes(q)) return 0;
    return 12+(t.split(q).length-1)*2+Math.max(0,1-t.indexOf(q)/500);
  }

  /* ── Matching ── */
  function testMatch(pair, idx, qTermsEn, qTermsAr, qRaw, lang, mode, ix) {
    if (lang!=='ar') {
      const t=pair.en.toLowerCase(), ql=qRaw.toLowerCase();
      if (mode==='exact') return t.includes(ql);
      const doc=ix.enLems[idx];
      if (mode==='or') return qTermsEn.some(l=>doc.includes(l));
      return qTermsEn.every(l=>doc.includes(l));
    }
    if (lang!=='en') {
      const tc=arClean(pair.ar), qc=arClean(qRaw);
      if (mode==='exact') return tc.includes(qc);
      const doc=ix.arRoots[idx];
      if (mode==='or') return qTermsAr.some(r=>doc.includes(r));
      return qTermsAr.every(r=>doc.includes(r));
    }
    return testMatch(pair,idx,qTermsEn,qTermsAr,qRaw,'en',mode,ix) ||
           testMatch(pair,idx,qTermsEn,qTermsAr,qRaw,'ar',mode,ix);
  }

  /* ── Highlight ── */
  function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  function hlEn(text, q, excl, useMorpho, mode) {
    let out=esc(text);
    if (excl) out=out.replace(new RegExp('('+reEsc(excl)+')','gi'),'<mark class="x">$1</mark>');
    if (!q) return out;
    out=out.replace(new RegExp('('+reEsc(q)+')','gi'),'<mark>$1</mark>');
    if (useMorpho && mode!=='exact') {
      for (const w of q.split(/\s+/).filter(Boolean)) {
        const l=enLemma(w);
        if (l!==w) out=out.replace(new RegExp('(?<![a-zA-Z])('+reEsc(l)+'[a-z]{0,5})(?![a-zA-Z])','gi'),
          m=>m.startsWith('<')?m:'<mark class="m">'+m+'</mark>');
      }
    }
    return out;
  }

  function hlAr(text, q, excl) {
    let out=esc(text);
    if (excl) out=out.replace(new RegExp('('+reEsc(excl)+')','g'),'<mark class="x">$1</mark>');
    if (!q) return out;
    out=out.replace(new RegExp('('+reEsc(arClean(q))+')','g'),'<mark>$1</mark>');
    return out;
  }

  /* ── Data loading ── */
  async function loadBooks(onProgress) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/?ref=${BRANCH}`);
    const items = await r.json();
    if (!Array.isArray(items)) throw new Error('Could not read repository.');
    const csvs = items.filter(f => f.name.toLowerCase().endsWith('.csv'));
    if (!csvs.length) throw new Error('No CSV files found in repository root.');
    books = [];
    for (const f of csvs) {
      if (onProgress) onProgress(f.name);
      const pr = await fetch(f.download_url);
      const text = await pr.text();
      const pairs = parseCSV(text);
      books.push({ name: f.name.replace(/\.csv$/i,''), pairs, checked: true });
    }
    rebuild(true);
    return books;
  }

  function rebuild(useMorpho) {
    bookIndices = books.map(b => buildIndex(b, useMorpho));
  }

  /* ── Search ── */
  function search({ query, lang, mode, useMorpho, exclude }) {
    const q=(query||'').trim();
    const excl=(exclude||'').trim().toLowerCase();
    const active = books.map((b,i)=>({...b,bidx:i})).filter(b=>b.checked);
    const hits=[];
    let total=0;

    const qTermsEn = enTok(q).map(w=>useMorpho?enLemma(w):w.toLowerCase());
    const qTermsAr = arTok(q).map(w=>useMorpho?arRoot(w):arClean(w));

    for (const b of active) {
      const ix=bookIndices[b.bidx];
      for (let i=0; i<ix.pairs.length; i++) {
        total++;
        const pair=ix.pairs[i];
        if (excl && (pair.en.toLowerCase().includes(excl)||arClean(pair.ar).includes(arClean(excl)))) continue;
        if (q && !testMatch(pair,i,qTermsEn,qTermsAr,q,lang,mode,ix)) continue;
        let score=0;
        if (q) {
          if (lang!=='ar') { score+=bm25(qTermsEn,ix.enLems[i],ix.enDF,ix.N,ix.enAvgLen); score+=proximityBonus(qTermsEn,ix.enLems[i]); score+=exactBonus(q,pair.en); }
          if (lang!=='en') { score+=bm25(qTermsAr,ix.arRoots[i],ix.arDF,ix.N,ix.arAvgLen); score+=proximityBonus(qTermsAr,ix.arRoots[i]); score+=exactBonus(q,pair.ar,arClean); }
        }
        hits.push({ ...pair, src: b.name, score,
          hlEn: hlEn(pair.en,q,excl,useMorpho,mode),
          hlAr: hlAr(pair.ar,q,excl) });
      }
    }
    if (q) hits.sort((a,b)=>b.score-a.score);
    return { hits, total };
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

  /* ── Statistics ── */
  const EN_STOP=new Set('a an the and or but in on at to of for with by from as is was are were be been being have has had do does did will would could should may might must shall can this that these those it its i we you he she they them their our your his her my me us him all also just not no nor so if when where which who whom what how then than there here s t ve re ll d'.split(' '));
  const AR_STOP=new Set('في على من إلى عن مع أن ما لا هو هي هم هن نحن أنت أنتم كان كانت كانوا يكون تكون وقد قد لقد هذا هذه ذلك تلك الذي التي الذين وهو وهي وهم أو ثم لكن بل حتى إذا لما كما مما بما فما وما لأن بأن إن ولا فلا كل بعض له لها لهم لنا لكم بين عند عنه عنها منه منها به بها فيه فيها أي أيضا'.split(' '));

  function computeStats(booksArr, lang) {
    const allPairs=booksArr.flatMap(b=>b.pairs);
    const all=[];
    for (const p of allPairs) {
      const t=lang==='en'?(p.en.toLowerCase().match(/[a-zA-Z']+/g)||[]):(p.ar.replace(/[\u064B-\u065F\u0670\u0640]/g,'').match(/[\u0600-\u06FF]+/g)||[]);
      all.push(...t);
    }
    return {
      total: all.length,
      unique: new Set(all).size,
      sentences: allPairs.length,
      avg: (all.length/Math.max(allPairs.length,1)).toFixed(1),
      ttr: (new Set(all).size/Math.max(all.length,1)*100).toFixed(1)
    };
  }

  function countFreq(booksArr, lang) {
    const c={};
    for (const b of booksArr) {
      for (const p of b.pairs) {
        const toks=lang==='en'
          ?enTok(p.en).map(enLemma).filter(w=>w.length>2&&!EN_STOP.has(w))
          :arTok(p.ar).map(arRoot).filter(w=>w.length>2&&!AR_STOP.has(w));
        for (const t of toks) c[t]=(c[t]||0)+1;
      }
    }
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,80);
  }

  function countNgrams(booksArr, lang, n) {
    const c={};
    for (const b of booksArr) {
      for (const p of b.pairs) {
        const toks=lang==='en'
          ?enTok(p.en).filter(w=>!EN_STOP.has(enLemma(w))&&w.length>2)
          :arTok(p.ar).filter(w=>!AR_STOP.has(w)&&w.length>2);
        for (let i=0;i<=toks.length-n;i++) { const g=toks.slice(i,i+n).join(' '); c[g]=(c[g]||0)+1; }
      }
    }
    return Object.entries(c).filter(([,v])=>v>1).sort((a,b)=>b[1]-a[1]).slice(0,50);
  }

  function countColls(booksArr, lang, win=4) {
    const wc={},pc={};let total=0;
    for (const b of booksArr) {
      for (const p of b.pairs) {
        const toks=lang==='en'
          ?enTok(p.en).map(enLemma).filter(w=>w.length>2&&!EN_STOP.has(w))
          :arTok(p.ar).map(arRoot).filter(w=>w.length>2&&!AR_STOP.has(w));
        total+=toks.length;
        for (const t of toks) wc[t]=(wc[t]||0)+1;
        for (let i=0;i<toks.length;i++) {
          for (let j=Math.max(0,i-win);j<Math.min(toks.length,i+win+1);j++) {
            if (i!==j) { const k=[toks[i],toks[j]].sort().join('|||'); pc[k]=(pc[k]||0)+1; }
          }
        }
      }
    }
    const res=[];
    for (const [k,cnt] of Object.entries(pc)) {
      if (cnt<3) continue;
      const [w1,w2]=k.split('|||');
      if((wc[w1]||0)<3||(wc[w2]||0)<3) continue;
      const pmi=Math.log2((cnt*total)/((wc[w1]||1)*(wc[w2]||1)));
      if (pmi>1.5) res.push({w1,w2,count:cnt,pmi:+(pmi.toFixed(2))});
    }
    return res.sort((a,b)=>b.pmi-a.pmi).slice(0,60);
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
    computeStats, countFreq, countNgrams, countColls,
    exportCSV, downloadCSV,
    esc, arClean, arRoot, enLemma
  };
})();
