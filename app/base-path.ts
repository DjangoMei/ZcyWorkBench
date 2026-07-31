export const BASE_PATH = "/zcyworkbench";
export const LEGACY_BASE_PATH = "/ZcyWorkBench";

export function withBasePath(path: string) {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export function canonicalizeBasePath(pathname: string) {
  if (pathname === BASE_PATH) {
    return `${BASE_PATH}/`;
  }

  if (
    pathname === LEGACY_BASE_PATH ||
    pathname.startsWith(`${LEGACY_BASE_PATH}/`)
  ) {
    return `${BASE_PATH}${pathname.slice(LEGACY_BASE_PATH.length) || "/"}`;
  }

  return null;
}
