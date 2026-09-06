const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const html = readFileSync('index.html', 'utf8');
const url = 'https://leejx12.github.io/mb-004-korea-moving-quote-normalizer/';

function app(saved) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url,
    beforeParse(window) {
      if (saved) window.localStorage.setItem('movingQuoteV1', JSON.stringify(saved));
    }
  });
  return dom;
}

test('renders three quotes and all eleven normalized scope rows', () => {
  const dom = app();
  assert.equal(dom.window.document.querySelectorAll('.qname').length, 3);
  assert.equal(dom.window.document.querySelectorAll('#rows tr').length, 11);
  assert.equal(dom.window.document.querySelectorAll('[data-s]').length, 33);
  assert.deepEqual([...dom.window.document.querySelector('[data-s]').options].map(o => o.text), ['포함', '별도', '미기재', '불필요']);
});

test('adds base and explicit separate charges while warning on unspecified scope', () => {
  const dom = app();
  const doc = dom.window.document;
  doc.querySelector('[data-a="0-0"]').value = '1000000';
  doc.querySelector('[data-s="1-0"]').value = 'separate';
  doc.querySelector('[data-a="1-0"]').value = '150000';
  doc.querySelector('[data-s="2-0"]').value = 'unspecified';
  doc.querySelector('[data-a="2-0"]').value = '999999';
  doc.querySelector('#calc').click();
  const result = doc.querySelectorAll('.total')[0].textContent;
  assert.match(result, /1,150,000원/);
  assert.match(result, /미기재 1개/);
  assert.doesNotMatch(result, /2,149,999원/);
});

test('persists quote names, status, and amount locally and restores them', () => {
  const saved = {names:['업체 하나','견적 B','견적 C'], s:Array(33).fill('included'), a:Array(33).fill('')};
  saved.s[4] = 'unspecified'; saved.a[0] = '420000';
  const dom = app(saved); const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.qname')[0].value, '업체 하나');
  assert.equal(doc.querySelectorAll('[data-s]')[4].value, 'unspecified');
  assert.equal(doc.querySelectorAll('[data-a]')[0].value, '420000');
  doc.querySelectorAll('.qname')[0].value = '새 업체';
  doc.querySelectorAll('.qname')[0].dispatchEvent(new dom.window.Event('input', {bubbles:true}));
  assert.equal(JSON.parse(dom.window.localStorage.getItem('movingQuoteV1')).names[0], '새 업체');
});

test('has standalone canonical and crawlable intent copy', () => {
  const dom = app(); const doc = dom.window.document;
  assert.equal(doc.querySelector('link[rel="canonical"]').href, url);
  assert.match(doc.querySelector('meta[name="description"]').content, /포장이사 견적 2~3개/);
  assert.match(doc.body.textContent, /이사 추가금 위험은 어떻게 찾나요/);
  assert.match(doc.body.textContent, /시장 시세나 적정가를 판정하지 않습니다/);
  assert.equal(doc.querySelector('a[href="#quote-checklist"]').textContent, '견적 비교 체크리스트 보기');
  assert.equal(doc.querySelectorAll('#quote-checklist').length, 1);
  assert.match(doc.querySelector('#quote-checklist').textContent, /포함·별도·미기재를 구분하세요/);
});

test('records privacy-light page-view and explicit calculator-completion events locally', () => {
  const dom = app(); const doc = dom.window.document;
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('movingQuoteEventsV1')), {page_view: 1});
  const seen = [];
  doc.addEventListener('movingquote:event', event => seen.push(event.detail.name));
  doc.querySelector('#calc').click();
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('movingQuoteEventsV1')), {page_view: 1, calculator_completion: 1});
  assert.deepEqual(seen, ['calculator_completion']);
});

