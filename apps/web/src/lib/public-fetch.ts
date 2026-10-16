/** Fetch công khai. Mất kết nối API thì trả null để trang vẫn render, không 500. */
export async function fetchPublic(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}
