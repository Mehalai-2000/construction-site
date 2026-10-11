/**
 * Navigation Bar Controller
 * Handles active section scroll-spy and mobile navigation toggle.
 */
export function createNav(root = document) {
  const header = root.querySelector('#site-header')
  const nav = root.querySelector('#site-nav')
  const toggle = root.querySelector('#nav-toggle')
  const navLinks = root.querySelectorAll('.nav-link')

  if (!nav) return () => {}

  // Mobile menu toggle
  const toggleMenu = (open) => {
    const isOpen = open !== undefined ? open : toggle?.getAttribute('aria-expanded') !== 'true'
    toggle?.setAttribute('aria-expanded', String(isOpen))
    nav.classList.toggle('is-open', isOpen)
    header?.classList.toggle('menu-open', isOpen)
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }

  const onToggleClick = () => toggleMenu()

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      toggleMenu(false)
    }
  }

  const onNavLinkClick = (e) => {
    const href = e.currentTarget.getAttribute('href')
    if (href && href.startsWith('#')) {
      toggleMenu(false)
    }
  }

  toggle?.addEventListener('click', onToggleClick)
  document.addEventListener('keydown', onKeyDown)
  navLinks.forEach((link) => link.addEventListener('click', onNavLinkClick))

  // Active section tracking via IntersectionObserver
  const sections = [
    { id: 'top', selector: '#sequence' },
    { id: 'services', selector: '#services' },
    { id: 'process', selector: '#process' },
    { id: 'contact', selector: '#contact' },
  ]

  const updateActiveLink = (targetId) => {
    navLinks.forEach((link) => {
      const href = link.getAttribute('href')
      const isMatch = href === `#${targetId}`
      link.classList.toggle('active', isMatch)
      if (isMatch) {
        link.setAttribute('aria-current', 'page')
      } else {
        link.removeAttribute('aria-current')
      }
    })
  }

  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -60% 0px',
    threshold: 0,
  }

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const found = sections.find((s) => entry.target.matches(s.selector))
        if (found) {
          updateActiveLink(found.id)
        }
      }
    })
  }, observerOptions)

  sections.forEach((sec) => {
    const el = root.querySelector(sec.selector)
    if (el) sectionObserver.observe(el)
  })

  return () => {
    toggle?.removeEventListener('click', onToggleClick)
    document.removeEventListener('keydown', onKeyDown)
    navLinks.forEach((link) => link.removeEventListener('click', onNavLinkClick))
    sectionObserver.disconnect()
    document.body.style.overflow = ''
  }
}
