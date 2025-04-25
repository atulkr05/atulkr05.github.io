/* assets/js/scripts.js */
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      if (link.hash) {
        e.preventDefault();
        document.querySelector(link.hash).scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});