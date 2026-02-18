const nav = document.querySelector('.nav');
const menuToggle = document.querySelector('.menu-toggle');
const menuLinks = document.querySelectorAll('.menu a');

if (nav && menuToggle) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('menu-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  menuLinks.forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      nav.classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}
