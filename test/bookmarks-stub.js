// Стаб chrome.bookmarks и storage.session для тестов панели, который ведёт себя как браузер:
// новые id по возрастанию, индекс move — «перед тем, кто сейчас на этом месте» (в той же папке
// ниже — на один меньше), remove непустой папки — ошибка.
export function makeChrome() {
  let next = 100;
  const nodes = new Map();
  const add = (id, parentId, props) => {
    const n = { id, parentId, title: props.title ?? '', ...(props.url ? { url: props.url } : { kids: [] }) };
    nodes.set(id, n);
    if (parentId) {
      const kids = nodes.get(parentId).kids;
      kids.splice(props.index ?? kids.length, 0, id);
    }
    return n;
  };
  add('0', null, {});
  add('1', '0', { title: 'Bar' });
  add('2', '0', { title: 'Other' });
  const indexOf = (n) => (n.parentId ? nodes.get(n.parentId).kids.indexOf(n.id) : 0);
  const plain = (n) => ({ id: n.id, parentId: n.parentId ?? undefined, index: indexOf(n), title: n.title, ...(n.url && { url: n.url }) });
  const tree = (n) => ({ ...plain(n), ...(n.kids && { children: n.kids.map(id => tree(nodes.get(id))) }) });
  const must = (id) => { const n = nodes.get(id); if (!n) throw new Error(`Can't find bookmark for id. ${id}`); return n; };
  const drop = (n) => { nodes.get(n.parentId).kids.splice(indexOf(n), 1); (function del(x) { nodes.delete(x.id); x.kids?.forEach(k => del(nodes.get(k))); })(n); };

  const session = {};
  const sessionListeners = [];
  const bookmarks = {
    async get(id) { return [plain(must(id))]; },
    async getChildren(id) { return must(id).kids.map(k => plain(nodes.get(k))); },
    async getSubTree(id) { return [tree(must(id))]; },
    async create({ parentId, index, title, url }) {
      const parent = must(parentId);
      if (index > parent.kids.length) throw new Error('Index out of bounds.');
      return plain(add(String(next++), parentId, { index, title, url }));
    },
    async move(id, { parentId, index }) {
      const n = must(id);
      const parent = must(parentId ?? n.parentId);
      for (let p = parent; p; p = nodes.get(p.parentId)) if (p.id === id) throw new Error('Can\'t move a folder into itself.');
      const old = indexOf(n);
      const same = n.parentId === parent.id;
      nodes.get(n.parentId).kids.splice(old, 1);
      let at = index ?? parent.kids.length;
      if (same && index !== undefined && old < index) at--;
      if (at > parent.kids.length) throw new Error('Index out of bounds.');
      parent.kids.splice(at, 0, id);
      n.parentId = parent.id;
      return plain(n);
    },
    async update(id, changes) { Object.assign(must(id), changes); return plain(must(id)); },
    async remove(id) { const n = must(id); if (n.kids?.length) throw new Error('Can\'t remove non-empty folder'); drop(n); },
    async removeTree(id) { drop(must(id)); },
  };
  const storage = {
    session: {
      async get(keys) {
        if (keys === null) return structuredClone(session);
        return Object.fromEntries([keys].flat().filter(k => k in session).map(k => [k, structuredClone(session[k])]));
      },
      async set(obj) {
        const changes = {};
        for (const [k, v] of Object.entries(obj)) { changes[k] = { newValue: structuredClone(v) }; session[k] = structuredClone(v); }
        sessionListeners.forEach(fn => fn(changes));
      },
      async remove(keys) {
        const changes = {};
        for (const k of [keys].flat()) if (k in session) { changes[k] = { oldValue: session[k] }; delete session[k]; }
        sessionListeners.forEach(fn => fn(changes));
      },
      onChanged: { addListener: (fn) => sessionListeners.push(fn) },
    },
  };
  // Дерево текстом: «Bar[A[a,b],c]»
  const show = (id = '1') => { const n = nodes.get(id); return n.url ? n.title : `${n.title}[${n.kids.map(k => show(k)).join(',')}]`; };
  const byTitle = (title) => [...nodes.values()].find(n => n.title === title)?.id;
  return { bookmarks, storage, session, show, byTitle, nodes };
}
