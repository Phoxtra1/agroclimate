import { useState, useCallback } from "react";

const STORAGE_KEY = "agroclimate_visited_tabs";

function getVisited(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useNewTag() {
  const [visited, setVisited] = useState<string[]>(getVisited);

  const isNew = useCallback((id: string) => !visited.includes(id), [visited]);

  const markVisited = useCallback((id: string) => {
    setVisited((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { isNew, markVisited };
}
