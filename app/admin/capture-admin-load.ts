export async function captureAdminLoad<T>(task: Promise<T>): Promise<
  | { data: T; error: null }
  | { data: null; error: unknown }
> {
  try {
    return { data: await task, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
