// "Our Process" section: word-by-word heading, scroll reveals, a scroll-driven
// timeline and (≥1024px) a sticky image frame that follows the active step.
// All motion is driven by scroll position; the rAF update pauses off-screen.

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function splitWords(el) {
  const text = el.textContent.trim()
  el.setAttribute('aria-label', text)
  el.textContent = ''
  text.split(/\s+/).forEach((word, i, all) => {
    const mask = document.createElement('span')
    mask.className = 'op-word'
    mask.setAttribute('aria-hidden', 'true')
    const inner = document.createElement('span')
    inner.textContent = word
    inner.style.setProperty('--i', String(i))
    mask.appendChild(inner)
    el.appendChild(mask)
    if (i < all.length - 1) el.appendChild(document.createTextNode(' '))
  })
}

export function createProcess(root) {
  const section = root.querySelector('#process')
  if (!section) return () => {}
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // "Book a consultation" → existing Contact section.
  const cta = section.querySelector('.op-cta-btn')
  const onCta = (event) => {
    const contact = document.querySelector('#contact')
    if (!contact) return
    event.preventDefault()
    contact.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    document.querySelector('#contact input, #contact textarea')?.focus({ preventScroll: true })
  }
  cta?.addEventListener('click', onCta)

  // Reduced motion: static stacked layout, everything visible (see process.css).
  if (reducedMotion) return () => cta?.removeEventListener('click', onCta)

  section.classList.add('op--animated')
  splitWords(section.querySelector('.op-title'))

  const steps = [...section.querySelectorAll('.op-step')]
  const nodes = steps.map((s) => s.querySelector('.op-node'))
  const shots = [...section.querySelectorAll('.op-shot')]
  const bigNums = [...section.querySelectorAll('.op-bignum span')]
  const stepsWrap = section.querySelector('.op-steps')
  const line = section.querySelector('.op-line')
  const lineFill = section.querySelector('.op-line-fill')
  const desktop = window.matchMedia('(min-width: 1024px)')

  // ---------- One-shot reveals ----------
  const revealIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-in')
        revealIo.unobserve(entry.target)
      })
    },
    { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
  )
  ;[section.querySelector('.op-head'), ...steps, section.querySelector('.op-cta')].forEach((el) => el && revealIo.observe(el))

  // ---------- Scroll-driven timeline + active step ----------
  let rafId = 0
  let onScreen = false
  let active = -1
  let lineTop = -1
  let lineHeight = -1
  let lastFill = -1

  function update() {
    rafId = 0
    const anchor = window.innerHeight * 0.5
    const wrapRect = stepsWrap.getBoundingClientRect()
    const centers = nodes.map((n) => {
      const r = n.getBoundingClientRect()
      return r.top + r.height / 2
    })
    const first = centers[0]
    const last = centers[centers.length - 1]
    const progress = clamp((anchor - first) / Math.max(1, last - first), 0, 1)

    // Line spans exactly from the first node to the last node.
    const top = Math.round(first - wrapRect.top)
    const height = Math.round(last - first)
    if (top !== lineTop || height !== lineHeight) {
      lineTop = top
      lineHeight = height
      line.style.top = `${top}px`
      line.style.height = `${height}px`
    }
    if (Math.abs(progress - lastFill) > 0.0005) {
      lastFill = progress
      lineFill.style.transform = `scaleY(${progress.toFixed(4)})`
    }

    let reached = -1
    centers.forEach((c, i) => {
      const isReached = c <= anchor + 1
      if (isReached) reached = i
      nodes[i].classList.toggle('is-reached', isReached)
    })

    let next
    if (desktop.matches) {
      // Active = the step whose block contains the viewport centre.
      next = 0
      steps.forEach((s, i) => {
        if (s.getBoundingClientRect().top <= anchor) next = i
      })
    } else {
      next = reached
    }
    if (next !== active) {
      active = next
      steps.forEach((s, i) => s.classList.toggle('is-active', i === active))
      shots.forEach((s, i) => s.classList.toggle('is-active', i === Math.max(active, 0)))
      bigNums.forEach((s, i) => s.classList.toggle('is-active', i === Math.max(active, 0)))
      if (active >= 0) steps[active].classList.add('is-seen')
    }
  }

  const requestUpdate = () => {
    if (onScreen && !rafId) rafId = requestAnimationFrame(update)
  }
  const sectionIo = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting
    if (onScreen) requestUpdate()
    else if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  })
  sectionIo.observe(section)
  const onLayoutChange = () => {
    active = -1 // re-apply state for the new layout
    requestUpdate()
  }
  window.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', onLayoutChange, { passive: true })
  desktop.addEventListener('change', onLayoutChange)
  update()

  return function destroy() {
    if (rafId) cancelAnimationFrame(rafId)
    revealIo.disconnect()
    sectionIo.disconnect()
    window.removeEventListener('scroll', requestUpdate)
    window.removeEventListener('resize', onLayoutChange)
    desktop.removeEventListener('change', onLayoutChange)
    cta?.removeEventListener('click', onCta)
  }
}
