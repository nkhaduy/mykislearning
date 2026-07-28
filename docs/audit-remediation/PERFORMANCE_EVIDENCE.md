# Performance Evidence

- Route bundles: `/admin/employees` ~144 KB JS, `/admin/courses` ~132 KB, course player ~131 KB, live training/quizzes/records ~132 KB, scanner ~133 KB, reports ~151 KB. All priority routes load no `app.js`; the measurement also confirms no eager XLSX/QR load.
- Employee search: latest local 100k run records substring p50/p95/p99 `19.0/69.6/71.8 ms`, prefix `1.27/1.68/1.75 ms`, cursor `0.09/0.15/0.16 ms`, and eight-request concurrency `200 ms` versus legacy `475 ms`.
- Export: Queue/R2 unit evidence covers duplicate delivery, lease claim, retry, multipart abort, cancellation signal and owner authorization contracts.
- Migration: `npm run test:migrations` passes fresh, upgrade, recoverable partial and conflict partial scenarios with search/export migrations.
- Wrangler: `npm run check:wrangler` passes with Queue, R2, Assets and Durable Object bindings in dry-run mode.

These are local/synthetic measurements. They are not production traffic measurements and do not authorize deployment.

Report list implementations other than the employee CSV consumer still hydrate bounded in-memory datasets (`5,000` profiles/courses and up to `20,000-30,000` detail rows). That protects Worker memory from unbounded reads but can truncate 100,000-row reporting, so full report-query modernization remains a production blocker.
