(() => {
  'use strict';

  function wordLocation(need, ui) {
    if (!need) return '';
    const title = [need.module, need.title, need.page ? 'p' + need.page : ''].filter(Boolean).join(' ');
    const text = need.entry ? ui.link(need.entry, title) : ui.escape(title);
    return text + (need.scriptPage && need.scriptPage !== need.page
      ? ' ' + ui.page(need.scriptPage, '脚本') : '');
  }

  function practiced(word, ui) {
    return word.forms.every(form => ui.done('use:' + form.id));
  }

  function learned(word, ui) {
    return ui.done('learn:' + word.id);
  }

  function practiceNumbers(word) {
    return '短练第 ' + word.forms.map(form => form.exercise).join('、') + ' 题';
  }

  function wordButton(word, ui, practice) {
    return ui.link((practice ? 'practice:' : 'word:') + word.id, word.term);
  }

  function progressButton(label, key, checked, ui) {
    return '<button type="button" class="entry-link progress-button" data-progress="'+ui.escape(key)+
      '" aria-pressed="'+checked+'">'+label+'</button>';
  }

  function counts(words, ui) {
    const l = words.filter(word => learned(word, ui)).length;
    const p = words.filter(word => practiced(word, ui)).length;
    return '<div class="word-coverage"><span><strong>'+l+' / '+words.length+'</strong> 已学</span>'+
      '<span><strong>'+p+' / '+words.length+'</strong> 已练</span></div>';
  }

  function wordRows(words, ui, mode) {
    const reviewing = mode === 'review' || mode === 'ready';
    const practicing = mode === 'practice';
    const limit = 7;
    const pageCount = Math.max(1, Math.ceil(words.length / limit));
    const page = Math.min(pageCount, ui.listPage);
    const e = ui.escape;
    const rows = words.slice((page - 1) * limit, page * limit).map(word => {
      const chapter = '第 '+word.lesson+' 节';
      const placement = word.need ? wordLocation(word.need, ui) : '第一节课首补学';
      const route = word.practice ? '随原题练' : practiceNumbers(word);
      const note = reviewing
        ? chapter+'，'+(learned(word,ui)?'已学':'待学')+'，'+(practiced(word,ui)?'已练':'待练')
        : chapter+'，'+route;
      return '<li class="word-row" data-word-id="'+e(word.id)+'">'+wordButton(word,ui,practicing)+
        '<span class="word-subtle">'+(practicing&&word.practice?wordLocation(word.practice,ui):placement)+'</span>'+
        '<small class="practice-position">'+e(note)+'</small></li>';
    }).join('');
    const buttons = pageCount > 1 ? '<div class="word-controls"><span aria-live="polite">第 '+page+' 页，共 '+pageCount+
      ' 页</span><div><button type="button" data-list-page="'+(page-1)+'"'+(page===1?' disabled':'')+'>上一页</button>'+
      '<button type="button" data-list-page="'+(page+1)+'"'+(page===pageCount?' disabled':'')+'>下一页</button></div></div>' : '';
    return buttons+'<ol class="word-rows">'+rows+'</ol>';
  }

  function study(entry, ui) {
    const c = ui.course;
    const full = c.wordPlan;
    const part = entry.study;
    const words = full.filter(w => w.lesson === entry.lesson);
    const stage = 'study::lesson' + entry.lesson;
    const overview = part === 'lesson1' || part === 'lesson2';
    if (['review','check','review1','check1'].includes(part)) {
      const wholeUnit = part === 'review' || part === 'check';
      const checked = wholeUnit ? full : words;
      const pending = checked.filter(word=>!learned(word,ui)||!practiced(word,ui));
      const close = wholeUnit ? '第二节课末核对整个单元。固定听写沿用本分册的 WORDLIST。' :
        '第一节课末核对本节新词。打开待补的词，补完后再标记。';
      return '<section class="word-intro"><p>'+close+'</p>'+counts(checked,ui)+'</section>'+
        (pending.length?wordRows(pending,ui,'review'):'<p>本次核对的词都已学练。</p>');
    }
    if (part === 'unit') {
      return '<section class="word-intro"><p>本分册本单元有 '+c.counts.wordCount+
        ' 个词条，WORDLIST 原书 '+c.counts.printedCount+' 条记录。第 1 节 '+c.counts.first+
        ' 个，第 2 节 '+c.counts.second+' 个。</p><p>点词条看课次、教材位置和练习安排。</p></section>'+wordRows(full,ui,'all');
    }
    if (part === 'ready') {
      const outstanding = words.filter(w => !learned(w,ui));
      return '<section class="word-intro"><p>先核对本节新词是否都学过，再进入教材任务。随原题练的词在对应题目完成后标记。</p>'+
        counts(words,ui)+ui.link(stage+':cards','补学本节词汇')+ui.link(stage+':practice','查看练习安排')+'</section>'+
        (outstanding.length?wordRows(outstanding,ui,'ready'):'<p>本节新词已核对。</p>');
    }
    const revisits = entry.lesson===2 ? full.filter(w => w.revisit) : [];
    const instruction = part === 'practice'
      ? '表里有原题位置的词随当堂原题练。其余词在课首完成逐词短练。'
      : '先认词形、了解课内用法，再进入教材任务。';
    const links = overview ? ui.link(stage+':cards','先学词形和课内用法')+
      ui.link(stage+':practice','逐词练习安排')+ui.link(stage+':ready','核对本节新词') : '';
    return '<section class="word-intro"><p>'+instruction+'</p>'+
      '<div class="word-coverage"><span><strong>'+words.length+'</strong> 个新词</span>'+
      (revisits.length?'<span>'+revisits.length+' 个已学词在第二节任务或材料中再现</span>':'')+'</div>'+
      links+'</section>'+wordRows(words,ui,part)+(revisits.length?
        '<details class="method-box"><summary>第二节随任务复现的词</summary><div class="child-links">'+
        revisits.map(w=>'<div>'+wordButton(w,ui,false)+' '+wordLocation(w.revisit,ui)+'</div>').join('')+'</div></details>':'');
  }

  function exercisePrompt(form, ui) {
    const target = '<strong lang="en">'+ui.escape(form.form)+'</strong>';
    const response = ui.course.track==='LS'?'说出一个完整的英语句子。':'写出一个完整的英语句子。';
    const pos = form.studyPos;
    const categories = ['n','v','adj','adv'].filter(type => new RegExp('\\b'+type+'\\b').test(pos));
    if (categories.length > 1 && !/\bphr\b/.test(pos)) {
      return '结合本单元主题，用 '+target+' 按所列的每种用法各'+(ui.course.track==='LS'?'说':'写')+'一个完整句子。';
    }
    return '结合本单元的场景，正确使用 '+target+'，'+response;
  }

  function wordView(word, ui, practiceOnly) {
    const escape = ui.escape;
    const mode = 'study::lesson'+word.lesson;
    const styledForms = word.forms.map(f=>escape(f.form)+(f.studyPos?' '+escape(f.studyPos):'')).join('，');
    const lookup = ui.local.definitions?.[word.id] || [];
    const evidence = ui.local.wordEvidence?.[word.id] || {};
    const assigned = '第 '+word.lesson+' 节课开头学。';
    const reference = '<section class="word-reference"><h2>教材位置</h2><p>'+
      ui.page(word.forms[0].page,'WORDLIST')+'</p>'+
      word.forms.filter(f=>f.pos!==f.studyPos).map(f=>'<p>WORDLIST 原印'+
        (f.pos?'词性 '+escape(f.pos):'未标词性')+'。课堂用法 '+escape(f.studyPos)+'。</p>').join('')+
      (word.need?'<p>用词位置 '+wordLocation(word.need,ui)+'</p>':'<p>本词列入第一节课首补学。</p>')+
      (word.revisit?'<p>第 2 节复现位置 '+wordLocation(word.revisit,ui)+'</p>':'')+
      (word.lookup.length?'<p>音标、书末词性和释义 '+word.lookup.map(p=>ui.page(p,'书末 GLOSSARY')).join(' ')+'</p>':'')+
      (lookup.length?'<details class="word-selfcheck"><summary>查看书末 GLOSSARY 原印释义</summary>'+
        lookup.map(d=>'<p>'+escape([d.pos,d.definition].filter(Boolean).join(' '))+'</p>').join('')+'</details>':'')+
      '</section>';
    const lessonMeaning = word.teachingMeaning ? '<p>'+escape(word.teachingMeaning)+'</p>' :
      (evidence.unitDefinitions || []).map(d=>'<p>'+ui.page(d.page,'单元原页')+' '+escape(d.definition)+'</p>').join('');
    const input = practiceOnly?'':'<section><h2>本单元用法</h2>'+
      lessonMeaning+
      (evidence.context?'<p class="word-evidence" lang="en">'+escape(evidence.context)+'</p>':'')+
      (word.need?'<p>结合 '+wordLocation(word.need,ui)+' 理解这个词在该处的用法。</p>':
        '<p>参照本单元 WORDLIST，结合释义和单元主题学习。</p>')+
      progressButton(learned(word,ui)?'已学':'标为已学','learn:'+word.id,learned(word,ui),ui)+'</section>';
    const practice = '<section><h2>练习安排</h2>'+
      word.forms.map(f=>{
        const required = word.practice ? '<p>随原题完成 '+wordLocation(word.practice,ui)+'</p>'+
          '<details><summary>查看备用短练第 '+f.exercise+' 题</summary><p>'+exercisePrompt(f,ui)+'</p></details>' :
          '<h3>课首短练第 '+f.exercise+' 题</h3><p>'+exercisePrompt(f,ui)+'</p>';
        const checked=ui.done('use:'+f.id);
        return '<div class="word-practice" data-form-id="'+escape(f.id)+'">'+required+
          progressButton(checked?'已练':'标为已练','use:'+f.id,checked,ui)+'</div>';
      }).join('')+'</section>';
    return '<div class="word-detail-head"><strong lang="en">'+styledForms+'</strong><p>'+assigned+
      '固定听写收录。</p>'+ui.link(mode,'第 '+word.lesson+' 节词汇学练')+'</div>'+
      input+practice+reference;
  }

  function glossary(entry, ui) {
    const data = ui.course.glossaries[entry.id];
    const defs = ui.local.glossaries?.[entry.id] || {};
    const wordIds = new Set(ui.course.wordPlan.map(w => w.id));
    const terms = data.words.map(word => {
      const meaning = word.caption || defs[word.id];
      const shared = wordIds.has(word.word) ? ui.link('word:'+word.word,'本单元词卡') : '';
      const source = word.studyPos!==word.pos ? '<small>教材原印 '+ui.escape(word.pos)+'</small>' : '';
      return '<div><dt lang="en">'+ui.escape(word.term+(word.studyPos?' '+word.studyPos:''))+shared+'</dt>'+
        (meaning?'<dd>'+ui.escape(meaning)+'</dd>':'')+source+'</div>';
    }).join('');
    return '<section><h2>先理解这些词</h2><p>做下面的教材活动前查词义。原题要求使用的词，随原题练。</p>'+
      '<dl class="glossary-terms">'+terms+'</dl><div class="flow-book-lookup">'+ui.page(data.page,'教材 GLOSSARY')+
      '</div><h2>使用本组词汇的活动</h2>'+[data.target,...data.related].map(id=>ui.link(id)).join('')+'</section>';
  }

  window.UnlockLessonWords = {study, wordView, glossary};
})();
