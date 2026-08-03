import "@testing-library/jest-dom";

// Polyfill localStorage on global context before imports run
const mockStorage: Record<string, string> = {};
const storagePolyfill = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
  },
  length: 0,
  key: (index: number) => Object.keys(mockStorage)[index] || null,
};

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: storagePolyfill,
    writable: true,
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
} else {
  (global as any).window = global;
  (global as any).localStorage = storagePolyfill;
}

// Mock import.meta.env
(global as any).import = {
  meta: {
    env: {
      VITE_SUPABASE_URL: "https://test-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
    },
  },
};
