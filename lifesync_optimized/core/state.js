
export const State = {
  cache: {},
  get(key, fallback) {
    if (!(key in this.cache)) {
      try {
        this.cache[key] = JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        this.cache[key] = fallback;
      }
    }
    return this.cache[key];
  },
  set(key, value) {
    this.cache[key] = value;
    localStorage.setItem(key, JSON.stringify(value));
  }
};
