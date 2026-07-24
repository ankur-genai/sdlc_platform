import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, RotateCw } from 'lucide-react';

interface PreviewFile {
  path: string;
  name: string;
  content: string;
  language: string;
}

interface LivePreviewFrameProps {
  files: PreviewFile[];
}

// The sandbox has no bundler or module resolver — it only ever loads
// React/ReactDOM (as UMD globals, see the injected HTML below). A generated
// entry file that imports a sibling local component (the normal case once
// an app is broken into real components, not a one-off) is handled by
// inlining that file's source directly rather than rejecting the whole
// preview — see resolveAndInline() below. Anything that isn't React itself
// or a resolvable local file (a real npm package) is still outside what
// this mechanism can do, and falls back to the graceful error state.
// axios is included alongside React/ReactDOM because it's the single most
// common HTTP client generated frontend code calls a backend through — its
// UMD build assigns the same `axios` global that `import axios from 'axios'`
// resolves to, so no special-casing is needed beyond loading the script.
//
// react-hook-form has no UMD/CDN build (it's bundler-only), so instead of a
// CDN script it gets a minimal same-name `useForm()` global defined directly
// in the iframe script below (see FORM_POLYFILL) — just enough of its API
// (register/handleSubmit/errors) for a generated form to render and submit
// in the sandbox, not a faithful reimplementation.
//
// recharts is included for chart-bearing generated apps (weather trends,
// banking/spend dashboards, currency-rate history). Verified against this
// exact sandbox (sandboxed iframe, UMD globals, no bundler) before wiring
// in — two real constraints apply, both enforced in the prompt that tells
// the LLM it's allowed to use this library (agents/frontend/prompts.py):
//   1. prop-types MUST load before the recharts script tag, or the
//      `Recharts` global itself never gets defined (verified: omitting it
//      throws "Recharts is not defined", not a lazier prop-types warning).
//   2. <ResponsiveContainer> renders nothing in this sandbox — its
//      ResizeObserver-based measurement never resolves here (verified: 0
//      SVG elements after render). Charts must use a fixed pixel
//      width/height instead (verified working that way).
const ALLOWED_IMPORT_SPECIFIERS = new Set(['react', 'react-dom', 'axios', 'react-hook-form', 'recharts', 'react-router-dom', 'react-router']);
const REACT_CDN = 'https://unpkg.com/react@18/umd/react.production.min.js';
const REACT_DOM_CDN = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js';
const AXIOS_CDN = 'https://unpkg.com/axios@1/dist/axios.min.js';
const PROP_TYPES_CDN = 'https://unpkg.com/prop-types@15/prop-types.min.js';
const RECHARTS_CDN = 'https://unpkg.com/recharts@2/umd/Recharts.js';

// A minimal same-name shim for react-hook-form's `useForm()` — covers the
// common pattern generated code uses (`register`, `handleSubmit`, `errors`/
// `formState.errors`), backed by a plain ref instead of react-hook-form's
// real uncontrolled-input machinery. Good enough to render and submit in
// the preview sandbox; not a substitute for the real library.
const FORM_POLYFILL = `
function useForm() {
  var storeRef = React.useRef({});
  var errors = {};
  function register(name) {
    return {
      name: name,
      onChange: function (e) { storeRef.current[name] = e && e.target ? e.target.value : e; },
      onBlur: function () {},
    };
  }
  function handleSubmit(onValid) {
    return function (e) {
      if (e && e.preventDefault) e.preventDefault();
      onValid(storeRef.current);
    };
  }
  function setValue(name, value) { storeRef.current[name] = value; }
  function watch() { return storeRef.current; }
  return { register: register, handleSubmit: handleSubmit, errors: errors, formState: { errors: errors }, watch: watch, setValue: setValue };
}
`;

// A minimal same-shape shim for react-router-dom v6 (BrowserRouter, Routes,
// Route, Link/NavLink, Navigate, Outlet, useNavigate, useLocation, useParams).
// Generated multi-page apps almost always wire navigation through react-router,
// which has no usable UMD/CDN build for this bundler-less sandbox — so the
// whole app would otherwise fail to render. This backs routing with in-memory
// React state (no real History API, which a sandboxed iframe can't use anyway)
// so the generated app's pages and links actually navigate in the preview and
// its overall flow can be exercised. Not a faithful reimplementation: nested
// routes/loaders/data APIs are only minimally handled.
const ROUTER_POLYFILL = `
var __RouterContext = React.createContext({ path: '/', navigate: function () {} });
function __matchPath(routePath, currentPath) {
  if (routePath == null) return null;
  if (routePath === '*') return { params: {} };
  var rp = String(routePath).replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
  var cp = String(currentPath).replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
  var params = {};
  for (var i = 0; i < rp.length; i++) {
    if (rp[i] === '*') return { params: params };
    if (cp[i] == null) return null;
    if (rp[i].charAt(0) === ':') { params[rp[i].slice(1)] = decodeURIComponent(cp[i]); continue; }
    if (rp[i] !== cp[i]) return null;
  }
  if (rp.length !== cp.length) return null;
  return { params: params };
}
function BrowserRouter(props) {
  var state = React.useState('/');
  var path = state[0], setPath = state[1];
  var navigate = React.useCallback(function (to) {
    if (typeof to === 'number') return;
    var next = typeof to === 'string' ? to : (to && to.pathname) || '/';
    setPath(next);
  }, []);
  // Expose navigate so the global anchor-click interceptor (below) can route
  // plain <a href="/path"> links through this in-memory router.
  React.useEffect(function () { window.__previewNavigate = navigate; }, [navigate]);
  return React.createElement(__RouterContext.Provider, { value: { path: path, navigate: navigate } }, props.children);
}
var HashRouter = BrowserRouter, MemoryRouter = BrowserRouter, Router = BrowserRouter;
function useNavigate() { return React.useContext(__RouterContext).navigate; }
function useLocation() { var p = React.useContext(__RouterContext).path; return { pathname: p, search: '', hash: '', state: null, key: 'default' }; }
function useParams() {
  var ctx = React.useContext(__RouterContext);
  var kids = ctx.__routeMatchParams || {};
  return kids;
}
function Routes(props) {
  var ctx = React.useContext(__RouterContext);
  var children = React.Children.toArray(props.children);
  var routes = [];
  var fallback = null;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (!child || !child.props) continue;
    var el = child.props.element || null;
    if (child.props.index) { routes.push({ path: '/', element: el }); continue; }
    var rpath = child.props.path;
    if (rpath === '*') { fallback = el; continue; }
    if (rpath == null) continue;
    routes.push({ path: rpath, element: el });
  }
  // Resolve which route to show: first concrete match, else the wildcard,
  // else default to the FIRST route. That default is what stops a routed app
  // (whose routes are e.g. /login and /register, none matching the initial
  // '/') from rendering a blank preview — it shows the first screen instead.
  var matched = null, matchedParams = {};
  for (var j = 0; j < routes.length; j++) {
    var mm = __matchPath(routes[j].path, ctx.path);
    if (mm) { matched = routes[j].element; matchedParams = mm.params; break; }
  }
  if (matched == null) {
    if (fallback != null) matched = fallback;
    else if (routes.length) matched = routes[0].element;
  }
  var body = (matchedParams && Object.keys(matchedParams).length)
    ? React.createElement(__RouterContext.Provider, { value: Object.assign({}, ctx, { __routeMatchParams: matchedParams }) }, matched)
    : matched;
  // Auto nav across every route so the COMPLETE app flow can be walked in the
  // preview even when the generated app defines no links of its own.
  if (routes.length > 1) {
    var nav = React.createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', position: 'sticky', top: 0, zIndex: 1000 } },
      routes.map(function (r, idx) {
        var active = __matchPath(r.path, ctx.path) != null;
        var target = r.path.replace(/:[^/]+/g, '1');
        return React.createElement('button', {
          key: idx,
          onClick: function () { ctx.navigate(target); },
          style: { fontSize: '12px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid ' + (active ? '#111' : '#d1d5db'), background: active ? '#111' : '#fff', color: active ? '#fff' : '#111' }
        }, r.path);
      })
    );
    return React.createElement('div', null, nav, body);
  }
  return body;
}
function Route() { return null; }
function Link(props) {
  var ctx = React.useContext(__RouterContext);
  var to = typeof props.to === 'string' ? props.to : (props.to && props.to.pathname) || '/';
  var rest = Object.assign({}, props);
  delete rest.to; delete rest.replace; delete rest.state; delete rest.end;
  return React.createElement('a', Object.assign({}, rest, {
    href: '#' + to,
    onClick: function (e) { if (e && e.preventDefault) e.preventDefault(); ctx.navigate(to); if (props.onClick) props.onClick(e); }
  }), props.children);
}
var NavLink = Link;
function Navigate(props) {
  var ctx = React.useContext(__RouterContext);
  React.useEffect(function () { ctx.navigate(props.to); }, []);
  return null;
}
function Outlet() { return null; }

// Generated screens often cross-link with a plain <a href="/route"> instead of
// react-router's <Link>. Inside this sandboxed srcdoc iframe such a click does
// a REAL navigation to a page that doesn't exist -> blank white screen. Route
// those internal links through the in-memory router instead (and if there's no
// router, just cancel them so the preview never blanks out).
if (!window.__previewNavClickBound) {
  window.__previewNavClickBound = true;
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || a.getAttribute('target') === '_blank') return;
    var path = null;
    if (href.charAt(0) === '/' && href.charAt(1) !== '/') path = href;
    else if (href.charAt(0) === '#' && href.charAt(1) === '/') path = href.slice(1);
    if (path == null) return;
    e.preventDefault();
    if (typeof window.__previewNavigate === 'function') window.__previewNavigate(path);
  }, true);
  // Forms need 'allow-forms' for the submit event to fire in the sandbox, but
  // native submission would then navigate the srcdoc iframe to a dead URL and
  // blank the preview. Cancel the native submit in the capture phase (before
  // it navigates); React's own onSubmit handler still runs in the bubble
  // phase — preventDefault doesn't stop propagation — so the app's submit
  // logic (validation, POST, confirmation) executes normally.
  document.addEventListener('submit', function (e) { if (e && e.preventDefault) e.preventDefault(); }, true);
}
`;

// Produces an inert, universal stub for any identifier imported from a
// package/file the sandbox can't load, so the generated app renders as a
// mockup instead of crashing. The stub works in every position generated
// code uses an unknown import: as a React component (renders its children,
// or nothing), as a called function (returns another stub), as a namespace
// object (any property access returns a nested stub), and as a constructor.
const STUB_FACTORY = `
function __makeStub(name) {
  var fn = function (props) {
    return props && props.children != null ? props.children : null;
  };
  fn.displayName = name;
  return new Proxy(fn, {
    get: function (target, prop) {
      if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag || prop === 'toString' || prop === 'valueOf') {
        return function () { return ''; };
      }
      if (prop === '$$typeof' || prop === 'prototype') return target[prop];
      if (prop in target) return target[prop];
      return __makeStub(name + '.' + String(prop));
    },
    apply: function () { return __makeStub(name); },
    construct: function () { return {}; }
  });
}
`;

// An in-browser mock backend so the generated app's HTTP calls actually work
// in the preview — turning it into a real simulator where cross-screen flows
// persist (e.g. sign up, then log in with those very credentials). It replaces
// the sandbox's `axios` and `window.fetch` with implementations backed by an
// in-memory store that lives for the life of the preview. Endpoints are matched
// by keyword (register/login/logout/…), not exact path, so it works across the
// many URL shapes generated code uses.
const MOCK_BACKEND = `
var __db = { users: [], store: {} };
function __idOf(b) { b = b || {}; return b.email || b.username || b.user || b.userName || b.phone || b.mobile || b.id || ''; }
function __clean(u) { var c = {}; for (var k in u) { if (k !== 'password' && k !== 'confirmPassword' && k !== 'passwordConfirm') c[k] = u[k]; } return c; }
function __rid() { return 'REF-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 9000 + 1000); }
// True for keys that look like an id / reference / ticket / tracking number,
// regardless of the exact name generated code invents (grievanceId, orderNo,
// referenceNumber, caseId, confirmationNumber, …).
function __looksLikeIdKey(k) {
  if (/^(id|_id|uuid|guid|token)$/i.test(k)) return true;
  if (/(_id|Id|ID)$/.test(k)) return true;
  if (/(reference|ticket|tracking|confirmation)/i.test(k)) return true;
  if (/(number|no|code)$/i.test(k) && /(ref|ticket|track|confirm|order|griev|case|request|applic|booking|invoice|payment|transaction|complaint)/i.test(k)) return true;
  return false;
}
// Wraps a created-resource payload so ANY id-like property the app reads
// resolves to the generated id — a fixed alias list can never anticipate the
// exact field name (id vs grievanceId vs referenceNumber vs ...).
function __wrapIds(data, id) {
  return new Proxy(data, { get: function (t, prop) {
    if (prop in t) return t[prop];
    if (typeof prop === 'string' && __looksLikeIdKey(prop)) return id;
    return undefined;
  } });
}
// A generic "resource created" response carrying an id under every common
// alias (for JSON serialization) AND, via __wrapIds, under any id-like key the
// confirmation screen happens to read.
function __created(body) {
  var id = __rid();
  var data = Object.assign({
    success: true, id: id, _id: id, referenceNumber: id, reference: id,
    ticketId: id, ticketNumber: id, trackingId: id, trackingNumber: id,
    confirmationNumber: id, number: id, grievanceId: id, complaintId: id,
    orderId: id, bookingId: id, caseId: id, requestId: id, applicationId: id,
    transactionId: id, message: 'Submitted successfully.',
    createdAt: new Date().toISOString()
  }, body || {});
  return { status: 201, data: __wrapIds(data, id) };
}
function __route(method, url, body) {
  method = String(method || 'GET').toUpperCase();
  url = String(url || '').toLowerCase();
  body = body || {};
  var isReg = /(register|signup|sign-up|sign_up|\\/users\\b|account\\b|create-user|createuser)/.test(url);
  var isLogin = /(login|signin|sign-in|sign_in|authenticate|\\bauth\\b|token|session)/.test(url);
  var isLogout = /logout|sign-?out/.test(url);
  var id = __idOf(body);
  if (method === 'POST' && isReg && !isLogin) {
    if (!id) return { status: 400, data: { message: 'Email or username is required.' } };
    for (var i = 0; i < __db.users.length; i++) { if (__idOf(__db.users[i]) === id) return { status: 409, data: { message: 'An account with these details already exists. Please log in.' } }; }
    var uid = __rid();
    __db.users.push(Object.assign({ id: uid }, body));
    return { status: 201, data: __wrapIds({ success: true, id: uid, userId: uid, token: 'mock-jwt-token', user: __clean(Object.assign({ id: uid }, body)), message: 'Account created successfully. You can now log in.' }, uid) };
  }
  if (method === 'POST' && (isLogin || isLogout)) {
    if (isLogout) return { status: 200, data: { success: true, message: 'Logged out.' } };
    var match = null, idExists = false;
    for (var j = 0; j < __db.users.length; j++) {
      if (__idOf(__db.users[j]) === id) { idExists = true; if ((__db.users[j].password || '') === (body.password || '')) { match = __db.users[j]; break; } }
    }
    if (match) return { status: 200, data: { success: true, token: 'mock-jwt-token', user: __clean(match), message: 'Login successful.' } };
    if (idExists) return { status: 401, data: { message: 'Incorrect password. Please try again.' } };
    return { status: 401, data: { message: 'No account found for these details. Please sign up first.' } };
  }
  if (method === 'GET') {
    if (/users/.test(url)) return { status: 200, data: __db.users.map(__clean) };
    var stored = __db.store[url];
    if (Array.isArray(stored)) return { status: 200, data: stored };
    if (/(list|items|all|products|orders|transactions|accounts|history|notifications|messages|posts|records|results|data)\\b|s$/.test(url)) return { status: 200, data: [] };
    return { status: 200, data: stored || {} };
  }
  if (method === 'POST') {
    // Any other POST is a resource creation (submit grievance, create ticket,
    // place order, …) — persist it and return a created record with an id so
    // the app's confirmation/success screen actually appears.
    var list = __db.store[url] = __db.store[url] || [];
    var res = __created(body);
    if (Array.isArray(list)) list.push(res.data);
    return res;
  }
  if (method === 'DELETE') return { status: 200, data: { success: true } };
  __db.store[url] = body;
  return { status: 200, data: Object.assign({ success: true }, body) };
}
function __normBody(d) { if (d == null) return {}; if (typeof d === 'string') { try { return JSON.parse(d); } catch (e) { return {}; } } return d; }
function __axiosResult(cfg) {
  var res = __route(cfg.method, cfg.url, cfg.data);
  var payload = { data: res.data, status: res.status, statusText: res.status >= 400 ? 'Error' : 'OK', headers: {}, config: cfg };
  if (res.status >= 400) {
    var err = new Error((res.data && res.data.message) || ('Request failed with status ' + res.status));
    err.response = payload; err.isAxiosError = true;
    return Promise.reject(err);
  }
  return Promise.resolve(payload);
}
function __mkAxios() {
  function ax(cfg) { cfg = cfg || {}; return __axiosResult({ method: cfg.method || 'GET', url: cfg.url || '', data: __normBody(cfg.data) }); }
  ['get', 'delete', 'head', 'options'].forEach(function (m) { ax[m] = function (url) { return __axiosResult({ method: m, url: url, data: {} }); }; });
  ['post', 'put', 'patch'].forEach(function (m) { ax[m] = function (url, data) { return __axiosResult({ method: m, url: url, data: __normBody(data) }); }; });
  ax.request = ax;
  ax.create = function () { return __mkAxios(); };
  ax.defaults = { headers: { common: {}, post: {}, get: {} }, baseURL: '' };
  ax.interceptors = { request: { use: function () {}, eject: function () {} }, response: { use: function () {}, eject: function () {} } };
  ax.all = function (ps) { return Promise.all(ps); };
  ax.spread = function (cb) { return function (arr) { return cb.apply(null, arr); }; };
  ax.isAxiosError = function (e) { return !!(e && e.isAxiosError); };
  return ax;
}
var axios = __mkAxios();
window.axios = axios;
window.fetch = function (url, opts) {
  opts = opts || {};
  var res = __route(opts.method || 'GET', typeof url === 'string' ? url : (url && url.url) || '', __normBody(opts.body));
  return Promise.resolve({
    ok: res.status < 400, status: res.status, statusText: res.status >= 400 ? 'Error' : 'OK',
    json: function () { return Promise.resolve(res.data); },
    text: function () { return Promise.resolve(JSON.stringify(res.data)); },
    headers: { get: function () { return 'application/json'; } }
  });
};
`;

// The generated `name` field is inconsistent about carrying a file extension
// (some files arrive as "Foo", others as "Foo.tsx"); the `path` reliably has
// it. These helpers derive the extension/basename from whichever is present so
// an extensionless .tsx file is never silently dropped from the preview.
function effectiveBaseName(f: PreviewFile): string {
  const nameHasExt = /\.(tsx|jsx|ts|js)$/i.test(f.name);
  const source = nameHasExt ? f.name : ((f.path || '').split('/').pop() || f.name);
  return source.toLowerCase();
}

function isJsFamilyFile(f: PreviewFile): boolean {
  return /\.(tsx|jsx|js)$/i.test(f.name) || /\.(tsx|jsx|js)$/i.test(f.path || '');
}

function pickEntryFile(files: PreviewFile[]): PreviewFile | null {
  if (!files.length) return null;
  const byName = (name: string) => files.find((f) => effectiveBaseName(f) === name);
  // Generated React files commonly use a plain .js extension even when the
  // content is JSX (seen in practice) — so the fallback below matches any
  // JS-family file, not just .tsx/.jsx, and picks the one that actually
  // looks like a component (contains JSX-like markup), preferring the
  // largest such file as the most likely top-level page/entry.
  return (
    byName('app.tsx') || byName('app.jsx') || byName('app.js') ||
    [...files]
      .filter((f) => isJsFamilyFile(f) && looksLikeComponentSource(f.content))
      .sort((a, b) => b.content.length - a.content.length)[0] ||
    null
  );
}

// Extracts the bound identifier names from an import clause (the text between
// `import` and `from`), covering the default, namespace and named forms:
//   import Foo from 'x'                 -> ['Foo']
//   import * as NS from 'x'             -> ['NS']
//   import { A, B as C } from 'x'       -> ['A', 'C']
//   import Foo, { A } from 'x'          -> ['Foo', 'A']
// Used to stub-declare identifiers that come from packages this bundler-less
// sandbox can't load, so the generated app still renders as a mockup instead
// of failing outright.
function extractImportBindings(clause: string): string[] {
  const bindings: string[] = [];
  const ns = clause.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
  if (ns) bindings.push(ns[1]);
  const named = clause.match(/\{([\s\S]*?)\}/);
  if (named) {
    for (const part of named[1].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const asMatch = seg.match(/\bas\s+([A-Za-z_$][\w$]*)/);
      bindings.push(asMatch ? asMatch[1] : seg.split(/\s+/)[0]);
    }
  }
  const def = clause.match(/^\s*([A-Za-z_$][\w$]*)\s*(,|$)/);
  if (def) bindings.push(def[1]);
  return bindings.filter((b) => b && b !== 'type');
}

// Strips import/export statements (the sandbox has no module resolver) and
// splits import specifiers into relative (local, e.g. "./components/Foo" —
// resolvable by inlining a sibling generated file) vs. everything else.
// Imports from packages that are neither on the CDN allowlist nor a local
// generated file are no longer fatal: their bound identifiers are collected
// (per spec for local, flat for external) so the preview can stub them and
// still render the app as a mockup simulator.
//
// `__PreviewEntry__` aliasing only applies to the top-level entry file:
// every generated component file typically has its own `export default`,
// and once multiple files are concatenated into one script (see
// resolveAndInline below), aliasing every one of them to the same
// `__PreviewEntry__` name would redeclare it and throw a SyntaxError. A
// dependency file's default export is dropped outright instead — the
// component it refers to is already usable by its own name from earlier in
// that same file (e.g. `const Foo = () => {...}; export default Foo;`).
function parseModuleSyntax(source: string, isEntry: boolean): { code: string; localSpecs: string[]; localBindings: Record<string, string[]>; externalStubs: string[] } {
  const localSpecs: string[] = [];
  const localBindings: Record<string, string[]> = {};
  const externalStubs: string[] = [];
  let code = source.replace(/^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, (_match, clause: string, spec: string) => {
    if (spec.startsWith('.')) {
      localSpecs.push(spec);
      localBindings[spec] = extractImportBindings(clause);
    } else if (!ALLOWED_IMPORT_SPECIFIERS.has(spec)) {
      externalStubs.push(...extractImportBindings(clause));
    }
    return '';
  });
  code = code.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '');
  code = code.replace(/export\s+default\s+function\s+(\w+)/, 'function $1');
  code = isEntry
    ? code.replace(/export\s+default\s+/, 'const __PreviewEntry__ = ')
    : code.replace(/^\s*export\s+default\s+\w+;\s*$/gm, '');
  code = code.replace(/^\s*export\s+(const|function|class)\s+/gm, '$1 ');
  return { code, localSpecs, localBindings, externalStubs };
}

function specBaseName(spec: string): string {
  const parts = spec.split('/');
  return parts[parts.length - 1].replace(/\.(tsx|jsx|ts|js)$/i, '');
}

function findLocalFile(files: PreviewFile[], spec: string): PreviewFile | undefined {
  const base = specBaseName(spec).toLowerCase();
  const strip = (s: string) => s.replace(/\.(tsx|jsx|ts|js)$/i, '').toLowerCase();
  // Match on the file name OR the path's basename — the generated `name` may
  // arrive without an extension (or differ from the on-disk path), so relying
  // on name alone can miss the imported file.
  return files.find((f) => {
    const pathBase = (f.path || '').split('/').pop() || '';
    return strip(f.name) === base || strip(pathBase) === base;
  });
}

// Recursively inlines the entry file's local sibling-component imports
// Extracts the main component identifier a file defines/exports, so it can be
// wired into the whole-app flow navigator below.
function componentNameOf(source: string): string | null {
  const m =
    source.match(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/) ||
    source.match(/export\s+default\s+([A-Z][\w$]*)\s*;?/) ||
    source.match(/(?:export\s+)?(?:const|function)\s+([A-Z][\w$]*)/);
  return m ? m[1] : null;
}

function looksLikeComponentSource(content: string): boolean {
  // JSX presence — a closing tag, a self-closing element, or a fragment —
  // signals a component. This deliberately does NOT require an explicit
  // `return (`: implicit-return arrow components (`const Login = () => (
  // <div/> )`), which generated .tsx screens frequently use, would otherwise
  // be missed while explicit-return .jsx screens rendered — the exact reason
  // some screens went absent from the preview.
  const hasJsx =
    /<\/[A-Za-z][\w.]*>/.test(content) ||
    /<[A-Za-z][\w.]*(?:\s[^<>]*)?\/>/.test(content) ||
    /<>[\s\S]*<\/>/.test(content);
  const definesComponent = /(?:export\s+default|(?:export\s+)?(?:function|const|class)\s+[A-Z])/.test(content);
  return hasJsx && definesComponent;
}

// A page/screen-level file (as opposed to a small reusable widget) — used to
// decide which components become top-level tabs in the flow navigator.
function isPageLike(file: PreviewFile): boolean {
  const p = `${file.path}/${file.name}`.toLowerCase();
  if (/(?:^|\/)(pages?|screens?|views?|routes?)\//.test(p)) return true;
  const base = ((file.path || '').split('/').pop() || file.name).replace(/\.(tsx|jsx|ts|js)$/i, '');
  return /(page|screen|view)$/i.test(base) || /(page|screen|view)$/i.test(file.name);
}

// (dependencies first) into one combined source, so the generated app's
// real component tree — not just a single flat file — can render in the
// sandbox. Imports that can't be resolved (a genuine external package, or a
// local import with no matching generated file) are not fatal: their bound
// identifiers are returned in `stubNames` so the preview can declare inert
// stubs for them and still render the app as a mockup simulator.
//
// Beyond the entry's own import graph, every OTHER page/screen-level file is
// also inlined and returned in `pageComponents`, so the preview can offer a
// simple navigator across the complete set of generated screens — simulating
// the full application flow, not just whatever the entry happens to import.
function resolveAndInline(entry: PreviewFile, files: PreviewFile[]): { combinedCode: string; stubNames: string[]; pageComponents: string[] } {
  const visited = new Set<string>();
  const blocks: string[] = [];
  const stubNames = new Set<string>();
  const declaredComponents = new Set<string>();
  const pageComponents: string[] = [];

  function visit(file: PreviewFile) {
    if (visited.has(file.name)) return;
    visited.add(file.name);
    const { code, localSpecs, localBindings, externalStubs } = parseModuleSyntax(file.content, file.name === entry.name);
    externalStubs.forEach((n) => stubNames.add(n));
    for (const spec of localSpecs) {
      const dep = findLocalFile(files, spec);
      if (dep) visit(dep);
      else (localBindings[spec] || []).forEach((n) => stubNames.add(n));
    }
    blocks.push(code);
    const cname = componentNameOf(file.content);
    if (cname) declaredComponents.add(cname);
  }

  visit(entry);

  // Inline every remaining page/screen-level component so the whole flow can
  // be navigated, skipping any whose component name is already declared (a
  // redeclaration would break the concatenated sandbox script).
  for (const f of files) {
    if (visited.has(f.name)) continue;
    if (!isJsFamilyFile(f)) continue;
    if (!looksLikeComponentSource(f.content) || !isPageLike(f)) continue;
    const cname = componentNameOf(f.content);
    if (!cname || declaredComponents.has(cname)) continue;
    visit(f);
    pageComponents.push(cname);
  }

  return { combinedCode: blocks.join('\n\n'), stubNames: [...stubNames], pageComponents };
}

export function LivePreviewFrame({ files }: LivePreviewFrameProps) {
  const [error, setError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [canOpenDemo, setCanOpenDemo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Holds the last successfully-compiled full-page HTML so the demo can be
  // popped out into its own browser tab (served from a blob URL that carries
  // this app's own IP:port origin).
  const previewHtmlRef = useRef<string>('');

  // `files` arrives freshly parsed (JSON.parse'd from the artifact) on every
  // render of the parent — a new array/object reference each time even when
  // the underlying generated code hasn't changed at all. Deriving a
  // content-based string signature and keying the memo/effect below on that
  // (instead of on `files`/`entryFile` object identity) makes them skip
  // recomputation whenever the actual content is unchanged: JS compares
  // strings by value, not reference, so two independently-parsed-but-
  // identical `files` arrays produce the exact same signature string.
  // Without this, the iframe's `srcdoc` was being reassigned (reloading the
  // whole preview, wiping focus/typed state) on almost every parent
  // re-render — confirmed via a load-event counter firing dozens of times
  // per second — which is what made the preview look "rendered but
  // uninteractive": a click or keystroke lands, then the frame reloads out
  // from under it before the next paint.
  const filesSignature = useMemo(
    () => files.map((f) => `${f.name}:${f.content}`).join(' '),
    [files]
  );
  const entryFile = useMemo(() => pickEntryFile(files), [filesSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (!entryFile || !iframeRef.current) return;

    const { combinedCode: code, stubNames, pageComponents } = resolveAndInline(entryFile, files);

    // Stub-declare every identifier that came from a package/local file the
    // sandbox couldn't resolve — but never shadow something the combined code
    // already declares itself. This is what turns the preview into a resilient
    // mockup simulator: unknown UI/util imports render as inert placeholders
    // instead of throwing a ReferenceError and blanking the whole app.
    const declared = new Set<string>();
    const declRe = /\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
    let declMatch: RegExpExecArray | null;
    while ((declMatch = declRe.exec(code)) !== null) declared.add(declMatch[1]);
    const stubDecls = stubNames
      .filter((n) => !declared.has(n))
      .map((n) => `var ${n} = __makeStub(${JSON.stringify(n)});`)
      .join('\n');

    setCompiling(true);
    // Loaded lazily so pages that never render a live preview don't pay for
    // Babel's bundle size.
    import('@babel/standalone')
      .then((Babel) => {
        if (cancelled) return;
        let transformed: string;
        try {
          // runtime: 'classic' is required here — the default "automatic"
          // JSX runtime emits `import { jsx as _jsx } from "react/jsx-runtime"`,
          // which this module-less sandboxed iframe (no bundler, no import
          // resolution) cannot load. Classic emits plain
          // `React.createElement(...)` calls against the UMD `React`
          // global loaded below instead.
          transformed = Babel.transform(code, {
            presets: [['react', { runtime: 'classic' }], 'typescript'],
            filename: 'preview.tsx',
          }).code || '';
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to compile the generated component for preview');
          setCompiling(false);
          return;
        }

        const entryMatch = entryFile.content.match(/function\s+(\w+)\s*\(/);
        const entryName = /const __PreviewEntry__/.test(transformed) ? '__PreviewEntry__' : (entryMatch?.[1] || 'App');

        // When the generated app has multiple page/screen components, wrap them
        // in a lightweight top-nav navigator so the reviewer can click through
        // the COMPLETE flow of every screen — not just the single entry view.
        // Built with React.createElement (not JSX) so it needs no transform and
        // dodges JSX tag-casing rules for the synthetic identifiers.
        let rootName = entryName;
        let navigatorJs = '';
        if (pageComponents.length > 0) {
          const pushes = [
            `if (typeof ${entryName} !== 'undefined') __tabs.push({ label: 'App', comp: ${entryName} });`,
            ...pageComponents.map(
              (n) => `if (typeof ${n} !== 'undefined') __tabs.push({ label: ${JSON.stringify(n)}, comp: ${n} });`,
            ),
          ].join('\n    ');
          navigatorJs = `
  function __PreviewApp__() {
    var __tabs = [];
    ${pushes}
    var __st = React.useState(0);
    var __i = __st[0] < __tabs.length ? __st[0] : 0, __setI = __st[1];
    if (!__tabs.length) return null;
    var __nav = React.createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', position: 'sticky', top: 0, zIndex: 1000 } },
      __tabs.map(function (t, idx) {
        return React.createElement('button', {
          key: idx,
          onClick: function () { __setI(idx); },
          style: { fontSize: '12px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid ' + (idx === __i ? '#111' : '#d1d5db'), background: idx === __i ? '#111' : '#fff', color: idx === __i ? '#fff' : '#111' }
        }, t.label);
      })
    );
    var __Cur = __tabs[__i] && __tabs[__i].comp;
    var __body = React.createElement('div', null, __Cur ? React.createElement(__Cur) : null);
    return React.createElement('div', null, __nav, __body);
  }`;
          rootName = '__PreviewApp__';
        }

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#fff;color:#111}#root{padding:16px}</style>
<script src="${REACT_CDN}"></script>
<script src="${REACT_DOM_CDN}"></script>
<script src="${AXIOS_CDN}"></script>
<script src="${PROP_TYPES_CDN}"></script>
<script src="${RECHARTS_CDN}"></script>
</head><body>
<div id="root"></div>
<script>
window.onerror = function (message) {
  parent.postMessage({ __livePreviewError: String(message) }, '*');
};
try {
  const { useState, useEffect, useReducer, useMemo, useCallback, useRef, Fragment } = React;
  // Destructured so named imports from 'recharts' (stripped by
  // parseModuleSyntax like every other allowed specifier) resolve as plain
  // identifiers in the transformed code below. ResponsiveContainer is
  // intentionally included even though it doesn't render in this sandbox —
  // omitting it would turn an LLM-generated ResponsiveContainer usage into a
  // ReferenceError instead of a silently-empty chart area.
  const {
    LineChart, BarChart, AreaChart, PieChart, RadarChart,
    Line, Bar, Area, Pie, Cell, Radar,
    XAxis, YAxis, CartesianGrid, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Tooltip, Legend, ResponsiveContainer,
  } = Recharts;
  ${FORM_POLYFILL}
  ${ROUTER_POLYFILL}
  ${STUB_FACTORY}
  ${MOCK_BACKEND}
  ${stubDecls}
  ${transformed}
  ${navigatorJs}
  const Entry = typeof ${rootName} !== 'undefined' ? ${rootName} : null;
  if (!Entry) throw new Error('No component found to render in the generated entry file');
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(Entry));
} catch (err) {
  parent.postMessage({ __livePreviewError: String((err && err.message) || err) }, '*');
}
</script>
</body></html>`;

        if (iframeRef.current) iframeRef.current.srcdoc = html;
        previewHtmlRef.current = html;
        setCanOpenDemo(true);
        setCompiling(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load the preview compiler');
        setCompiling(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally
    // keyed on the content-based signature, not `entryFile`'s object
    // identity; see the comment above `filesSignature` for why.
  }, [filesSignature, reloadNonce]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && '__livePreviewError' in event.data) {
        setError(String((event.data as { __livePreviewError: unknown }).__livePreviewError));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Pop the fully-compiled demo out into its own browser tab. The blob URL is
  // created on this app's own origin, so the new tab opens at the current
  // IP:port (e.g. http://10.0.16.227:5173) rather than a throwaway host —
  // letting the whole generated app be demoed full-screen in a separate tab.
  const openDemoInNewTab = () => {
    const html = previewHtmlRef.current;
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      URL.revokeObjectURL(url);
      return;
    }
    // Release the object URL once the new tab has had time to load it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  if (!entryFile) {
    return (
      <div className="rounded-lg border border-dark-border bg-dark-bg p-6 text-center h-[360px] flex items-center justify-center">
        <p className="text-xs text-text-muted">No frontend entry component generated yet.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dark-border bg-dark-bg p-6 text-center h-[360px] flex flex-col items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-status-warning mb-2" />
        <p className="text-sm text-text-primary font-medium">Build validated — live preview unavailable</p>
        <p className="text-[11px] text-text-muted mt-1 max-w-md break-words">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-dark-border overflow-hidden">
      {/* Browser-style toolbar so the preview reads as a running app. */}
      <div className="flex items-center gap-2 border-b border-dark-border bg-dark-card px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-status-error/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-status-warning/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-status-success/60" />
        </div>
        <div className="flex-1 mx-2 truncate rounded bg-dark-bg px-2 py-1 text-[10px] text-text-muted font-mono">
          {typeof window !== 'undefined' ? window.location.host : 'localhost'} — {entryFile.name}
        </div>
        <button
          onClick={openDemoInNewTab}
          disabled={!canOpenDemo}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-text-muted hover:text-text-primary hover:bg-dark-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Open the complete demo in a new browser tab"
        >
          <ExternalLink className="h-3 w-3" />
          Open Demo
        </button>
        <button
          onClick={() => setReloadNonce((n) => n + 1)}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-text-muted hover:text-text-primary hover:bg-dark-bg transition-colors"
          title="Reload preview"
        >
          <RotateCw className={`h-3 w-3 ${compiling ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="relative">
        {compiling && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/60 z-10">
            <Loader2 className="h-5 w-5 text-ey-yellow animate-spin" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="Live Preview"
          sandbox="allow-scripts allow-modals allow-forms"
          className="w-full h-[440px] bg-white"
        />
      </div>
    </div>
  );
}
