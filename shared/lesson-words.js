(() => {
  'use strict';

  function wordLocation(need, ui) {
    if (!need) return '';
    const title = [need.module, need.title, need.page ? 'p' + need.page : ''].filter(Boolean).join(' ');
    return need.entry ? ui.link(need.entry, title) : ui.escape(title);
  }

  function positionText(word) {
    const entries = word.forms.map(f => f.exercise);
    return entries.length === 1 ? '第 ' + entries[0] + ' 题' : '第 ' + entries.join('、') + ' 题';
  }

  function wordButton(word, ui, practice) {
    return ui.link((practice ? 'practice:' : 'word:') + word.id, word.term);
  }

  function progressButton(label, key, checked, ui) {
    return '<button type="button" class="entry-link progress-button" data-progress="'+ui.escape(key)+
      '" aria-pressed="'+checked+'">'+label+'</button>';
  }

  function wordRows(words, ui, mode) {
    const review = mode === 'review';
    const practice = mode === 'practice';
    const limit = 7;
    const pageCount = Math.max(1, Math.ceil(words.length / limit));
    const page = Math.min(pageCount, ui.listPage);
    const e = ui.escape;
    const rows = words.slice((page - 1) * limit, page * limit).map(word => {
      const lesson = '第 ' + word.lesson + ' 节';
      const taught = word.need ? wordLocation(word.need, ui) : 'WORDLIST 补学';
      const learned = ui.done('learn:' + word.id);
      const used = word.forms.filter(form => ui.done('use:' + form.id)).length;
      const note = review ? lesson + '，' + (learned ? '已学' : '待学') + '，' +
        (used === word.forms.length ? '已练' : '待练') : lesson + '，短练' + positionText(word);
      return '<li class="word-row" data-word-id="'+e(word.id)+'">'+wordButton(word, ui, practice)+
        '<span class="word-subtle">'+taught+'</span><small class="practice-position">'+e(note)+'</small></li>';
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
    const review = part === 'review' || part === 'check';
    if (review) {
      const learned = full.filter(w => ui.done('learn:' + w.id)).length;
      const practiced = full.filter(w => w.forms.every(f => ui.done('use:' + f.id))).length;
      return '<section class="word-intro"><p>第二节结束前用本分册的 WORDLIST 逐词核对。完成后打开词条标记。固定听写使用同一份 WORDLIST。</p>'+
        '<div class="word-coverage"><span><strong>'+learned+' / '+full.length+'</strong> 已学</span>'+
        '<span><strong>'+practiced+' / '+full.length+'</strong> 已练</span></div></section>'+
        wordRows(full, ui, 'review');
    }
    if (part === 'unit') {
      return '<section class="word-intro"><p>本分册本单元有 '+c.counts.wordCount+' 个词条，WORDLIST 原书 '+c.counts.printedCount+
        ' 条记录。第 1 节 '+c.counts.first+' 个，第 2 节 '+c.counts.second+' 个。</p>'+
        '<p>点词条看分课、原书位置和逐词运用。学练课次按校内顺序。</p></section>'+wordRows(full,ui,'all');
    }
    const lessons = full.filter(w => w.lesson === entry.lesson);
    const revisits = entry.lesson === 2 ? full.filter(w => w.revisit) : [];
    const heading = part === 'practice'
      ? '每个目标词都有短练习。原题已让学生实际作答的词，可以按原题记录完成情况。'
      : '本节任务开始前先认词、学词义和用法。随后用短练习或原题逐个练习。';
    return '<section class="word-intro"><p>'+heading+'</p><div class="word-coverage"><span><strong>'+lessons.length+
      '</strong> 个词首次学练</span>'+(revisits.length ? '<span>'+revisits.length+' 个词随第二节任务再次出现</span>' : '')+
      '</div>'+((part==='lesson1'||part==='lesson2')?ui.link(entry.id+':cards','词卡和用法')+ui.link(entry.id+':practice','逐词运用练习'):'')+
      '</section>'+wordRows(lessons,ui,part)+(revisits.length?
        '<details class="method-box"><summary>第二节随任务复现的词</summary><div class="child-links">'+
        revisits.map(w=>'<div>'+wordButton(w,ui,false)+' '+wordLocation(w.revisit,ui)+'</div>').join('')+'</div></details>':'');
  }

  function exercisePrompt(form, ui) {
    const wordForm = ui.escape(form.form);
    const use = ui.course.track === 'LS' ? '说一句' : '写一句';
    const phrase = form.pos ? '，按所列词性使用' : '';
    return '用 <strong lang="en">'+wordForm+'</strong> '+use+'与本单元主题相关的话'+phrase+'。';
  }

  function wordView(word, ui, practiceOnly) {
    const e = ui.escape;
    const mode = 'study::lesson' + word.lesson;
    const forms = word.forms.map(f=>e(f.form)+(f.pos?' '+e(f.pos):'')).join('，');
    const definitions = ui.local.definitions?.[word.id] || {};
    const meaning = word.forms.map(f=>[f.pos, definitions[f.id]]).filter(([,m])=>m);
    const outcome = '<div class="word-detail-head"><strong lang="en">'+forms+'</strong><p>第 '+word.lesson+
      ' 节课开头学练，固定听写收录。</p>'+ui.link(mode,'第 '+word.lesson+' 节词汇学练')+'</div>';
    const reference = '<section class="word-reference"><h2>教材位置</h2><p>'+ui.page(word.forms[0].page,'WORDLIST')+'</p>'+
      (word.need?'<p>本单元使用位置 '+wordLocation(word.need,ui)+'</p>':'<p>在第 2 节开头用 WORDLIST 补学。</p>')+
      (word.revisit?'<p>第 2 节复现位置 '+wordLocation(word.revisit,ui)+'</p>':'')+
      (word.lookup.length?'<p>音标、词性和释义查阅 '+word.lookup.map(x=>ui.page(x,'书末 GLOSSARY')).join(' ')+'</p>':'')+
      '</section>';
    const input = practiceOnly?'':'<section><h2>词卡和用法</h2>'+
      (meaning.length?meaning.map(([pos,text])=>'<p>'+e([pos,text].filter(Boolean).join(' '))+'</p>').join(''):
        '<p>读准词形，在上面的原书位置核对本单元用法。</p>')+
      '<p>结合教材里的图片或句子理解词义。可以口头解释这个词在该处的用法。</p>'+
      progressButton(ui.done('learn:'+word.id)?'已学':'标为已学','learn:'+word.id,ui.done('learn:'+word.id),ui)+'</section>';
    const practice = '<section><h2>逐词运用</h2>'+
      word.forms.map(f=>'<div class="word-practice" data-form-id="'+e(f.id)+'"><h2>自研短练习第 '+f.exercise+' 题</h2>'+
        '<p>'+exercisePrompt(f,ui)+'</p>'+(definitions[f.id]?'<details class="word-selfcheck"><summary>核对本单元词义</summary><p>'+
        e(definitions[f.id])+'</p></details>':'')+
        progressButton(ui.done('use:'+f.id)?'已练':'标为已练','use:'+f.id,ui.done('use:'+f.id),ui)+'</div>').join('')+
      '<p class="word-subtle">如果已经在原题中实际匹配、填写、说出或写出该词，可按原题标记已练。</p></section>';
    return outcome+input+practice+reference;
  }

  function glossary(entry, ui) {
    const data = ui.course.glossaries[entry.id];
    const defs = ui.local.glossaries?.[entry.id] || {};
    const wordIds = new Set(ui.course.wordPlan.map(w=>w.id));
    const terms = data.words.map(word => {
      const meaning = defs[word.id] || word.caption;
      const shared = wordIds.has(word.word) ? ui.link('word:'+word.word,'本单元词卡') : '';
      return '<div><dt lang="en">'+ui.escape(word.term+(word.pos?' '+word.pos:''))+shared+'</dt>'+
        (meaning?'<dd>'+ui.escape(meaning)+'</dd>':'')+'</div>';
    }).join('');
    return '<section><h2>先理解这些词</h2><p>进入下面的教材活动前，查看本组词义。遇到原题要求使用的词，直接随题练。</p>'+
      '<dl class="glossary-terms">'+terms+'</dl><div class="flow-book-lookup">'+ui.page(data.page,'教材 GLOSSARY')+
      '</div><h2>使用本组词汇的活动</h2>'+[data.target,...data.related].map(id=>ui.link(id)).join('')+'</section>';
  }

  window.UnlockLessonWords = {study, wordView, glossary};
})();
