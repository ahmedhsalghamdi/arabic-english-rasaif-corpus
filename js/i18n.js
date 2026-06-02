/* =========================================================
   Rasaif — Bilingual UI Strings
   Classical Arabic (attested idiom) ↔ English
   ========================================================= */

const UI = {
  en: {
    site_name:      'Raṣāʾif',
    site_subtitle:  'Arabic–English Parallel Corpus',
    nav_search:     'Search',
    nav_analysis:   'Analysis',
    nav_about:      'About',
    nav_cite:       'Cite',

    /* search page */
    texts_heading:  'Texts',
    select_all:     'Select all',
    clear_all:      'Clear all',
    lang_both:      'Both languages',
    lang_ar:        'Arabic only',
    lang_en:        'English only',
    output_parallel:'Parallel table',
    output_kwic:    'Concordance (KWIC)',
    match_order:    'All words (any order)',
    match_phrase:   'Exact phrase',
    match_any:      'Any word',
    match_morph:    'Morphology',
    morph_hint:     'كاتب/كتبت = كتب · ran/shown = run/show',
    exclude_label:  'Exclude',
    search_btn:     'Search',
    export_btn:     'Export CSV',
    results_found:  n => `${n} result${n===1?'':'s'}`,
    no_results:     'No results found.',
    loading:        'Loading…',

    /* analysis page */
    text_selector:  'Text',
    all_texts:      'All texts (combined)',
    lang_selector:  'Language',
    stats_heading:  'Corpus Statistics',
    freq_heading:   'Word Frequency',
    ngram_heading:  'Frequent Phrases',
    colloc_heading: 'Collocations',
    bigrams:        'Bigrams (2 words)',
    trigrams:       'Trigrams (3 words)',
    pmi_note:       'Ranked by PMI (pointwise mutual information)',
    stopwords_note: 'Stopwords removed · Arabic shows approximate stems · English shows lemmas',
    stat_tokens:    'Tokens',
    stat_types:     'Types',
    stat_ttr:       'TTR',
    stat_sentences: 'Sentence pairs',

    /* about / cite */
    about_heading:  'About the Corpus',
    cite_heading:   'How to Cite',
    provenance:     'Source & Provenance',
    alignment:      'Alignment',
    license:        'License',

    /* categories */
    cat_scholarly:  'Scholarly Works',
    cat_literary:   'Literary Works',
    sub_jurisprudence: 'Jurisprudence & Legal Theory',
    sub_medicine:   'Medicine & Natural Sciences',
    sub_biographies:'Biographies & Ṭabaqāt',
    sub_general:    'General Scholarship',
    sub_prose:      'Artistic Prose',
    sub_maqamat:    'Maqāmāt',

    /* meta */
    author_label:   'Author',
    date_label:     'Date',
    source_label:   'Source',
    words_label:    'Words',
    toggle_lang:    'العربية',
  },

  ar: {
    site_name:      'الرصائف',
    site_subtitle:  'ذخيرة النصوص العربية الإنجليزية المقابلة',
    nav_search:     'الاستقراء',
    nav_analysis:   'التحليل',
    nav_about:      'في الذخيرة',
    nav_cite:       'الاستشهاد',

    /* search page */
    texts_heading:  'النصوص',
    select_all:     'انتقاء الجميع',
    clear_all:      'إسقاط الانتقاء',
    lang_both:      'اللغتان معاً',
    lang_ar:        'العربية وحدها',
    lang_en:        'الإنجليزية وحدها',
    output_parallel:'الجدول المقابل',
    output_kwic:    'السياق اللغوي',
    match_order:    'جميع الألفاظ بأي ترتيب',
    match_phrase:   'الجملة بعينها',
    match_any:      'أيّ لفظ من الألفاظ',
    match_morph:    'الاشتقاق والتصريف',
    morph_hint:     'كاتب وكتبت ومكتوب أصلها كتب',
    exclude_label:  'الاستثناء',
    search_btn:     'استقرِ',
    export_btn:     'تصدير CSV',
    results_found:  n => `${n} نتيجة`,
    no_results:     'لم يُعثر على نتيجة.',
    loading:        'جارٍ التحميل…',

    /* analysis page */
    text_selector:  'النص',
    all_texts:      'جميع النصوص مجتمعةً',
    lang_selector:  'اللغة',
    stats_heading:  'إحصاء الذخيرة',
    freq_heading:   'تواتر الألفاظ',
    ngram_heading:  'العبارات الشائعة',
    colloc_heading: 'الملازمات اللفظية',
    bigrams:        'المزدوجات',
    trigrams:       'المثلثات',
    pmi_note:       'مرتّبةٌ وَفق معيار التلازم النقطي PMI',
    stopwords_note: 'أُسقطت حروف المعاني · العربية على الجذور التقريبية · الإنجليزية على المصادر',
    stat_tokens:    'الرموز',
    stat_types:     'الأنماط',
    stat_ttr:       'نسبة التنوع',
    stat_sentences: 'أزواج الجمل',

    /* about / cite */
    about_heading:  'في الذخيرة',
    cite_heading:   'الاستشهاد بالذخيرة',
    provenance:     'المصادر والمراجع',
    alignment:      'التوازي والمقابلة',
    license:        'الرخصة',

    /* categories */
    cat_scholarly:  'الرصائف العلمية',
    cat_literary:   'الرصائف الأدبية',
    sub_jurisprudence: 'الفقه والأصول',
    sub_medicine:   'الطب والعلوم الطبيعية',
    sub_biographies:'التراجم والطبقات',
    sub_general:    'العلوم العامة',
    sub_prose:      'النثر الفني',
    sub_maqamat:    'المقامات',

    /* meta */
    author_label:   'المؤلف',
    date_label:     'التاريخ',
    source_label:   'المصدر',
    words_label:    'الألفاظ',
    toggle_lang:    'English',
  }
};

/* Active language — default English */
let LANG = localStorage.getItem('rasaif_lang') || 'en';

function t(key, ...args) {
  const val = UI[LANG][key];
  return typeof val === 'function' ? val(...args) : (val || key);
}

function setLang(l) {
  LANG = l;
  localStorage.setItem('rasaif_lang', l);
  document.documentElement.lang = l === 'ar' ? 'ar' : 'en';
  document.documentElement.dir  = l === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', l === 'ar');
}
