/* =========================================================
   Raṣāʾif — Bilingual UI Strings
   Arabic: classical register, Jahizian spirit
   ========================================================= */

const UI = {
  en: {
    site_name:        'Raṣāʾif',
    site_subtitle:    'Arabic–English Parallel Corpus of Classical Texts',
    nav_search:       'Search',
    nav_analysis:     'Analysis',
    nav_about:        'About',
    nav_cite:         'Cite',
    nav_lataif:       'Lāṭāʾif al-Raṣāʾif',
    nav_aranjiyya:    'al-ʿAranijiyya',
    toggle_lang:      'العربية',

    texts_heading:    'Texts',
    select_all:       'Select all',
    clear_all:        'Clear all',

    search_placeholder: 'Search in English or Arabic…',
    lang_label:       'Language',
    lang_both:        'Both languages',
    lang_ar:          'Arabic only',
    lang_en:          'English only',
    output_label:     'Results',
    output_parallel:  'Parallel table',
    output_kwic:      'Concordance',
    match_label:      'Match',
    match_order:      'Any order',
    match_phrase:     'Exact phrase',
    match_any:        'Any word',
    match_morph:      'Morphology',
    morph_hint:       'كاتب/كتبت/مكتوب = كتب · ran/shown = run/show',
    exclude_label:    'Exclude',
    excl_placeholder: 'word or phrase…',

    ready_msg:        'Ready.',
    loading:          'Loading…',
    search_prompt:    'Type a word or phrase to search the corpus.',
    no_results:       'No results found.',
    no_results_hint:  'Try "Any order" or enable Morphology.',
    no_texts:         'No texts selected.',
    ranked:           'ranked by relevance',
    col_source:       'Source',
    col_en:           'English',
    col_ar:           'Arabic',
    align_tip:        'Parallel pair',

    stat_pairs:       'Sentence Pairs',
    texts_heading:    'Texts',

    about_heading:    'About the Corpus',
    cite_heading:     'How to Cite',
    nav_analysis:     'Analysis',
    nav_about:        'About',
    nav_cite:         'Cite',
  },

  ar: {
    site_name:        'الرَّصائف',
    site_subtitle:    'خزانةُ تراجمِ الإنجليز لكتب العرب',
    nav_search:       'التفتيش',
    nav_analysis:     'وجوهُ الإحصاء',
    nav_about:        'خبرُ الرصائف',
    nav_cite:         'الاستشهادُ والعزو',
    nav_lataif:       'لطائف الرصائف',
    nav_aranjiyya:    'العَرَنجِيَّة',
    toggle_lang:      'English',

    texts_heading:    'الكُتُب',
    select_all:       'انتقاءُ الجميع',
    clear_all:        'ردُّ الاختيار',

    search_placeholder: 'فتِّش في العربية أو الإنجليزية…',
    lang_label:       'اللغة',
    lang_both:        'اللغتان',
    lang_ar:          'العربيّة',
    lang_en:          'الإنجليزيّة',
    output_label:     'الحاصل',
    output_parallel:  'الرصائف',
    output_kwic:      'اللفظُ في سياقه',
    match_label:      'المطابقة',
    match_order:      'الألفاظُ بأيّ ترتيب',
    match_phrase:     'العبارةُ بحروفها',
    match_any:        'أيُّ لفظٍ',
    match_morph:      'التفتيشُ بالاشتقاق',
    morph_hint:       'كاتبٌ وكتبتُ ومكتوبٌ كلُّها من كتب · ran وshown أصلُهما run وshow',
    exclude_label:    'استثنِ',
    excl_placeholder: 'لفظٌ تريد إقصاءه…',

    ready_msg:        'الخزانةُ حاضرة، فسَل تُجَب.',
    loading:          'أمهلنا…',
    search_prompt:    'ضَع في المربَّع ما تبتغي من لفظٍ أو عبارة.',
    no_results:       'لم يُسعفنا البحثُ بطائل.',
    no_results_hint:  'جرِّب «الألفاظُ بأيّ ترتيب» أو التفتيشَ بالاشتقاق.',
    no_texts:         'لم يُنتقَ كتابٌ بعد.',
    ranked:           'مرتَّبةٌ على قدر الأَولى بالتقديم',
    col_source:       'الأصل',
    col_en:           'الإنجليزيّة',
    col_ar:           'العربيّة',
    align_tip:        'زوجٌ متقابل',

    stat_pairs:       'أزواجُ الجمل',
    texts_heading:    'الكُتُب',

    about_heading:    'خبرُ الرصائف',
    cite_heading:     'الاستشهادُ بالخزانة والعزوُ إليها',
  }
};

let LANG = localStorage.getItem('rasaif_lang') || 'en';

function t(key, ...args) {
  const val = (UI[LANG] && UI[LANG][key]) || (UI['en'] && UI['en'][key]);
  if (typeof val === 'function') return val(...args);
  return val !== undefined ? val : key;
}

function setLang(l) {
  LANG = l;
  localStorage.setItem('rasaif_lang', l);
  document.documentElement.lang = l === 'ar' ? 'ar' : 'en';
  document.documentElement.dir  = l === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', l === 'ar');
}
