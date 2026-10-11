// "What we do" section: scroll reveals, word-by-word heading, image parallax,
// scroll-linked marquee, count-up stats and pointer tilt on cards.
// Everything is driven by scroll or pointer — nothing runs on a timer loop.

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const easeOut = (t) => 1 - (1 - t) ** 3

function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/)
  el.setAttribute('aria-label', el.textContent.trim())
  el.textContent = ''
  words.forEach((word, i) => {
    const mask = document.createElement('span')
    mask.className = 'word'
    mask.setAttribute('aria-hidden', 'true')
    const inner = document.createElement('span')
    inner.textContent = word
    inner.style.setProperty('--d', `${i * 55}ms`)
    mask.appendChild(inner)
    el.appendChild(mask)
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '))
  })
}

function countUp(el) {
  const end = Number(el.dataset.count)
  const duration = 1600
  let start = 0
  const step = (now) => {
    if (!start) start = now
    const t = clamp((now - start) / duration, 0, 1)
    el.textContent = String(Math.round(end * easeOut(t)))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export function createServices(root) {
  const section = root.querySelector('#services')
  if (!section) return () => {}
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches

  // Reduced motion: content is simply visible (hidden states only apply under .is-animated).
  if (reducedMotion) return () => {}
  section.classList.add('is-animated')

  section.querySelectorAll('[data-split]').forEach(splitWords)
  const counters = [...section.querySelectorAll('[data-count]')]
  counters.forEach((el) => (el.textContent = '0'))

  // ---------- Reveal on scroll (once) ----------
  const revealIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-in')
        entry.target.querySelectorAll('[data-count]').forEach(countUp)
        revealIo.unobserve(entry.target)
      })
    },
    { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
  )
  section.querySelectorAll('[data-reveal], [data-split]').forEach((el) => revealIo.observe(el))

  // ---------- Parallax + marquee, only while the section is on screen ----------
  const media = [...section.querySelectorAll('.card-media-parallax')]
  const marquee = section.querySelector('#marquee-track')
  let rafId = 0
  let active = false

  function update() {
    rafId = 0
    const vh = window.innerHeight
    media.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect()
      // -1 when the card is below the viewport, +1 when above it.
      const t = clamp((vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2), -1, 1)
      el.style.transform = `translate3d(0, ${(t * 8).toFixed(2)}%, 0)`
    })
    if (marquee) {
      const r = section.getBoundingClientRect()
      const p = clamp((vh - r.top) / (vh + r.height), 0, 1)
      marquee.style.transform = `translate3d(${(-p * 35).toFixed(2)}%, 0, 0)`
    }
  }
  const requestUpdate = () => {
    if (active && !rafId) rafId = requestAnimationFrame(update)
  }
  const sectionIo = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting
    if (active) requestUpdate()
  })
  sectionIo.observe(section)
  window.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', requestUpdate, { passive: true })

  // ---------- Pointer tilt + glare (mouse / trackpad only) ----------
  const cleanups = []
  if (finePointer) {
    section.querySelectorAll('.card-inner').forEach((card) => {
      let frame = 0
      const onMove = (e) => {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        const y = (e.clientY - r.top) / r.height
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          card.style.setProperty('--ry', `${((x - 0.5) * 8).toFixed(2)}deg`)
          card.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`)
          card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`)
          card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`)
        })
      }
      const onEnter = () => card.classList.add('is-hover')
      const onLeave = () => {
        cancelAnimationFrame(frame)
        card.classList.remove('is-hover')
        card.style.setProperty('--rx', '0deg')
        card.style.setProperty('--ry', '0deg')
      }
      card.addEventListener('pointermove', onMove)
      card.addEventListener('pointerenter', onEnter)
      card.addEventListener('pointerleave', onLeave)
      cleanups.push(() => {
        cancelAnimationFrame(frame)
        card.removeEventListener('pointermove', onMove)
        card.removeEventListener('pointerenter', onEnter)
        card.removeEventListener('pointerleave', onLeave)
      })
    })
  }

  return function destroy() {
    if (rafId) cancelAnimationFrame(rafId)
    revealIo.disconnect()
    sectionIo.disconnect()
    window.removeEventListener('scroll', requestUpdate)
    window.removeEventListener('resize', requestUpdate)
    cleanups.forEach((fn) => fn())
  }
}
