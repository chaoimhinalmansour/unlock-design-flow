(() => {
  'use strict';

  const book = window.UNLOCK_DESIGN;
  const originals = window.UNLOCK_ORIGINALS || {};
  const lessonWords = window.UnlockLessonWords;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[character]);
  const display = value => String(value ?? '').replace(/\*\*/g, '').replace(/[·•]/g,'，')
    .replace(/[;；]/g,'。').replace(/[—–]/g,' ').replace(/→/g,'至').replace(/[✓✔☑✗]/g,'');
  const author = text => esc(display(text));
  const pageLabel = page => 'p' + page;
  const pagesLabel = pages => pages.map(pageLabel).join('、');
  const url = new URL(location.href);
  const mode = url.searchParams.get('mode') === 'original' ? 'original' : 'school';
  const preferred = url.searchParams.get('unit');
  const unitNumber = Object.hasOwn(book.units, preferred) ? preferred : '1';
  const courses = book.units[unitNumber];
  const body = $('detail-body');
  const dialog = $('node-detail');
  let track = location.hash.startsWith('#LS') ? 'LS' : 'RW';
  let selection = null;
  let view = 'logic';
  let back = [];
  let gallery = [];
  let galleryIndex = 0;
  const listPages = new Map();
  const marks = new Map();

  for (const [part, c] of Object.entries(courses)) {
    c.modules = c.layouts[mode].map(id => c.moduleRecords[id]);
    for (const [id, items] of Object.entries(c.phases[mode])) c.entries[id].items = items;
    c.originals = originals[unitNumber]?.[part] || {};
    c.originalPages = c.originals.pages || {};
  }

  const course = () => courses[track];
  const address = (path, number, part, edition) => path + '?unit=' + number + (edition === 'original' ? '&mode=original' : '') + '#' + part;
  const wordId = id => id?.startsWith('word:') || id?.startsWith('practice:') ? id.slice(id.indexOf(':')+1) : '';
  const findWord = id => course().wordPlan.find(w => w.id === wordId(id));
  const activePages = id => course().originalPages[id];
  const currentProgress = () => {
    if (!marks.has(track)) {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(progressStorageKey())) || {}; } catch {}
      marks.set(track, saved);
    }
    return marks.get(track);
  };

  function progressStorageKey() {
    return 'unlock-design-flow:word-work:' + book.book + ':' + track + ':' + unitNumber;
  }

  function implicitEntry(id) {
    if (id === 'vocabulary') return {id, title:'单元 WORDLIST', kind:'study', study:'unit', moduleLabel:'词汇学练', pages:[]};
    const word = findWord(id);
    return word ? {id, title:word.term, kind:'term', moduleLabel:id.startsWith('practice:')?'逐词运用':'词汇学练', pages:[], word} : null;
  }

  const entry = id => course().entries[id] || implicitEntry(id);
  function link(id, label) {
    const target = entry(id);
    const title = label || (target ? [target.moduleLabel, target.title, pagesLabel(target.pages)].filter(Boolean).join(' ') : '');
    return target ? '<button type="button" class="entry-link" data-entry="'+esc(id)+'">'+esc(title)+'</button>' : esc(title);
  }

  function pageButton(page, label = '') {
    const text = [label, pageLabel(page)].filter(Boolean).join(' ');
    return activePages(page) ? '<button type="button" class="page-link" data-page="'+page+'">'+esc(text)+'</button>' :
      '<span class="source-index">'+esc(text)+'</span>';
  }

  function pageGallery(pages) {
    const available = [...new Set(pages)].filter(activePages);
    return available.length ? '<div class="page-gallery">'+available.map(p =>
      '<button type="button" data-page="'+p+'"><img loading="lazy" src="'+esc(activePages(p))+'" alt="'+track+
      ' '+pageLabel(p)+'"><span>'+pageLabel(p)+'</span></button>').join('')+'</div>' :
      '<p class="source-index">教材页码 '+esc(pagesLabel(pages))+'</p>';
  }

  function childLinks(e) {
    const module = course().moduleRecords[e.module];
    const ids = e.kind === 'module' ? [...module.mainContents,...module.phaseIds] : e.items || [];
    return '<div class="child-links">'+ids.map(id=>link(id)).join('')+'</div>';
  }

  function reuseMarkup(e) {
    const before = [], after = [];
    for (const group of course().exerciseReuse) {
      for (const target of group.targets) {
        if (target.to === e.id) before.push('<div class="reuse-detail">'+link(group.from)+'<p>'+author(target.artifact||group.artifact)+'</p></div>');
        if (group.from === e.id) after.push('<div class="reuse-detail">'+link(target.to)+'<p>'+author(target.use)+'</p></div>');
      }
    }
    return (before.length?'<section><h2>调用前题作答</h2>'+before.join('')+'</section>':'')+
      (after.length?'<section><h2>后面怎样复用</h2>'+after.join('')+'</section>':'');
  }

  function blocksMarkup(e) {
    const blocks = course().originals.entries?.[e.id] || [];
    const allowed = new Set(['TABLE','THEAD','TBODY','TR','TD','TH','BR','U','B','I','EM','STRONG','SUP','SUB','P']);
    return blocks.map(block => {
      const instruction = block.instruction || '';
      let text = block.text || '';
      if (instruction && text.startsWith(instruction)) text = text.slice(instruction.length).trim();
      const template = document.createElement('template');
      template.innerHTML = String(text).replace(/\[IMAGE[_ ]?\d+\]/g,'查看原页图片');
      for (const element of [...template.content.querySelectorAll('*')]) {
        if (!allowed.has(element.tagName)) {
          element.replaceWith(document.createTextNode(element.textContent));
          continue;
        }
        for (const attribute of [...element.attributes]) {
          if (!['rowspan','colspan'].includes(attribute.name)) element.removeAttribute(attribute.name);
        }
      }
      const option = o => typeof o==='object'&&o!==null ? [o.optionLabel,o.optionEn??o.textEn].filter(Boolean).join(' ') : o;
      const items = (block.items || []).filter(i=>i.prompt&&!/<table\b/i.test(i.prompt)).map(item=>
        '<li><p>'+esc(item.prompt)+'</p>'+(item.options?.length?'<div class="source-options">'+
        item.options.map(o=>'<span>'+esc(option(o))+'</span>').join('')+'</div>':'')+'</li>').join('');
      return '<section class="source-block"><p class="source-location">'+pageLabel(block.page)+(block.audio?' Track '+esc(block.audio):'')+
        '</p>'+(block.auditOriginalPageOnly?'<p>题目和作答区见原书图。</p>':
        (instruction?'<p class="paper-instruction">'+esc(instruction)+'</p>':'')+
        (text?'<div class="source-text">'+template.innerHTML+'</div>':'')+(items?'<ol class="source-items">'+items+'</ol>':''))+'</section>';
    }).join('');
  }

  function teachingType(box) {
    if (box.role === '带边标讲解框') return box.label + '讲解';
    if (box.role === '题内用框') return '练习作答区';
    if (box.role === '讲解含听例') return '讲解含听力示范';
    return box.role;
  }

  window.UnlockContentTeachingType = teachingType;
  function teachingMarkup(e) {
    const box = e.teachingBox;
    const local = course().originals.boxes?.[e.id];
    const images = (local?.sources || []).map(source =>
      '<button type="button" class="teaching-crop" data-page="'+source.page+'"><img src="'+esc(source.asset)+
      '" alt="'+esc(e.title+' '+pageLabel(source.page))+'"><span>查看整页 '+pageLabel(source.page)+'</span></button>').join('');
    const options = local?.sources.length > 1 ? '<div class="teaching-page-buttons">'+
      local.sources.map(s=>pageButton(s.page,'查看整页')).join('')+'</div>' : '';
    const rel = box.related.map(r=>'<li>'+link(r.entry,r.label+' '+pageLabel(r.page))+
      '<small>'+author(r.basis)+'</small>'+(r.note?'<p>'+author(r.note)+'</p>':'')+'</li>').join('');
    return '<section class="teaching-source"><h2>'+author(teachingType(box))+'</h2><p class="source-index">教材 '+esc(pagesLabel(e.pages))+'</p>'+
      (box.note?'<p class="teaching-role-note">'+author(box.note)+'</p>':'')+options+images+
      (local?.text?'<details class="text-compare"><summary>英文检索文本</summary><div class="teaching-transcript">'+esc(local.text)+'</div></details>':'')+
      '</section>'+(rel?'<section><h2>对应练习</h2><ul class="teaching-links">'+rel+'</ul></section>':'');
  }

  function studyContext(e) {
    const c = course();
    const teaching = e.teachingReferences || [];
    const references = teaching.map(r=>'<div class="teaching-reference">'+link(r.entry,r.label+' '+pagesLabel(entry(r.entry).pages))+
      '<small>'+author(r.basis)+'</small>'+(r.note?'<p>'+author(r.note)+'</p>':'')+'</div>').join('');
    const vocab = c.wordPlan.filter(w=>w.need?.entry===e.id||w.revisit?.entry===e.id);
    return (vocab.length?'<section><h2>在这里遇到的 WORDLIST 词</h2>'+vocab.map(w=>link('word:'+w.id,w.term)).join('')+'</section>':'')+
      (references?'<section class="related-teaching"><h2>相关教材讲解</h2>'+references+'</section>':'');
  }

  function lessonLogic(e) {
    if (e.kind === 'module' || e.kind === 'section') {
      return (e.role ? '<p>'+author(e.role)+'</p>' : '') + childLinks(e);
    }
    if (e.kind === 'task') {
      const p = e.task;
      const reuseTargets = new Set(course().exerciseReuse.flatMap(g=>
        g.from === e.id ? g.targets.map(t=>t.to) : g.targets.some(t=>t.to===e.id) ? [g.from] : []));
      const refs = p.references.filter(id=>entry(id)&&!reuseTargets.has(id));
      return (p.steps.length?'<section><h2>学生怎么做</h2><ol class="step-list">'+p.steps.map(s=>'<li>'+author(s)+'</li>').join('')+'</ol></section>':'')+
        (p.product||p.people?'<section class="task-actions"><h2>作答安排</h2>'+
          (p.product?'<p>'+author(p.product)+'</p>':'')+(p.people?'<p>'+author(p.people)+'</p>':'')+'</section>':'')+
        '<section><h2>教材位置</h2>'+e.pages.map(p=>pageButton(p,'原题')).join('　')+'</section>'+
        reuseMarkup(e)+(refs.length?'<section><h2>原题相关位置</h2>'+refs.map(id=>link(id)).join('')+'</section>':'');
    }
    if (e.kind === 'reference' && /WORDLIST|GLOSSARY/.test(e.title)) {
      return '<p>WORDLIST 用于查漏和固定听写，书末 GLOSSARY 用于核对音标、词性和释义。</p>'+
        link('vocabulary','查看单元 WORDLIST')+pageGallery(e.pages);
    }
    return (e.purpose ? '<p>'+author(e.purpose)+'</p>' : '')+
      (e.appliesTo ? '<p>随原题使用 '+link(e.appliesTo)+'</p>' : '')+pageGallery(e.pages);
  }

  function route() {
    const hash = '#'+[track,...(selection ? ['content',selection,view] : [])].map(encodeURIComponent).join('/');
    if (location.hash !== hash) history.replaceState(null,'',hash);
  }

  function emit() {
    document.dispatchEvent(new CustomEvent('unlock-content-change', {detail:{track,id:selection,open:dialog.open,view}}));
  }

  function renderDetail(scroll = 0) {
    const e = entry(selection);
    const isSpecial = ['term','study','glossary'].includes(e.kind);
    const c = course();
    const lesson = c.moduleRecords[e.module]?.lesson;
    const label = [e.moduleLabel, e.pages.length?pagesLabel(e.pages):'', mode==='school'&&lesson?'第 '+lesson+' 节':''].filter(Boolean).join('　');
    $('detail-title').textContent = e.title;
    $('detail-context').textContent = 'Book '+book.book+' Unit '+unitNumber+' '+track+'　'+label;
    $('detail-return').hidden = !back.length;
    const sequence = c.sequence[mode];
    const index = sequence.indexOf(selection);
    for (const [id, delta] of [['detail-prev',-1],['detail-next',1]]) {
      $(id).hidden = index < 0;
      $(id).disabled = index < 0 || !sequence[index+delta];
    }
    document.querySelector('.detail-tabs').hidden = isSpecial || !Object.keys(c.originalPages).length;
    document.querySelectorAll('[data-view]').forEach(button => {
      button.setAttribute('aria-selected', String(button.dataset.view === view));
    });
    const ui = {course:c, local:c.originals, escape:esc, link, page:pageButton, done:key=>Boolean(currentProgress()[key]),
      listPage:listPages.get(track+selection)||1};
    let markup;
    if (e.kind === 'term') markup = lessonWords.wordView(e.word, ui, selection.startsWith('practice:'));
    else if (e.kind === 'study') markup = lessonWords.study(e, ui);
    else if (e.kind === 'glossary') markup = lessonWords.glossary(e, ui);
    else if (view === 'pages' && Object.keys(c.originalPages).length) {
      markup = '<h2>教材位置</h2>'+pageGallery(e.pages)+(e.referencePages?.length?'<h2>原题要求查阅的页</h2>'+pageGallery(e.referencePages):'');
    } else if (e.teachingBox) markup = teachingMarkup(e);
    else if (view === 'content' && Object.keys(c.originalPages).length) {
      markup = (e.kind==='module'||e.kind==='section'?childLinks(e):'')+pageGallery(e.pages)+
        (course().originals.entries?.[e.id]?.length?'<details class="text-compare"><summary>原书文字对照</summary>'+blocksMarkup(e)+'</details>':'');
    } else markup = lessonLogic(e);
    const preparation = [
      ...(c.glossaryBefore[e.id] || []).map(id=>link(id,'查看任务词汇 '+pageLabel(c.glossaries[id].page))),
      ...(c.exerciseVocab[e.id] || []).map(id=>link(id,'查看本题词汇 '+pagesLabel(entry(id).pages))),
    ];
    const application = e.appliesTo && view !== 'logic' ? '<p>随原题使用 '+link(e.appliesTo)+'</p>' : '';
    body.innerHTML = (preparation.length?'<div class="flow-book-lookup">'+preparation.join('')+'</div>':'')+
      application+markup+studyContext(e);
    body.scrollTop = scroll;
  }

  function open(id, options = {}) {
    const e = entry(id);
    if (!e) return false;
    if (options.relation && selection) back.push({id:selection,view,scroll:body.scrollTop});
    else back = [];
    selection = id;
    view = options.view || e.defaultView || 'logic';
    renderDetail();
    if (!dialog.open) dialog.showModal();
    route();
    emit();
    return true;
  }

  function close() {
    dialog.close();
    selection = null;
    back = [];
    route();
    emit();
  }

  function pageRender() {
    const number = gallery[galleryIndex];
    $('page-caption').textContent = track+' Book '+book.book+' '+pageLabel(number);
    $('page-image').src = activePages(number);
    $('page-image').classList.remove('actual-size');
    $('page-fit').textContent = '放大';
    $('page-prev').disabled = galleryIndex === 0;
    $('page-next').disabled = galleryIndex === gallery.length-1;
  }

  function refreshHeader() {
    document.title = 'UNLOCK Book '+book.book+' Unit '+unitNumber+' '+track+' 教学流程';
    document.querySelectorAll('button[data-track]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.track===track)));
    $('lesson-shortcuts').innerHTML = mode==='school' ? [
      ['study::lesson1','定位第 1 节'],['study::lesson2','定位第 2 节'],['study::review','定位课末查漏'],
    ].map(([id,label])=>'<button type="button" data-go-entry="'+id+'">'+label+'</button>').join('') : '';
  }

  $('book-select').innerHTML = [1,2,3,4,5].map(n=>'<option value="'+n+'">Book '+n+'</option>').join('');
  $('book-select').value = String(book.book);
  $('book-select').onchange = event => {
    const n = event.target.value;
    location.href = address('../B'+n+'/index.html',Math.min(+unitNumber,n==='5'?10:8),track,mode);
  };
  $('unit-select').innerHTML = Object.keys(book.units).map(n=>'<option value="'+n+'">Unit '+n+' '+esc(book.units[n].RW.topic)+'</option>').join('');
  $('unit-select').value = unitNumber;
  $('unit-select').onchange = event => { location.href = address('index.html',event.target.value,track,mode); };
  $('mode-select').value = mode;
  $('mode-select').onchange = event => { location.href = address('index.html',unitNumber,track,event.target.value); };

  document.querySelectorAll('[data-track]').forEach(button => button.onclick = () => {
    if (track === button.dataset.track) return;
    if (dialog.open) close();
    track = button.dataset.track;
    refreshHeader();
    route();
    emit();
  });
  $('detail-close').onclick = close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('detail-return').onclick = () => {
    const prior = back.pop();
    if (!prior) return;
    selection = prior.id;
    view = prior.view;
    renderDetail(prior.scroll);
    route();
    emit();
  };
  for (const [id, delta] of [['detail-prev',-1],['detail-next',1]]) $(id).onclick = () => {
    const sequence = course().sequence[mode];
    const next = sequence[sequence.indexOf(selection)+delta];
    if (next) open(next);
  };
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => {
    view = button.dataset.view;
    renderDetail();
    route();
  });
  $('vocabulary-open').onclick = () => open('vocabulary');
  $('page-close').onclick = () => $('page-viewer').close();
  $('page-prev').onclick = () => { if (galleryIndex > 0) {galleryIndex--;pageRender();} };
  $('page-next').onclick = () => { if (galleryIndex < gallery.length-1) {galleryIndex++;pageRender();} };
  $('page-fit').onclick = () => {
    const large = $('page-image').classList.toggle('actual-size');
    $('page-fit').textContent = large ? '适应页面' : '放大';
  };
  body.addEventListener('click', event => {
    const target = event.target.closest('[data-entry],[data-page],[data-list-page],[data-progress]');
    if (!target) return;
    if (target.dataset.entry) {open(target.dataset.entry,{relation:true});return;}
    if (target.dataset.listPage) {listPages.set(track+selection,+target.dataset.listPage);renderDetail();return;}
    if (target.dataset.progress) {
      const key = target.dataset.progress;
      const store = currentProgress();
      store[key] = !store[key];
      try {localStorage.setItem(progressStorageKey(), JSON.stringify(store));} catch {}
      renderDetail(body.scrollTop);
      [...body.querySelectorAll('[data-progress]')].find(b=>b.dataset.progress===key)?.focus({preventScroll:true});
      return;
    }
    const page = +target.dataset.page;
    if (!activePages(page)) return;
    gallery = [...new Set([...body.querySelectorAll('[data-page]')].map(el=>+el.dataset.page).filter(activePages))];
    galleryIndex = gallery.indexOf(page);
    pageRender();
    $('page-viewer').showModal();
  });

  window.UnlockContent = {index:{tracks:courses}, track:()=>track, selection:()=>({id:selection,view,open:dialog.open}), open, close, mode, formatLabel:display, escape:esc};
  refreshHeader();
  try {
    const [,marker,id,tab] = location.hash.slice(1).split('/').map(decodeURIComponent);
    if (marker === 'content' && id) open(id, {view:tab});
  } catch (error) {
    if (!(error instanceof URIError)) throw error;
  }
})();
