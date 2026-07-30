export const BASE_PATH = "/ZcyWorkBench";
export const LOWERCASE_BASE_PATH = BASE_PATH.toLowerCase();

export function withBasePath(path: string) {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export function canonicalizeBasePath(pathname: string) {
  if (pathname === BASE_PATH) {
    return `${BASE_PATH}/`;
  }

  if (
    pathname === LOWERCASE_BASE_PATH ||
    pathname.startsWith(`${LOWERCASE_BASE_PATH}/`)
  ) {
    return `${BASE_PATH}${pathname.slice(LOWERCASE_BASE_PATH.length) || "/"}`;
  }

  return null;
}
