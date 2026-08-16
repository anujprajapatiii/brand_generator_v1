export const STACK_ACTIONS = Object.freeze(['back', 'front', 'send-back', 'send-front']);

export function reorderStack(items, selectedId, action) {
  const ordered = [...items];
  const currentIndex = ordered.findIndex((item) => item.id === selectedId);
  if (currentIndex < 0 || !STACK_ACTIONS.includes(action)) return ordered;

  const lastIndex = ordered.length - 1;
  const targetIndex = {
    back: Math.max(0, currentIndex - 1),
    front: Math.min(lastIndex, currentIndex + 1),
    'send-back': 0,
    'send-front': lastIndex,
  }[action];

  if (targetIndex === currentIndex) return ordered;
  const [item] = ordered.splice(currentIndex, 1);
  ordered.splice(targetIndex, 0, item);
  return ordered;
}

export function getStackPosition(items, selectedId) {
  return {
    index: items.findIndex((item) => item.id === selectedId),
    count: items.length,
  };
}
