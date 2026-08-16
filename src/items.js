export function createDuplicateItem(source, itemNumber, position, label) {
  return {
    ...source,
    id: `${source.type}-${itemNumber}`,
    name: `${label} ${itemNumber}`,
    ...position,
    edges: { ...source.edges },
  };
}
