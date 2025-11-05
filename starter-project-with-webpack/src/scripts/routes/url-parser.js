function extractPathnameSegments(path) {
  const splitUrl = path.split('/');
  return { resource: splitUrl[1] || null, id: splitUrl[2] || null };
}

function constructRouteFromSegments(seg) {
  let p = '';
  if (seg.resource) p += `/${seg.resource}`;
  if (seg.id) p += '/:id';
  return p || '/';
}

export function getActivePathname() {
  const raw = window.location.hash || '#/';
  let path = raw.replace(/^#/, '');
  path = path.split('?')[0].split('#')[0];
  if (!path.startsWith('/')) path = '/' + path;
  if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

export function parseActivePathname() {
  return extractPathnameSegments(getActivePathname());
}

export function getRoute(pathname) {
  return constructRouteFromSegments(extractPathnameSegments(pathname));
}

export function parsePathname(pathname) {
  return extractPathnameSegments(pathname);
}

/* 👉 KHUSUS: kembalikan ELEMEN outlet, bukan path */
export function getActiveOutlet() {
  return document.querySelector('#main-content') || null;
}
