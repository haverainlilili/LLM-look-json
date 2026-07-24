export interface SessionTab<T> {
  id: string;
  value: T;
}

export interface SessionState<T> {
  tabs: SessionTab<T>[];
  activeId: string;
}

export function createSessionState<T>(firstTab: SessionTab<T>): SessionState<T> {
  return { tabs: [firstTab], activeId: firstTab.id };
}

export function addSession<T>(
  state: SessionState<T>,
  tab: SessionTab<T>,
): SessionState<T> {
  return {
    tabs: [...state.tabs.filter((current) => current.id !== tab.id), tab],
    activeId: tab.id,
  };
}

export function activateSession<T>(
  state: SessionState<T>,
  id: string,
): SessionState<T> {
  if (id === state.activeId || !state.tabs.some((tab) => tab.id === id)) return state;
  return { ...state, activeId: id };
}

export function updateSession<T>(
  state: SessionState<T>,
  id: string,
  update: (value: T) => T,
): SessionState<T> {
  if (!state.tabs.some((tab) => tab.id === id)) return state;
  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === id ? { ...tab, value: update(tab.value) } : tab,
    ),
  };
}

export function closeSession<T>(
  state: SessionState<T>,
  id: string,
): SessionState<T> {
  if (state.tabs.length === 1) return state;
  const closingIndex = state.tabs.findIndex((tab) => tab.id === id);
  if (closingIndex === -1) return state;

  const tabs = state.tabs.filter((tab) => tab.id !== id);
  if (state.activeId !== id) return { ...state, tabs };
  return {
    tabs,
    activeId: tabs[Math.min(closingIndex, tabs.length - 1)].id,
  };
}
