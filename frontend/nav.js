document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('nav.html');
  const html = await res.text();
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = html;
  const path = window.location.pathname.replace(/\/$/, '');
  sidebar.querySelectorAll('.nav-item').forEach(link => {
    const href = link.getAttribute('href').replace(/\/$/, '');
    if (href === path) {
      link.classList.add('active');
    }
  });
});
