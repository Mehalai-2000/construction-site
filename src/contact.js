// Contact: staggered reveal + copy-to-clipboard + interactive consultation features

export function createContact(root) {
  const section = root.querySelector('#contact')
  if (!section) return () => {}

  // Copy email button interaction
  const copyBtn = section.querySelector('#copy-email-btn')
  const onCopy = (e) => {
    e.preventDefault()
    const email = 'hello@aurelianbuild.com'
    navigator.clipboard?.writeText(email).then(() => {
      const label = copyBtn.querySelector('.ct-method-label')
      if (label) {
        const orig = label.textContent
        label.textContent = 'Copied to Clipboard!'
        label.style.color = 'var(--gold-2)'
        setTimeout(() => {
          label.textContent = orig
          label.style.color = ''
        }, 2200)
      }
    }).catch(() => {
      window.location.href = `mailto:${email}`
    })
  }
  copyBtn?.addEventListener('click', onCopy)

  // Staggered reveal
  let io = null
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('ct--animated')
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -5% 0px' },
    )
    section.querySelectorAll('[data-ct-reveal]').forEach((el) => io.observe(el))
  }

  return () => {
    copyBtn?.removeEventListener('click', onCopy)
    if (io) io.disconnect()
  }
}
