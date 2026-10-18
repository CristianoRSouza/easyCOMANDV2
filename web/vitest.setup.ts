import "@testing-library/jest-dom/vitest";

// jsdom não implementa matchMedia (usado por `use-mobile` e pelo sonner).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom não implementa IntersectionObserver nem ResizeObserver (recharts, embla, radix).
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = ObserverStub as unknown as typeof IntersectionObserver;
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ObserverStub as unknown as typeof ResizeObserver;
}
