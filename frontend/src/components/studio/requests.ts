export async function requestJson<T>(path: string, init: RequestInit, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(path, init);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === 'string' ? error.detail : 'The service could not finish this request. Your work is unchanged. Please retry.');
  }
  return response.json();
}
