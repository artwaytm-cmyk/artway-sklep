import { isDeepStrictEqual } from 'node:util';

const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/**
 * Bufor zmian dla procesów, które przeglądają wiele produktów.
 *
 * Dawny mechanizm porównywał kartotekę PostgreSQL z pustym, migracyjnym
 * obiektem settings. W efekcie każda synchronizacja uznawała wszystkie pola
 * za zmienione i zapisywała setki produktów co kilkanaście minut. Ten bufor
 * porównuje z rzeczywistym rekordem centralnym, łączy kolejne poprawki tego
 * samego produktu i przekazuje writerowi wyłącznie faktyczną różnicę.
 */
export function createCentralProductPatchBuffer(products = new Map()) {
  const source = products instanceof Map ? products : new Map();
  const current = new Map([...source.entries()].map(([id, product]) => [String(id), asObject(product)]));
  const pending = new Map();

  const apply = (rawId, fields = {}, remove = []) => {
    const id = String(rawId ?? '').trim();
    const before = current.get(id);
    if (!id || !before) return false;
    const cleanFields = Object.fromEntries(
      Object.entries(asObject(fields)).filter(([, value]) => value !== undefined),
    );
    const removeFields = [...new Set(
      (Array.isArray(remove) ? remove : []).map((field) => String(field || '').trim()).filter(Boolean),
    )];
    const changedFields = Object.fromEntries(
      Object.entries(cleanFields).filter(([field, value]) => (
        !Object.prototype.hasOwnProperty.call(before, field)
        || !isDeepStrictEqual(before[field], value)
      )),
    );
    const changedRemovals = removeFields.filter((field) => Object.prototype.hasOwnProperty.call(before, field));
    if (!Object.keys(changedFields).length && !changedRemovals.length) return false;

    const next = { ...before, ...changedFields };
    for (const field of changedRemovals) delete next[field];
    current.set(id, next);
    source.set(id, next);

    const operation = pending.get(id) || { id, fields: {}, remove: new Set(), expectedFields: {} };
    for (const field of changedRemovals) {
      if (!Object.prototype.hasOwnProperty.call(operation.expectedFields, field)) {
        operation.expectedFields[field] = {
          present: Object.prototype.hasOwnProperty.call(before, field),
          value: before[field],
        };
      }
      operation.remove.add(field);
      delete operation.fields[field];
    }
    for (const [field, value] of Object.entries(changedFields)) {
      if (!Object.prototype.hasOwnProperty.call(operation.expectedFields, field)) {
        operation.expectedFields[field] = {
          present: Object.prototype.hasOwnProperty.call(before, field),
          value: before[field],
        };
      }
      operation.remove.delete(field);
      operation.fields[field] = value;
    }
    pending.set(id, operation);
    return true;
  };

  const operations = () => [...pending.values()].map((operation) => ({
    id: operation.id,
    fields: operation.fields,
    remove: [...operation.remove],
    expectedFields: operation.expectedFields,
  }));

  return {
    apply,
    operations,
    get size() { return pending.size; },
    get(id) { return current.get(String(id)); },
  };
}
