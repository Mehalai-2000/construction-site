// Scroll-controlled image sequence drawn on a <canvas>.
// Frames: /frames/frame_0001.webp … frame_0721.webp (1280×720, 24 fps).

export const FRAME_COUNT = 721
const FRAME_PATH = '/frames/'
// Set to '/frames-mobile/' once a lighter mobile set (same file names) exists.
const MOBILE_FRAME_PATH = null
const STATIC_FRAME = 241 // finished villa, used for prefers-reduced-motion
const CONCURRENCY = 6
const EASE = 0.15
const READY_RATIO = 0.15 // hide loader once this share of frames is ready
const HERO_FADE_END = 0.08 // hero is gone by 8% of progress
const PANEL_IN = 0.15 // share of a scene's range used to slide a panel in
const PANEL_OUT = 0.85 // panel starts sliding out after this share
const STAGGER = 0.12 // per-element delay inside a panel (number, title, text, rule)
const PANEL_SHIFT_X = 60 // px, desktop slide distance
const PANEL_SHIFT_Y = 30 // px, mobile slide distance

// Scene ranges are 1-based file frame numbers (verified against the frames).
export const SCENES = [
  {
    start: 1, end: 120, num: '01', title: 'The Ground', label: 'Ground', side: 'left',
    lead: 'Every landmark begins with a foundation.',
    more: 'We prepare the site, survey the land, and pour foundations built to last generations.',
  },
  {
    start: 121, end: 185, num: '02', title: 'The Structure', label: 'Structure', side: 'right',
    lead: 'Engineered with precision, built to endure.',
    more: 'Concrete, steel, and expert craftsmanship rise floor by floor.',
  },
  {
    start: 186, end: 288, num: '03', title: 'The Reveal', label: 'Reveal', side: 'left',
    lead: 'Architecture that belongs to its landscape.',
    more: 'Clean lines, open glass, and water that reflects the sky.',
  },
  {
    start: 289, end: 410, num: '04', title: 'Living Spaces', label: 'Living', side: 'right',
    lead: 'Light, volume, and a view worth coming home to.',
    more: 'Interiors designed around how you live.',
  },
  {
    start: 411, end: 592, num: '05', title: 'Private Retreats', label: 'Retreats', side: 'left',
    lead: 'Calm, considered interiors.',
    more: 'Bedrooms and corridors finished in warm, natural materials.',
  },
  {
    start: 593, end: 721, num: '06', title: 'The Details', label: 'Details', side: 'right',
    lead: 'Crafted down to the last finish.',
    more: 'Every surface, light, and joint is intentional.',
  },
]

// Horizontal focus point (0 = left edge, 1 = right edge) used when the frame
// is cropped horizontally (portrait screens). Interpolated between keyframes.
const FOCUS_KEYS = [
  { frame: 1, x: 0.5 },
  { frame: 100, x: 0.55 },
  { frame: 121, x: 0.58 }, // crane + frame sit right of centre
  { frame: 185, x: 0.55 },
  { frame: 241, x: 0.5 }, // villa
  { frame: 337, x: 0.5 }, // living room, city view
  { frame: 505, x: 0.6 }, // bedroom
  { frame: 721, x: 0.45 }, // game room, pool table
]

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const pad = (n) => String(n).padStart(4, '0')
const easeOut = (t) => 1 - (1 - t) ** 3
const HERO_GONE_FRAME = Math.ceil(HERO_FADE_END * (FRAME_COUNT - 1)) + 1
// The first panel waits for the hero to clear so they never overlap.
const sceneStart = (i) => (i === 0 ? HERO_GONE_FRAME : SCENES[i].start)

function focusFor(frameNumber) {
  if (frameNumber <= FOCUS_KEYS[0].frame) return FOCUS_KEYS[0].x
  for (let i = 1; i < FOCUS_KEYS.length; i++) {
    const a = FOCUS_KEYS[i - 1]
    const b = FOCUS_KEYS[i]
    if (frameNumber <= b.frame) {
      const t = (frameNumber - a.frame) / (b.frame - a.frame)
      return a.x + (b.x - a.x) * t
    }
  }
  return FOCUS_KEYS[FOCUS_KEYS.length - 1].x
}

// Draw `img` to fill the canvas ("cover"), cropping overflow around focusX.
function drawCover(ctx, img, cw, ch, focusX = 0.5, focusY = 0.5) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const scale = Math.max(cw / iw, ch / ih)
  const dw = iw * scale
  const dh = ih * scale
  const dx = (cw - dw) * focusX
  const dy = (ch - dh) * focusY
  ctx.drawImage(img, dx, dy, dw, dh)
}

function loadImage(src) {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  return img.decode().then(() => img)
}

// Panel visibility 0 → 1 → 0 across a scene's range (float frame number).
function panelVisibility(i, frameNumber) {
  const start = sceneStart(i)
  const end = SCENES[i].end
  if (frameNumber < start || frameNumber > end) return 0
  const local = (frameNumber - start) / (end - start)
  if (local < PANEL_IN) return local / PANEL_IN
  // The final panel stays on the last frame instead of leaving an empty screen.
  if (local > PANEL_OUT && i < SCENES.length - 1) return (1 - local) / (1 - PANEL_OUT)
  return 1
}

function sceneIndexFor(frameNumber) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (frameNumber >= SCENES[i].start) return i
  return 0
}

function buildPanels(container) {
  return SCENES.map((s) => {
    const panel = document.createElement('li')
    panel.className = `panel panel--${s.side}`
    panel.innerHTML = `
      <span class="panel-num">${s.num}</span>
      <h2 class="panel-title">${s.title}</h2>
      <p class="panel-text"><span>${s.lead}</span> <span class="panel-more">${s.more}</span></p>
      <span class="panel-rule" aria-hidden="true"></span>`
    container.appendChild(panel)
    return { panel, parts: [...panel.children], dir: s.side === 'left' ? -1 : 1, last: '' }
  })
}

function buildBar(bar) {
  const track = bar.querySelector('.seq-bar-track')
  const labels = bar.querySelector('.seq-bar-labels')
  const markers = []
  const buttons = []
  SCENES.forEach((s, i) => {
    const at = (s.start - 1) / (FRAME_COUNT - 1)
    const next = i < SCENES.length - 1 ? (SCENES[i + 1].start - 1) / (FRAME_COUNT - 1) : 1
    const marker = document.createElement('span')
    marker.className = 'seq-marker'
    marker.style.left = `${(at * 100).toFixed(3)}%`
    track.appendChild(marker)
    markers.push(marker)

    const li = document.createElement('li')
    li.style.left = `${(at * 100).toFixed(3)}%`
    li.style.width = `${((next - at) * 100).toFixed(3)}%`
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'seq-label'
    btn.dataset.scene = String(i)
    btn.textContent = s.label
    btn.setAttribute('aria-label', `Go to scene ${s.num}: ${s.title}`)
    li.appendChild(btn)
    labels.appendChild(li)
    buttons.push(btn)
  })
  return { markers, buttons }
}

export function createSequence(root) {
  const section = root.querySelector('#sequence')
  const stage = section.querySelector('.stage')
  const canvas = section.querySelector('#sequence-canvas')
  const ctx = canvas.getContext('2d', { alpha: false })
  const hero = section.querySelector('#hero')
  const panelList = section.querySelector('#panels')
  const shadeLeft = section.querySelector('#shade-left')
  const shadeRight = section.querySelector('#shade-right')
  const loader = section.querySelector('#loader')
  const loaderFill = section.querySelector('#loader-fill')
  const loaderPct = section.querySelector('#loader-pct')
  const bar = section.querySelector('#seq-bar')
  const barFill = bar.querySelector('#bar-fill')
  const barScene = bar.querySelector('#bar-scene')
  const barIndex = bar.querySelector('#bar-index')
  const barPct = bar.querySelector('#bar-pct')

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const smallLayout = window.matchMedia('(max-width: 768px)') // layout follows live width
  // Frame set is decided once on load; not swapped on resize.
  const framePath = smallLayout.matches && MOBILE_FRAME_PATH ? MOBILE_FRAME_PATH : FRAME_PATH
  const frameSrc = (index) => `${framePath}frame_${pad(index + 1)}.webp`

  const images = new Array(FRAME_COUNT).fill(null)
  let loadedCount = 0
  let destroyed = false

  let current = 0 // eased frame index (float, 0-based)
  let target = 0
  let drawnIndex = -1 // frame requested
  let drawnSource = -1 // frame actually painted (may be nearest loaded)
  let rafId = 0
  let visible = true
  let resizeTimer = 0
  let cw = 0
  let ch = 0
  let lastHeroFrame = -1
  let lastScene = -1
  let lastPct = -1
  let lastBarVisible = null

  const panels = buildPanels(panelList)
  const { markers, buttons } = buildBar(bar)

  // ---------- Canvas sizing ----------
  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cw = canvas.clientWidth
    ch = canvas.clientHeight
    canvas.width = Math.max(1, Math.round(cw * dpr))
    canvas.height = Math.max(1, Math.round(ch * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
  }

  function nearestLoaded(index) {
    if (images[index]) return index
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (index - d >= 0 && images[index - d]) return index - d
      if (index + d < FRAME_COUNT && images[index + d]) return index + d
    }
    return -1
  }

  function draw(index, force = false) {
    const source = nearestLoaded(index)
    if (source < 0) return
    if (!force && index === drawnIndex && source === drawnSource) return
    drawCover(ctx, images[source], cw, ch, focusFor(source + 1))
    drawnIndex = index
    drawnSource = source
    canvas.dataset.frame = String(source)
  }

  // ---------- Reduced motion: single static frame, panels as a static list ----------
  if (reducedMotion) {
    document.documentElement.classList.add('reduced-motion')
    loader.hidden = true
    bar.hidden = true
    const staticIndex = STATIC_FRAME - 1
    sizeCanvas()
    loadImage(frameSrc(staticIndex))
      .then((img) => {
        if (destroyed) return
        images[staticIndex] = img
        draw(staticIndex, true)
      })
      .catch(() => {})
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        sizeCanvas()
        draw(staticIndex, true)
      }, 150)
    }
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onResize, { passive: true })
    return () => {
      destroyed = true
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      images.fill(null)
      panelList.replaceChildren()
    }
  }

  // ---------- Scroll geometry ----------
  let scrollable = 1
  function measure() {
    // Pinned distance = section height − sticky stage height.
    scrollable = Math.max(1, section.offsetHeight - stage.clientHeight)
  }

  function readProgress() {
    const rect = section.getBoundingClientRect()
    return { progress: clamp(-rect.top / scrollable, 0, 1), rect }
  }

  // ---------- UI driven by the eased frame ----------
  function updateHero(frame) {
    const rounded = Math.round(frame)
    if (rounded === lastHeroFrame) return
    lastHeroFrame = rounded
    const heroT = clamp(frame / (FRAME_COUNT - 1) / HERO_FADE_END, 0, 1)
    hero.style.opacity = String(1 - heroT)
    hero.style.transform = `translate3d(0, ${(-heroT * 60).toFixed(1)}px, 0)`
    hero.style.visibility = heroT >= 1 ? 'hidden' : 'visible'
  }

  function updatePanels(frameNumber) {
    const vertical = smallLayout.matches
    let leftShade = 0
    let rightShade = 0
    panels.forEach((p, i) => {
      const v = panelVisibility(i, frameNumber)
      if (p.dir < 0) leftShade = Math.max(leftShade, v)
      else rightShade = Math.max(rightShade, v)
      const key = `${v.toFixed(3)}|${vertical}`
      if (key === p.last) return
      p.last = key
      p.panel.classList.toggle('is-active', v > 0)
      p.parts.forEach((el, k) => {
        const t = clamp((v - k * STAGGER) / (1 - 3 * STAGGER), 0, 1)
        const shift = 1 - easeOut(t)
        el.style.opacity = t.toFixed(3)
        el.style.transform = vertical
          ? `translate3d(0, ${(shift * PANEL_SHIFT_Y).toFixed(1)}px, 0)`
          : `translate3d(${(p.dir * shift * PANEL_SHIFT_X).toFixed(1)}px, 0, 0)`
      })
    })
    shadeLeft.style.opacity = leftShade.toFixed(3)
    shadeRight.style.opacity = rightShade.toFixed(3)
  }

  function updateBar(frame, rect) {
    const p = frame / (FRAME_COUNT - 1)
    barFill.style.transform = `scaleX(${p.toFixed(4)})`

    const pinned = rect.top <= 1 && rect.bottom >= stage.clientHeight - 1
    const show = pinned && frame + 1 >= HERO_GONE_FRAME
    if (show !== lastBarVisible) {
      lastBarVisible = show
      bar.classList.toggle('is-visible', show)
    }

    const pct = Math.round(p * 100)
    if (pct !== lastPct) {
      lastPct = pct
      barPct.textContent = `${pct}%`
    }

    const scene = sceneIndexFor(Math.round(frame) + 1)
    if (scene === lastScene) return
    lastScene = scene
    barIndex.textContent = SCENES[scene].num
    barScene.textContent = SCENES[scene].title
    SCENES.forEach((_, i) => {
      const state = i === scene ? 'is-active' : i < scene ? 'is-past' : 'is-upcoming'
      markers[i].className = `seq-marker ${state}`
      buttons[i].className = `seq-label ${state}`
      if (i === scene) buttons[i].setAttribute('aria-current', 'step')
      else buttons[i].removeAttribute('aria-current')
    })
  }

  // ---------- Scene navigation ----------
  function onLabelClick(event) {
    const btn = event.target.closest('.seq-label')
    if (!btn) return
    const i = Number(btn.dataset.scene)
    // Land where the panel has finished sliding in, so it is readable on arrival.
    const start = sceneStart(i)
    const frameNumber = start + (SCENES[i].end - start) * PANEL_IN + 1
    const sectionTop = section.getBoundingClientRect().top + window.scrollY
    const y = sectionTop + ((frameNumber - 1) / (FRAME_COUNT - 1)) * scrollable
    window.scrollTo({ top: Math.round(y), behavior: 'smooth' })
  }
  bar.addEventListener('click', onLabelClick)

  // ---------- rAF loop ----------
  function tick() {
    rafId = 0
    const { progress, rect } = readProgress()
    target = progress * (FRAME_COUNT - 1)
    current += (target - current) * EASE
    if (Math.abs(target - current) < 0.5) current = target

    const index = Math.round(current)
    draw(index)
    updateHero(current)
    updatePanels(current + 1)
    updateBar(current, rect)

    const settled = current === target && drawnSource === index
    if (!settled) requestTick()
  }

  function requestTick() {
    if (!rafId && visible && !destroyed) rafId = requestAnimationFrame(tick)
  }

  const onScroll = () => requestTick()

  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      measure()
      sizeCanvas()
      draw(Math.round(current), true)
      lastHeroFrame = -1
      panels.forEach((p) => (p.last = ''))
      requestTick()
    }, 150)
  }

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting
      if (visible) {
        requestTick()
      } else {
        if (rafId) cancelAnimationFrame(rafId)
        rafId = 0
        lastBarVisible = false
        bar.classList.remove('is-visible')
      }
    },
    { rootMargin: '100px 0px' },
  )

  // ---------- Preloading ----------
  function onFrameReady(index, img) {
    if (destroyed) return
    images[index] = img
    loadedCount++
    const ratio = loadedCount / FRAME_COUNT
    loaderFill.style.transform = `scaleX(${ratio})`
    loaderPct.textContent = `${Math.round(ratio * 100)}%`
    if (ratio >= READY_RATIO) loader.classList.add('is-done')
    // A frame closer to the target than the one on screen just arrived.
    const want = Math.round(current)
    if (drawnSource < 0 || Math.abs(index - want) < Math.abs(drawnSource - want)) {
      draw(want)
      requestTick()
    }
  }

  async function preload() {
    try {
      onFrameReady(0, await loadImage(frameSrc(0)))
    } catch {
      /* first frame failed; the rest may still load */
    }
    let next = 1
    const worker = async () => {
      while (!destroyed && next < FRAME_COUNT) {
        const index = next++
        try {
          onFrameReady(index, await loadImage(frameSrc(index)))
        } catch {
          /* skip a failed frame; nearest loaded frame is drawn instead */
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  }

  // ---------- Init ----------
  measure()
  sizeCanvas()
  {
    // Start at the frame matching the current scroll (e.g. after reload).
    const { progress } = readProgress()
    current = target = progress * (FRAME_COUNT - 1)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('orientationchange', onResize, { passive: true })
  io.observe(section)
  preload()
  requestTick()

  return function destroy() {
    destroyed = true
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    clearTimeout(resizeTimer)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
    bar.removeEventListener('click', onLabelClick)
    io.disconnect()
    images.fill(null)
    panelList.replaceChildren()
    markers.forEach((el) => el.remove())
    bar.querySelector('.seq-bar-labels').replaceChildren()
  }
}
