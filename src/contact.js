// Contact: one-shot staggered reveal of each [data-ct-reveal] block as it scrolls into view.

export function createContact(root) {
  const section = root.querySelector('#contact')
  if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  section.classList.add('ct--animated')
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        io.unobserve(entry.target)
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  )
  section.querySelectorAll('[data-ct-reveal]').forEach((el) => io.observe(el))
  return () => io.disconnect()
}
