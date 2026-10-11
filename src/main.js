import './style.css'
import './process.css'
import './contact.css'
import { createSequence } from './sequence.js'
import { createServices } from './services.js'
import { createProcess } from './process.js'
import { createContact } from './contact.js'

// Always open on frame 1: without this the browser restores the previous
// scroll position on reload and the sequence plays forward on its own.
// Deep links (e.g. #contact) still jump to their section.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
if (!location.hash) window.scrollTo(0, 0)

const destroySequence = createSequence(document)
const destroyServices = createServices(document)
const destroyProcess = createProcess(document)
const destroyContact = createContact(document)

// Header turns solid once the pinned sequence has scrolled past.
const header = document.querySelector('#site-header')
const sequence = document.querySelector('#sequence')
const headerIo = new IntersectionObserver(
  ([entry]) => {
    header.classList.toggle('is-solid', !entry.isIntersecting && entry.boundingClientRect.top < 0)
  },
  { rootMargin: '-72px 0px 0px 0px' },
)
headerIo.observe(sequence)

// TODO: Placeholder form — not connected to any backend. Replace this handler
// with a real submission (API endpoint, form service, etc.).
const form = document.querySelector('#contact-form')
const status = document.querySelector('#form-status')
const onSubmit = (event) => {
  event.preventDefault()
  form.classList.add('was-validated')
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }
  const name = form.elements.name.value.trim().split(/\s+/)[0]
  status.textContent = `Thank you, ${name} — this demo form is not connected yet, so nothing was sent.`
}
form.addEventListener('submit', onSubmit)

document.querySelector('#year').textContent = String(new Date().getFullYear())

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroySequence()
    destroyServices()
    destroyProcess()
    destroyContact()
    headerIo.disconnect()
    form.removeEventListener('submit', onSubmit)
  })
}
