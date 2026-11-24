// Apply the theme before the stylesheet can paint the first frame.
(() => {
  let preference;
  try { preference = localStorage.getItem('tae-theme'); } catch { /* Storage may be disabled. */ }
  document.documentElement.dataset.theme = ['light', 'dark'].includes(preference)
    ? preference
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();
