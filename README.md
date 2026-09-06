# MB-004 Korea Moving Quote Normalizer

A static, local-only tool for normalizing two or three already-received Korean moving quotes across consistent scope/status rows. The mobile-first flow compares entered base and explicitly separate charges, keeps uncertainty visible, and generates vendor-specific confirmation questions without inventing price allowances.

## Development and test

Open `index.html` directly for development. Run the automated static and browser-DOM behavior checks with:

```sh
npm ci
npm test
```

Production is served at <https://leejx12.github.io/mb-004-korea-moving-quote-normalizer/> using GitHub Pages from the repository root on `main`.

## Privacy and operating cost

Inputs and question checkmarks persist only in browser `localStorage`; there is no backend, account, paid API, or recurring infrastructure charge. A transport-neutral event abstraction stores one-fire page-session counters under `movingQuoteEventsV2`, emits a `movingquote:event` browser event, and can accept a test adapter through `setMovingQuoteEventTransport`. Nothing is transmitted off-device by default. Portfolio-wide aggregate measurement remains blocked until an already-approved, zero-cost collection mechanism exists; this implementation deliberately does not introduce a new service or activate the priced confirmation-pack test.

## Migration

See [`MIGRATION_PROVENANCE.md`](MIGRATION_PROVENANCE.md). The legacy deployment is intentionally retained during cutover verification.


