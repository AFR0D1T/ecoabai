/* Тема до загрузки приложения — без «мигания» светлого фона. Отдельный файл, чтобы CSP не требовала unsafe-inline. */
(function () {
  try {
    var t = localStorage.getItem('ecoabai.theme');
    var dark = t === 'dark' || ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
