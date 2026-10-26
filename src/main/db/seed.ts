/**
 * Fiktive Beispieldaten zum Ausprobieren (angelehnt an die Design-Screens).
 * Alle Personen und Firmen sind erfunden.
 */
import type { Repos } from './repos'
import type { ApplicationStatus } from '@shared/models'

export function seedDemo(r: Repos): void {
  const jana = r.profiles.create({
    name: 'Jana Weber',
    headline: 'Projektingenieurin Erneuerbare Energien',
    email: 'jana.weber@example.com',
    phone: '+49 151 2345 6789',
    city: 'Hamburg'
  })
  const max = r.profiles.create({ name: 'Max Beispiel', headline: 'Werkstudent Informatik', city: 'Kiel' })
  r.tags.set('profile', jana.id, ['hauptprofil'])

  const companies: [string, string, string][] = [
    ['Nordlicht Energie GmbH', 'Hamburg', 'Windenergie'],
    ['Hanse Solar AG', 'Hamburg', 'Photovoltaik'],
    ['Elbwerk Stadtwerke', 'Hamburg', 'Versorger'],
    ['Baltic Grid ApS', 'Kopenhagen', 'Netzbetreiber'],
    ['WindKonzept Nord', 'Husum', 'Projektierung'],
    ['Küstenkraft GmbH', 'Bremen', 'Windenergie'],
    ['Tideflow Energy', 'Rotterdam', 'Gezeitenkraft'],
    ['Nordsee Netz', 'Wilhelmshaven', 'Netzbetreiber']
  ]
  const c = companies.map(([name, city, industry]) => r.companies.create({ name, city, industry }))

  const apps: [number, string, ApplicationStatus, string | null, string[]][] = [
    [0, 'Projektleiterin Onshore-Wind', 'interview', '2026-10-12', ['wind', 'hamburg']],
    [1, 'Senior Projektingenieurin PV', 'sent', '2026-10-21', ['solar', 'hamburg']],
    [2, 'Netzplanerin', 'sent', '2026-10-18', ['hamburg']],
    [3, 'Grid Connection Engineer', 'draft', null, ['english']],
    [4, 'Teamleitung Genehmigung', 'rejected', '2026-09-20', ['wind']],
    [5, 'Projektmanagerin', 'accepted', '2026-09-01', ['wind']],
    [6, 'Asset Manager', 'draft', null, ['english']],
    [7, 'Ingenieurin Umspannwerke', 'sent', '2026-10-15', []]
  ]
  // Rückwärts anlegen, damit die erste Bewerbung als zuletzt aktualisiert oben steht
  for (const [ci, role, status, sentAt, tags] of [...apps].reverse()) {
    const a = r.applications.create({ profileId: jana.id, companyId: c[ci].id, role, status, sentAt, location: companies[ci][1] })
    if (tags.length) r.tags.set('application', a.id, tags)
    r.documents.create({ profileId: jana.id, applicationId: a.id, type: 'cv', title: `Lebenslauf – ${companies[ci][0]}`, content: null })
    if (status !== 'draft' || ci === 3)
      r.documents.create({ profileId: jana.id, applicationId: a.id, type: 'cover_letter', title: `Anschreiben – ${companies[ci][0]}`, content: null })
    if (ci === 0) {
      r.events.create({ applicationId: a.id, kind: 'interview', startsAt: '2026-10-29T10:00', title: 'Erstgespräch', location: 'Hamburg' })
      r.notes.create({ applicationId: a.id, body: 'Telefonat mit Frau Hansen – Team mit 6 Personen, zwei Projekte in Schleswig-Holstein. BImSchG-Beispiel vorbereiten.' })
      r.notes.create({ applicationId: a.id, body: 'Nach Homeoffice-Regelung fragen.' })
    }
  }
  r.documents.create({ profileId: jana.id, type: 'cover_page', title: 'Deckblatt – Bewerbung', content: null })
  r.documents.create({ profileId: jana.id, type: 'free', title: 'Referenzliste Projekte', content: null })
  r.documents.create({ profileId: max.id, type: 'cv', title: 'Lebenslauf Max', content: null })
}
