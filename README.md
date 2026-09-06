# MB-004 Korea Moving Quote Normalizer

A static, local-only tool for normalizing two or three already-received Korean moving quotes across consistent scope/status rows. It compares entered base and explicitly separate charges and flags unspecified scope without inventing price allowances.

## Development and test

Open `index.html` directly for development. Run the automated static and browser-DOM behavior checks with:

```sh
npm ci
npm test
```

Production is served at <https://leejx12.github.io/mb-004-korea-moving-quote-normalizer/> using GitHub Pages from the repository root on `main`.

## Privacy and operating cost

Inputs persist only in browser `localStorage`; there is no backend, account, paid API, or recurring infrastructure charge. A local event abstraction stores aggregate `page_view` and `calculator_completion` counters under `movingQuoteEventsV1` and emits a `movingquote:event` browser event. Nothing is transmitted off-device. Portfolio-wide aggregate measurement remains blocked until an already-approved, zero-cost collection mechanism exists; this change deliberately does not introduce a new service.

## Migration

See [`MIGRATION_PROVENANCE.md`](MIGRATION_PROVENANCE.md). The legacy deployment is intentionally retained during cutover verification.

