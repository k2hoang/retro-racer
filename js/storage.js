/* Retro Racer - localStorage wrapper. The game still works if storage is blocked. */
(function (RR) {
  'use strict';
  const PREFIX = 'retroRacer.';

  RR.store = {
    get(key, fallback) {
      try {
        const v = window.localStorage.getItem(PREFIX + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch (e) { /* storage unavailable: ignore */ }
    }
  };
})(window.RR);
