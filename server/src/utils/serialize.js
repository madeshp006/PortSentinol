export function serialize(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const id = obj.id || obj._id?.toString?.();
  if (obj._id) delete obj._id;
  if (obj.__v) delete obj.__v;
  return {
    ...obj,
    id,
  };
}

export function serializeMany(docs = []) {
  if (!Array.isArray(docs)) return [];
  return docs.map(serialize);
}
