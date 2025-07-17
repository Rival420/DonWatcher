document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const apply = (dark) => {
    document.body.classList.toggle('dark', dark);
    btn.classList.toggle('fa-moon', !dark);
    btn.classList.toggle('fa-sun', dark);
  };
  const stored = localStorage.getItem('theme') === 'dark';
  apply(stored);
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    apply(isDark);
  });
});
