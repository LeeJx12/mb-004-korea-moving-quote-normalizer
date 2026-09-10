(function () {
  'use strict';

  const items = [
    ['기본 이사비(차량·인력)', '견적서 첫 화면의 기본 또는 총 견적 금액을 위 1단계에 입력했습니다.'],
    ['출발지 사다리차', '출발지 사다리차 비용의 포함 여부를 확인하세요.'],
    ['도착지 사다리차', '도착지 사다리차 비용의 포함 여부를 확인하세요.'],
    ['엘리베이터·주차·접근 조건', '엘리베이터 사용료, 주차 거리, 장거리 운반 조건을 확인하세요.'],
    ['에어컨·TV 등 가전 분해/설치', '가전 분해·재설치 비용과 작업 범위를 확인하세요.'],
    ['피아노·돌침대 등 특수물품', '특수물품 운반 비용과 작업 가능 여부를 확인하세요.'],
    ['폐기·청소·정리 비용', '폐기물 처리, 청소, 정리 작업의 포함 범위를 확인하세요.'],
    ['포장재·추가 포장', '추가 박스나 특수 포장재 비용 조건을 확인하세요.'],
    ['보관 이사·보관료', '보관이 필요한 경우 기간과 입출고 비용을 확인하세요.'],
    ['손없는날·주말·성수기 할증', '날짜에 따른 할증이 이미 반영됐는지 확인하세요.'],
    ['기타 견적 항목', '견적서에 있는 그 밖의 별도 조건을 확인하세요.']
  ];
  const storageKey = 'movingQuoteV2';
  const legacyKey = 'movingQuoteV1';
  const eventKey = 'movingQuoteEventsV2';
  const statusLabels = {included:'포함', separate:'별도', unspecified:'미기재', na:'불필요'};
  const statusHelp = {
    included:'기본 견적에 포함된 것으로 명시됨',
    separate:'별도 금액이 명시됨',
    unspecified:'포함 여부가 명확하지 않아 확인 필요',
    na:'내 이사에는 해당 없음'
  };
  let eventTransport = null;
  const fired = new Set();

  function freshState() {
    return {
      version: 2,
      demo: false,
      activeQuoteCount: 2,
      itemIndex: 0,
      quotes: ['A','B','C'].map(letter => ({
        name: `견적 ${letter}`,
        base: '',
        statuses: Array(items.length).fill('unspecified'),
        amounts: Array(items.length).fill(''),
        reviewed: Array(items.length).fill(false)
      })),
      checks: {}
    };
  }

  let model = freshState();

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function formatWon(value) {
    return `${Math.round(value).toLocaleString('ko-KR')}원`;
  }

  function migrateLegacy(old) {
    if (!old || !Array.isArray(old.names)) return null;
    const next = freshState();
    next.activeQuoteCount = 3;
    next.quotes.forEach((quote, quoteIndex) => {
      quote.name = old.names[quoteIndex] || quote.name;
      quote.base = old.a?.[quoteIndex] || '';
      items.forEach((_, itemIndex) => {
        const flatIndex = itemIndex * 3 + quoteIndex;
        quote.statuses[itemIndex] = itemIndex === 0 ? 'included' : (old.s?.[flatIndex] || 'unspecified');
        quote.amounts[itemIndex] = itemIndex === 0 ? '' : (old.a?.[flatIndex] || '');
        quote.reviewed[itemIndex] = Boolean(old.s?.[flatIndex]);
      });
    });
    return next;
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.version === 2 && Array.isArray(saved.quotes)) {
        model = saved;
        model.checks ||= {};
        return;
      }
      const migrated = migrateLegacy(JSON.parse(localStorage.getItem(legacyKey)));
      if (migrated) model = migrated;
    } catch (_) {}
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(model)); } catch (_) {}
  }

  function emitEvent(name, fields = {}) {
    if (fired.has(name)) return;
    const payload = {schema_version:1, page_version:'mobile-v2', ...fields};
    fired.add(name);
    try {
      const counts = JSON.parse(localStorage.getItem(eventKey) || '{}');
      counts[name] = (counts[name] || 0) + 1;
      localStorage.setItem(eventKey, JSON.stringify(counts));
      document.dispatchEvent(new CustomEvent('movingquote:event', {detail:{name, payload}}));
      if (typeof eventTransport === 'function') eventTransport(name, payload);
    } catch (_) {}
  }

  window.setMovingQuoteEventTransport = adapter => { eventTransport = typeof adapter === 'function' ? adapter : null; };

  function sourceBucket() {
    const declaredSource = new URLSearchParams(window.location.search).get('src');
    if (declaredSource === 'owned-guide') return 'referral';
    if (!document.referrer) return 'direct';
    try {
      const referrerHost = new URL(document.referrer).hostname.toLowerCase();
      if (referrerHost === window.location.hostname.toLowerCase()) return 'referral';
      if (/(^|\.)(google|naver|bing|daum)\./.test(referrerHost)) return 'search';
      if (/(^|\.)(instagram|facebook|twitter|x|t\.co|kakao)\./.test(referrerHost)) return 'social';
      return 'referral';
    } catch (_) {
      return 'direct';
    }
  }

  const $ = selector => document.querySelector(selector);
  const activeQuotes = () => model.quotes.slice(0, model.activeQuoteCount);

  function renderQuotes() {
    const container = $('#quote-cards');
    container.classList.toggle('three', model.activeQuoteCount === 3);
    container.innerHTML = activeQuotes().map((quote, index) => `
      <article class="quote-card" data-quote-card="${index}">
        <h3>견적 ${String.fromCharCode(65 + index)}</h3>
        <label class="field">업체 구분 이름
          <input data-name="${index}" value="${escapeAttribute(quote.name)}" maxlength="40" autocomplete="off">
        </label>
        <label class="field">기본·견적 금액
          <span class="money-field"><input data-base="${index}" type="number" min="1" step="1000" inputmode="numeric" value="${escapeAttribute(quote.base)}" placeholder="예: 1200000"><span>원</span></span>
        </label>
        <p class="error" data-base-error="${index}">${quote.base !== '' && !safeNumber(quote.base) ? '0보다 큰 금액을 입력해 주세요.' : ''}</p>
      </article>`).join('');
    $('#add-quote').hidden = model.activeQuoteCount === 3;
  }

  function escapeAttribute(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  }

  function escapeHtml(value) {
    const node = document.createElement('span');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  }

  function renderScope() {
    const itemIndex = Math.max(0, Math.min(items.length - 1, model.itemIndex));
    model.itemIndex = itemIndex;
    $('#progress').textContent = `${itemIndex + 1} / ${items.length}`;
    $('#item-title').textContent = items[itemIndex][0];
    $('#item-help').textContent = items[itemIndex][1];
    $('#scope-responses').innerHTML = activeQuotes().map((quote, quoteIndex) => {
      const status = quote.statuses[itemIndex] || 'unspecified';
      return `<div class="scope-response" data-scope-response="${quoteIndex}">
        <h3>${escapeHtml(quote.name || `견적 ${String.fromCharCode(65 + quoteIndex)}`)}</h3>
        <label class="field">견적서 표기
          <select data-status="${quoteIndex}" aria-label="${escapeAttribute(quote.name)} ${escapeAttribute(items[itemIndex][0])} 상태">
            ${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <p class="choice-help">${statusHelp[status]}</p>
        <label class="field separate-amount" ${status === 'separate' ? '' : 'hidden'}>명시된 별도금액
          <span class="money-field"><input data-separate="${quoteIndex}" type="number" min="0" step="1000" inputmode="numeric" value="${escapeAttribute(quote.amounts[itemIndex])}" placeholder="0"><span>원</span></span>
        </label>
      </div>`;
    }).join('');
    $('#prev-item').disabled = itemIndex === 0;
    $('#next-item').hidden = itemIndex === items.length - 1;
    $('#show-result').hidden = itemIndex !== items.length - 1;
  }

  function quoteResult(quote, index) {
    const base = safeNumber(quote.base);
    const unresolvedItems = [];
    let total = base;
    items.forEach((item, itemIndex) => {
      const status = quote.statuses[itemIndex] || 'unspecified';
      if (status === 'unspecified') unresolvedItems.push(item[0]);
      if (itemIndex > 0 && status === 'separate') total += safeNumber(quote.amounts[itemIndex]);
    });
    return {index, name: quote.name || `견적 ${String.fromCharCode(65 + index)}`, valid:base > 0, total, unresolvedItems};
  }

  function results() { return activeQuotes().map(quoteResult); }

  function dominantSentence(valid) {
    if (valid.length < 2) return '견적 2개의 금액을 입력하면 명시총액과 확인할 항목을 함께 비교합니다.';
    const sorted = [...valid].sort((a,b) => a.total - b.total);
    const lowest = sorted[0];
    const next = sorted[1];
    if (lowest.total === next.total) return '입력된 명시총액이 같습니다. 포함 범위와 추가금 조건을 확인하세요.';
    const delta = next.total - lowest.total;
    const hasUnresolved = valid.some(result => result.unresolvedItems.length > 0);
    if (hasUnresolved) {
      const leastUncertain = [...valid].sort((a,b) => a.unresolvedItems.length - b.unresolvedItems.length)[0];
      if (leastUncertain.index !== lowest.index) {
        return `${lowest.name}는 ${formatWon(delta)} 낮고 미기재 ${lowest.unresolvedItems.length}개, ${leastUncertain.name}는 미기재 ${leastUncertain.unresolvedItems.length}개입니다. 확인 전에는 최종 비교를 확정할 수 없습니다.`;
      }
      return `명시총액만 보면 ${lowest.name}가 ${formatWon(delta)} 낮지만, 미기재 ${lowest.unresolvedItems.length}개를 확인하기 전에는 최종 비교를 확정할 수 없습니다.`;
    }
    return `입력된 명시 항목 기준으로 ${lowest.name}가 ${next.name}보다 ${formatWon(delta)} 낮습니다.`;
  }

  function allReviewed(valid) {
    return valid.length >= 2 && valid.every(result => model.quotes[result.index].reviewed.every(Boolean));
  }

  function renderResults() {
    const all = results();
    const valid = all.filter(result => result.valid);
    const summary = $('#result-summary');
    summary.textContent = dominantSentence(valid);
    summary.classList.toggle('needs-check', valid.length >= 2 && valid.some(result => result.unresolvedItems.length));
    const cards = $('#result-cards');
    cards.classList.toggle('three', model.activeQuoteCount === 3);
    cards.innerHTML = all.map(result => {
      if (!result.valid) return `<article class="result-card incomplete" data-result="${result.index}"><h3>${escapeHtml(result.name)}</h3><span class="badge">입력 미완료</span><p>0보다 큰 견적 금액을 입력해 주세요.</p></article>`;
      const unresolved = result.unresolvedItems.length;
      const badge = unresolved ? '확인 필요' : (valid.length >= 2 ? '명시총액 비교 완료' : '비교 대기');
      return `<article class="result-card" data-result="${result.index}">
        <h3>${escapeHtml(result.name)}</h3>
        <span class="badge ${unresolved ? 'warn' : ''}">${badge}</span>
        <div class="big">${formatWon(result.total)}</div>
        <p class="formula">기본 + 명시된 별도금액</p>
        <p class="unresolved">미기재 ${unresolved}개</p>
        ${unresolved ? `<ul class="unresolved-list">${result.unresolvedItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="muted">확인할 미기재 항목 없음</p>'}
      </article>`;
    }).join('');
    renderQuestions(valid);
    if (!model.demo && allReviewed(valid)) {
      const totalUnresolved = valid.reduce((sum,result) => sum + result.unresolvedItems.length, 0);
      emitEvent('comparison_complete', {quote_count:valid.length, unresolved_bucket:totalUnresolved === 0 ? '0' : totalUnresolved <= 2 ? '1-2' : '3-plus'});
    }
  }

  function questionLines(result) {
    const quote = model.quotes[result.index];
    const lines = [];
    items.forEach((item, itemIndex) => {
      const status = quote.statuses[itemIndex];
      if (status === 'unspecified') lines.push(`${item[0]} 항목이 이 견적에 포함되나요? 별도라면 금액과 발생 조건을 견적서 또는 문자로 확인해 주세요.`);
      if (itemIndex > 0 && status === 'separate') lines.push(`${item[0]} 별도금액 ${formatWon(safeNumber(quote.amounts[itemIndex]))}이 맞고, 추가 발생 조건이 더 없는지 확인해 주세요.`);
    });
    lines.push('위 항목 확인 후 계약서상 결제 범위와 현장 추가금 발생 조건을 문서로 받을 수 있나요?');
    return lines;
  }

  function renderQuestions(valid) {
    const section = $('#questions');
    if (valid.length < 2) { section.hidden = true; $('#question-groups').innerHTML = ''; return; }
    section.hidden = false;
    $('#question-groups').innerHTML = valid.map(result => `
      <article class="question-group" data-question-group="${result.index}">
        <h3>${escapeHtml(result.name)}</h3>
        <p class="question-total">현재 명시총액 ${formatWon(result.total)}</p>
        <ul class="check-list">${questionLines(result).map((line,lineIndex) => {
          const id = `${result.index}-${lineIndex}`;
          return `<li><label><input data-check="${id}" type="checkbox" ${model.checks[id] ? 'checked' : ''}><span><strong>확인함</strong> — ${escapeHtml(line)}</span></label></li>`;
        }).join('')}</ul>
      </article>`).join('');
    if (!model.demo) emitEvent('question_artifact_view', {quote_count:valid.length});
  }

  function markStart() {
    if (!model.demo) emitEvent('comparison_start');
  }

  function loadDemo() {
    model = freshState();
    model.demo = true;
    model.quotes[0].name = '예시 견적 A'; model.quotes[0].base = '1100000';
    model.quotes[1].name = '예시 견적 B'; model.quotes[1].base = '1250000';
    model.quotes[0].statuses = Array(items.length).fill('unspecified');
    model.quotes[1].statuses = Array(items.length).fill('included');
    model.quotes[0].statuses[0] = 'included';
    model.quotes[0].statuses[1] = 'separate'; model.quotes[0].amounts[1] = '50000';
    model.quotes[0].reviewed = Array(items.length).fill(true);
    model.quotes[1].reviewed = Array(items.length).fill(true);
    save(); renderAll();
    $('#demo-banner').scrollIntoView({behavior:'smooth', block:'start'});
  }

  function clearDemo() {
    model = freshState();
    save(); renderAll();
    $('#quotes-title').scrollIntoView({behavior:'smooth', block:'start'});
  }

  function renderAll() {
    $('#demo-banner').hidden = !model.demo;
    renderQuotes(); renderScope(); renderResults();
  }

  document.addEventListener('input', event => {
    const nameIndex = event.target.dataset.name;
    const baseIndex = event.target.dataset.base;
    const separateIndex = event.target.dataset.separate;
    if (nameIndex !== undefined) model.quotes[Number(nameIndex)].name = event.target.value;
    if (baseIndex !== undefined) {
      model.quotes[Number(baseIndex)].base = event.target.value;
      $("[data-base-error=\"" + baseIndex + "\"]").textContent = event.target.value !== '' && !safeNumber(event.target.value) ? '0보다 큰 금액을 입력해 주세요.' : '';
    }
    if (separateIndex !== undefined) model.quotes[Number(separateIndex)].amounts[model.itemIndex] = event.target.value;
    if (nameIndex !== undefined || baseIndex !== undefined || separateIndex !== undefined) { markStart(); save(); renderResults(); }
  });

  document.addEventListener('change', event => {
    const statusIndex = event.target.dataset.status;
    const checkId = event.target.dataset.check;
    if (statusIndex !== undefined) {
      const quote = model.quotes[Number(statusIndex)];
      quote.statuses[model.itemIndex] = event.target.value;
      quote.reviewed[model.itemIndex] = true;
      markStart(); save(); renderScope(); renderResults();
    }
    if (checkId !== undefined) { model.checks[checkId] = event.target.checked; save(); }
  });

  $('#add-quote').addEventListener('click', () => { model.activeQuoteCount = 3; markStart(); save(); renderAll(); });
  $('#to-scopes').addEventListener('click', () => $('#scope-step').scrollIntoView({behavior:'smooth', block:'start'}));
  $('#prev-item').addEventListener('click', () => { if (model.itemIndex > 0) { model.itemIndex--; save(); renderScope(); } });
  $('#next-item').addEventListener('click', () => { if (model.itemIndex < items.length - 1) { model.itemIndex++; save(); renderScope(); } });
  $('#show-result').addEventListener('click', () => { renderResults(); $('#result').scrollIntoView({behavior:'smooth', block:'start'}); });
  $('#load-demo').addEventListener('click', loadDemo);
  $('#clear-demo').addEventListener('click', clearDemo);
  $('#print-questions').addEventListener('click', () => { if (!model.demo) emitEvent('question_artifact_action', {action_type:'print'}); window.print(); });
  $('#copy-questions').addEventListener('click', async () => {
    const text = [...document.querySelectorAll('.question-group')].map(group => group.innerText).join('\n\n');
    try { await navigator.clipboard.writeText(text); } catch (_) {
      const area = document.createElement('textarea'); area.value = text; document.body.append(area); area.select(); document.execCommand?.('copy'); area.remove();
    }
    if (!model.demo) emitEvent('question_artifact_action', {action_type:'copy'});
    $('#copy-questions').textContent = '복사됨';
  });

  restore();
  renderAll();
  emitEvent('landing_view', {source_bucket:sourceBucket(), demo:false});
})();

