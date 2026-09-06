const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const sourceHtml = readFileSync('index.html', 'utf8');
const script = readFileSync('app.js', 'utf8');
const css = readFileSync('styles.css', 'utf8');
const html = sourceHtml.replace('<script src="app.js"></script>', `<script>${script}</script>`);
const url = 'https://leejx12.github.io/mb-004-korea-moving-quote-normalizer/';

function app(saved) {
  return new JSDOM(html, {
    runScripts: 'dangerously',
    url,
    beforeParse(window) {
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.print = () => {};
      if (saved) window.localStorage.setItem('movingQuoteV2', JSON.stringify(saved));
    }
  });
}

function input(dom, selector, value) {
  const element = dom.window.document.querySelector(selector);
  element.value = value;
  element.dispatchEvent(new dom.window.Event('input', {bubbles:true}));
  return element;
}

function change(dom, selector, value) {
  const element = dom.window.document.querySelector(selector);
  element.value = value;
  element.dispatchEvent(new dom.window.Event('change', {bubbles:true}));
  return element;
}

test('fresh state starts with two blank quotes, conservative defaults, and no winner marker', () => {
  const dom = app(); const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('[data-quote-card]').length, 2);
  assert.deepEqual([...doc.querySelectorAll('[data-base]')].map(x => x.value), ['', '']);
  assert.deepEqual([...doc.querySelectorAll('[data-status]')].map(x => x.value), ['unspecified', 'unspecified']);
  assert.match(doc.querySelector('#result-summary').textContent, /견적 2개의 금액을 입력하면/);
  assert.equal(doc.querySelectorAll('.best,.lowest,.winner').length, 0);
  assert.equal(doc.querySelector('#questions').hidden, true);
});

test('requires positive totals and keeps incomplete quotes out of comparison', () => {
  const dom = app(); const doc = dom.window.document;
  input(dom, '[data-base="0"]', '0');
  input(dom, '[data-base="1"]', '1200000');
  assert.match(doc.querySelector('[data-base-error="0"]').textContent, /0보다 큰/);
  assert.match(doc.querySelector('#result-summary').textContent, /견적 2개의 금액을 입력하면/);
  assert.match(doc.querySelector('[data-result="0"]').textContent, /입력 미완료/);
  assert.equal(doc.querySelector('#questions').hidden, true);
});

test('adds only explicit separate charges and ignores stale amounts on other statuses', () => {
  const dom = app(); const doc = dom.window.document;
  input(dom, '[data-base="0"]', '1000000');
  input(dom, '[data-base="1"]', '1300000');
  doc.querySelector('#next-item').click();
  change(dom, '[data-status="0"]', 'separate');
  input(dom, '[data-separate="0"]', '150000');
  change(dom, '[data-status="1"]', 'included');
  const saved = JSON.parse(dom.window.localStorage.getItem('movingQuoteV2'));
  saved.quotes[1].amounts[1] = '999999';
  dom.window.localStorage.setItem('movingQuoteV2', JSON.stringify(saved));
  assert.match(doc.querySelector('[data-result="0"]').textContent, /1,150,000원/);
  assert.match(doc.querySelector('[data-result="1"]').textContent, /1,300,000원/);
  assert.doesNotMatch(doc.body.textContent, /2,299,999원/);
});

test('unresolved scope pairs explicit total and uncertainty without declaring a winner', () => {
  const dom = app(); const doc = dom.window.document;
  input(dom, '[data-base="0"]', '1000000');
  input(dom, '[data-base="1"]', '1200000');
  change(dom, '[data-status="1"]', 'included');
  const summary = doc.querySelector('#result-summary').textContent;
  assert.match(summary, /200,000원 낮고 미기재 11개/);
  assert.match(summary, /견적 B는 미기재 10개/);
  assert.match(summary, /최종 비교를 확정할 수 없습니다/);
  assert.doesNotMatch(doc.querySelector('#result').textContent, /최고|승자|추천/);
});

test('zero-unresolved results state only the entered explicit-total difference', () => {
  const state = {
    version:2, demo:false, activeQuoteCount:2, itemIndex:0, checks:{},
    quotes:['A','B','C'].map((name,index) => ({
      name:`견적 ${name}`, base:index < 2 ? String(1000000 + index * 200000) : '',
      statuses:Array(11).fill('included'), amounts:Array(11).fill(''), reviewed:Array(11).fill(true)
    }))
  };
  const dom = app(state); const summary = dom.window.document.querySelector('#result-summary').textContent;
  assert.match(summary, /입력된 명시 항목 기준으로 견적 A가 견적 B보다 200,000원 낮습니다/);
  assert.doesNotMatch(summary, /시세|적정가|추천/);
});

test('demo is explicit, artificial, lower-total and more uncertain, and excluded from completion events', () => {
  const dom = app(); const doc = dom.window.document;
  doc.querySelector('#load-demo').click();
  assert.equal(doc.querySelector('#demo-banner').hidden, false);
  assert.match(doc.querySelector('#demo-banner').textContent, /동작 예시 — 시세·적정가 아님/);
  assert.match(doc.querySelector('#result-summary').textContent, /미기재 9개/);
  const events = JSON.parse(dom.window.localStorage.getItem('movingQuoteEventsV2'));
  assert.equal(events.comparison_complete, undefined);
  assert.equal(events.question_artifact_view, undefined);
});

test('generates vendor-specific unresolved questions, separate confirmation, final question, and local checks', () => {
  const dom = app(); const doc = dom.window.document;
  input(dom, '[data-base="0"]', '1000000');
  input(dom, '[data-base="1"]', '1200000');
  doc.querySelector('#next-item').click();
  change(dom, '[data-status="0"]', 'separate');
  input(dom, '[data-separate="0"]', '50000');
  const groups = doc.querySelectorAll('[data-question-group]');
  assert.equal(groups.length, 2);
  assert.match(groups[0].textContent, /출발지 사다리차 별도금액 50,000원이 맞고/);
  assert.match(groups[0].textContent, /도착지 사다리차 항목이 이 견적에 포함되나요/);
  assert.match(groups[0].textContent, /계약서상 결제 범위와 현장 추가금 발생 조건/);
  const checkbox = groups[0].querySelector('[data-check]');
  checkbox.checked = true;
  checkbox.dispatchEvent(new dom.window.Event('change', {bubbles:true}));
  assert.equal(Object.values(JSON.parse(dom.window.localStorage.getItem('movingQuoteV2')).checks).includes(true), true);
});

test('preserves optional third quote and local state', () => {
  const dom = app(); const doc = dom.window.document;
  doc.querySelector('#add-quote').click();
  assert.equal(doc.querySelectorAll('[data-quote-card]').length, 3);
  input(dom, '[data-name="2"]', '세 번째 업체');
  input(dom, '[data-base="2"]', '1500000');
  const restored = app(JSON.parse(dom.window.localStorage.getItem('movingQuoteV2')));
  assert.equal(restored.window.document.querySelectorAll('[data-quote-card]').length, 3);
  assert.equal(restored.window.document.querySelector('[data-name="2"]').value, '세 번째 업체');
  assert.equal(restored.window.document.querySelector('[data-base="2"]').value, '1500000');
});

test('event interface is one-fire, allowlisted, demo-safe, and no-ops without a transport', () => {
  const dom = app(); const doc = dom.window.document; const seen = [];
  dom.window.setMovingQuoteEventTransport((name,payload) => seen.push({name,payload}));
  input(dom, '[data-base="0"]', '1000000');
  input(dom, '[data-base="0"]', '1100000');
  input(dom, '[data-base="1"]', '1200000');
  assert.equal(seen.filter(event => event.name === 'comparison_start').length, 1);
  const payloadText = JSON.stringify(seen);
  assert.doesNotMatch(payloadText, /1100000|1200000|견적 A|address|email|phone/);
  assert.deepEqual(Object.keys(seen[0].payload).sort(), ['page_version','schema_version']);
  assert.doesNotThrow(() => dom.window.setMovingQuoteEventTransport(null));
});

test('mobile CSS avoids fixed-width tables and horizontal-scroll-dependent controls', () => {
  assert.equal(sourceHtml.includes('<table'), false);
  assert.equal(css.includes('min-width:760px'), false);
  assert.equal(css.includes('overflow-x:auto'), false);
  assert.match(css, /html,body\{[^}]*max-width:100%[^}]*overflow-x:clip/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.match(css, /min-width:0/);
});

test('keeps canonical, crawlable intent copy, privacy boundary, and no priced offer', () => {
  const dom = app(); const doc = dom.window.document;
  assert.equal(doc.querySelector('link[rel="canonical"]').href, url);
  assert.match(doc.querySelector('meta[name="description"]').content, /포장이사 견적 2~3개/);
  assert.match(doc.body.textContent, /시장 시세나 적정가를 판정하지 않습니다/);
  assert.match(doc.body.textContent, /브라우저에만 저장되며 서버로 전송하지 않습니다/);
  assert.equal(doc.querySelectorAll('#quote-checklist').length, 1);
  assert.doesNotMatch(doc.body.textContent, /1,900원|수요 확인 중|이메일|전화번호|주소 입력|파일 업로드/);
});

