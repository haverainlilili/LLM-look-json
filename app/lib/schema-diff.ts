import type { SchemaField } from "./dataset.ts";

export interface SchemaTypeChange {
  path: string;
  before: string[];
  after: string[];
}

export interface SchemaDifference {
  changed: boolean;
  added: string[];
  removed: string[];
  typeChanges: SchemaTypeChange[];
}

function normalizedTypes(field: SchemaField): string[] {
  return [...new Set(field.types)].sort();
}

export function compareSchemaStructure(
  before: SchemaField[],
  after: SchemaField[],
): SchemaDifference {
  const beforeByPath = new Map(before.map((field) => [field.path, normalizedTypes(field)]));
  const afterByPath = new Map(after.map((field) => [field.path, normalizedTypes(field)]));
  const added = [...afterByPath.keys()]
    .filter((path) => !beforeByPath.has(path))
    .sort();
  const removed = [...beforeByPath.keys()]
    .filter((path) => !afterByPath.has(path))
    .sort();
  const typeChanges = [...beforeByPath.entries()]
    .flatMap(([path, previousTypes]) => {
      const nextTypes = afterByPath.get(path);
      if (!nextTypes || previousTypes.join("\u0000") === nextTypes.join("\u0000")) return [];
      return [{ path, before: previousTypes, after: nextTypes }];
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    changed: added.length > 0 || removed.length > 0 || typeChanges.length > 0,
    added,
    removed,
    typeChanges,
  };
}
