export type CallApi = <T>(
  endpoint: string,
  options?: RequestInit,
) => Promise<T>;
