export function deGenerateMaps<R, K>(g: Generator<Map<K, R>>): Map<K, R> {
  let entries: [K, R][] = [];
  let data;
  do {
    data = g.next();
    if (data.done) break;
    entries = [...entries, ...data.value.entries()];
  } while (!data?.done);

  const out = new Map(entries);
  return out;
}
