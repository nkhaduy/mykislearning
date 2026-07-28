# Legacy Monolith Map

`app.js` has roughly 10,000 lines and hundreds of module-scope state variables. Its central `render()` and `bindEvents()` branches cover nearly every route. Importing it also imports legacy service wrappers and broad CSS, then installs document/window listeners, activity timers, shell guards and optional QR/YouTube callbacks.

| Dependency | Legacy responsibility | Split replacement |
|---|---|---|
| DOM route branch | chooses markup for unrelated routes | `src/app/bootstrap.js` + `route-registry.js` |
| mutable employee arrays/page | browser-side filtering and offset pagination | `/api/employees` RPC + `employees.js` cursor state |
| report export loaders | XLSX/PDF code reachable from report route | Queue/R2 employee CSV; sync formats capped |
| global QR callbacks | scanner setup | `attendance/scanner.js`, jsQR injected only after camera action |
| global session shell | nav, logout, language, focus | `src/shared/ui/route-shell.js` |
| broad styles.css | all legacy screens | route-level feature CSS for migrated routes |

Remaining global symbols and import-time side effects are intentionally not removed in this phase because secondary route behavior still depends on them. `check:legacy-monolith` fails if a priority route loses its split entry.
