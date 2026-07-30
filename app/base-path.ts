export const BASE_PATH = "/ZcyWorkBench";

export function withBasePath(path: string) {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
