/**
 * Tests für den Import vorhandener Lebensläufe und Anschreiben (Word/PDF/Text).
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  const img = { getSize: () => ({ width: 0, height: 0 }) }
  return { nativeImage: { createFromPath: () => img, createFromBuffer: () => img } }
})

import { buildDocx } from '../../src/main/export/docx'
import { extractFile } from '../../src/main/import/extract'
import { createContent, emptyEntry, emptyItem, type CvContent, type LetterContent } from '../../src/shared/document'
import { buildImportedContent, guessType, parseCv, parseLetter } from '../../src/shared/importer'

// So liefert mammoth einen typischen Word-Lebenslauf (Tabelle: Zeitraum | Inhalt)
const wordCv = [
  'Lebenslauf',
  'Max Mustermann',
  'Musterstraße 12',
  '45127 Essen',
  'Telefon: 0201 1234567',
  'E-Mail: max.mustermann@example.de',
  'Persönliche Daten',
  'Geburtsdatum: 14.03.1992',
  'Staatsangehörigkeit: deutsch',
  'Berufserfahrung',
  '04/2019 – heute',
  'Lagerlogistiker',
  'Spedition Rhein GmbH, Duisburg',
  '• Wareneingang und Kommissionierung',
  '• Staplerfahrer (Schein vorhanden)',
  '08/2015 – 03/2019',
  'Fachkraft für Lagerlogistik bei Metro AG',
  'Schulbildung',
  '2008 - 2015\tRealschule am Park, Essen',
  'Abschluss: Fachoberschulreife',
  'EDV-Kenntnisse',
  'MS Office, SAP (Grundkenntnisse), Lagerverwaltungssysteme',
  'Sprachen',
  'Deutsch – Muttersprache',
  'Englisch – gut',
  'Hobbys',
  'Fußball, Kochen',
  'Essen, 01.09.2024',
  'Max Mustermann'
].join('\n\n')

// So liefert der PDF-Import einen mit DocForge exportierten Lebenslauf
const pdfCv = [
  'Jana Weber',
  'P R O J E K T I N G E N I E U R I N E R N E U E R BA R E E N E R G I E N',
  'Hamburg · +49 151 2345 6789 · jana.weber@example.com',
  '',
  'PROFIL',
  'Ingenieurin mit sechs Jahren Erfahrung in Planung und Umsetzung von Wind- und PV-Projekten. Schwerpunkt',
  'Netzanschluss, Genehmigungsverfahren und Stakeholder-Management.',
  '',
  'BERUFSERFAHRUNG',
  '2021 – heute Projektingenieurin Wind',
  'Hanse Wind AG, Hamburg',
  '2019',
  '2021 Junior Ingenieurin PV',
  'SolarNord GmbH, Kiel',
  '',
  'AUSBILDUNG',
  '2014 – 2019 M.Sc. Regenerative Energiesysteme',
  'TU Hamburg',
  '',
  'KENNTNISSE',
  'PVsyst · WindPRO · AutoCAD · MS Project',
  '',
  'SPRACHEN',
  'Deutsch (Muttersprache)',
  'Hamburg, 27.10.2026',
  'Jana Weber'
].join('\n')

const letter = [
  'Max Mustermann',
  'Musterstraße 12',
  '45127 Essen',
  'max.mustermann@example.de',
  '',
  'Logistik Nord GmbH',
  'z. Hd. Frau Schneider',
  'Hafenweg 5',
  '20457 Hamburg',
  '',
  'Essen, 02.09.2024',
  '',
  'Bewerbung als Lagerleiter',
  'Ihre Anzeige auf StepStone, Kennziffer 4711',
  '',
  'Sehr geehrte Frau Schneider,',
  '',
  'mit großem Interesse habe ich Ihre Stellenanzeige gelesen.',
  '',
  'Seit fünf Jahren arbeite ich als Lagerlogistiker und leite ein Team von vier Personen.',
  '',
  'Über eine Einladung zum Vorstellungsgespräch freue ich mich.',
  '',
  'Mit freundlichen Grüßen',
  '',
  'Max Mustermann',
  '',
  'Anlagen',
  'Lebenslauf',
  'Zeugnisse'
].join('\n')

describe('Import: Lebenslauf', () => {
  it('erkennt Kontaktdaten, Stationen und Listen in einem Word-Lebenslauf', () => {
    const r = parseCv(wordCv)
    expect(r.personal).toMatchObject({ name: 'Max Mustermann', email: 'max.mustermann@example.de', phone: '0201 1234567', city: 'Essen', birthDate: '14.03.1992' })
    expect(r.personal.address).toContain('Musterstraße 12')
    expect(r.signature).toEqual({ place: 'Essen', date: '01.09.2024' })

    const kinds = r.sections.map((s) => s.kind)
    expect(kinds).toEqual(['experience', 'education', 'skills', 'languages', 'interests'])

    const exp = r.sections[0].entries
    expect(exp).toHaveLength(2)
    expect(exp[0]).toMatchObject({ start: '04/2019', end: 'heute', title: 'Lagerlogistiker', org: 'Spedition Rhein GmbH', location: 'Duisburg' })
    expect(exp[0].description).toContain('Wareneingang')
    expect(exp[1]).toMatchObject({ start: '08/2015', end: '03/2019', title: 'Fachkraft für Lagerlogistik', org: 'Metro AG' })

    const edu = r.sections[1].entries[0]
    expect(edu).toMatchObject({ start: '2008', end: '2015', title: 'Realschule am Park, Essen' })
    expect(edu.description).toContain('Fachoberschulreife')

    expect(r.sections[2].items.map((i) => i.name)).toEqual(['MS Office', 'SAP', 'Lagerverwaltungssysteme'])
    expect(r.sections[2].items[1].level).toBe('Grundkenntnisse')
    expect(r.sections[3].items).toMatchObject([
      { name: 'Deutsch', level: 'Muttersprache' },
      { name: 'Englisch', level: 'gut' }
    ])
    expect(r.sections[4].items.map((i) => i.name)).toEqual(['Fußball', 'Kochen'])
  })

  it('liest einen DocForge-PDF-Export (gesperrte Schrift, umbrochene Zeiträume)', () => {
    const r = parseCv(pdfCv)
    expect(r.personal).toMatchObject({ name: 'Jana Weber', email: 'jana.weber@example.com', phone: '+49 151 2345 6789' })
    expect(r.personal.headline).toBeUndefined() // gesperrte Zeile ist unbrauchbar → Profil hat Vorrang
    expect(r.sections.map((s) => s.kind)).toEqual(['profile', 'experience', 'education', 'skills', 'languages'])
    expect(r.sections[0].text).toBe('Ingenieurin mit sechs Jahren Erfahrung in Planung und Umsetzung von Wind- und PV-Projekten. Schwerpunkt Netzanschluss, Genehmigungsverfahren und Stakeholder-Management.')
    expect(r.sections[1].entries.map((e) => [e.start, e.end, e.title, e.org, e.location])).toEqual([
      ['2021', 'heute', 'Projektingenieurin Wind', 'Hanse Wind AG', 'Hamburg'],
      ['2019', '2021', 'Junior Ingenieurin PV', 'SolarNord GmbH', 'Kiel']
    ])
    expect(r.sections[3].items.map((i) => i.name)).toEqual(['PVsyst', 'WindPRO', 'AutoCAD', 'MS Project'])
    expect(r.sections[4].items[0]).toMatchObject({ name: 'Deutsch', level: 'Muttersprache' })
    expect(r.signature?.place).toBe('Hamburg')
  })

  it('verliert nichts: Text ohne Überschriften landet im Profil-Abschnitt', () => {
    const { content, summary } = buildImportedContent('cv', 'Ich bin ein Text ohne jede Struktur, aber mit ziemlich viel Inhalt darin.', null)
    expect(summary.fallback).toBe(true) // Dialog weist darauf hin
    const cv = content as CvContent
    expect(cv.sections[0].text).toContain('ohne jede Struktur')
    // Kernabschnitte stehen zum Ergänzen bereit
    expect(cv.sections.map((s) => s.kind)).toEqual(['profile', 'experience', 'education', 'skills'])
  })

  it('Profildaten haben Vorrang, erkannte Werte füllen Lücken', () => {
    const { content } = buildImportedContent('cv', wordCv, { name: 'Max Mustermann', phone: '0170 999999' })
    const cv = content as CvContent
    expect(cv.personal.phone).toBe('0170 999999')
    expect(cv.personal.email).toBe('max.mustermann@example.de')
  })
})

describe('Import: andere Person', () => {
  it('Datei einer anderen Person: deren Angaben gelten, Hinweis für ein neues Profil', () => {
    const { content, summary } = buildImportedContent('cv', pdfCv, { name: 'Max Mustermann', phone: '0170 999999', city: 'Essen' })
    expect(summary).toMatchObject({ otherPerson: true, person: 'Jana Weber' })
    const cv = content as CvContent
    expect(cv.personal).toMatchObject({ name: 'Jana Weber', phone: '+49 151 2345 6789' })
    expect(cv.personal.city).not.toBe('Essen')
  })

  it('gleiche Person (Schreibweise egal): kein Hinweis', () => {
    const { summary } = buildImportedContent('cv', pdfCv, { name: 'jana  weber' })
    expect(summary.otherPerson).toBe(false)
  })
})

describe('Import: Anschreiben', () => {
  it('erkennt Empfänger, Datum, Betreff, Text, Gruß und Anlagen', () => {
    const r = parseLetter(letter)
    expect(r.recipient).toEqual({ company: 'Logistik Nord GmbH', contact: 'z. Hd. Frau Schneider', street: 'Hafenweg 5', city: '20457 Hamburg' })
    expect(r.sender).toMatchObject({ name: 'Max Mustermann', street: 'Musterstraße 12', email: 'max.mustermann@example.de' })
    expect([r.place, r.date]).toEqual(['Essen', '02.09.2024'])
    expect(r.subject).toBe('Bewerbung als Lagerleiter')
    expect(r.reference).toContain('Kennziffer 4711')
    expect(r.salutation).toBe('Sehr geehrte Frau Schneider,')
    expect(r.body.split('\n\n')).toHaveLength(3)
    expect(r.closing).toBe('Mit freundlichen Grüßen')
    expect(r.signatureName).toBe('Max Mustermann')
    expect(r.attachments).toBe('Lebenslauf, Zeugnisse')
  })

  it('unterscheidet Brief und Lebenslauf', () => {
    expect(guessType(letter)).toBe('cover_letter')
    expect(guessType(wordCv)).toBe('cv')
    expect(guessType(pdfCv)).toBe('cv')
  })

  it('setzt den Brief in eine Vorlage ein', () => {
    const { content } = buildImportedContent('cover_letter', letter, { name: 'Max Mustermann' })
    const l = content as LetterContent
    expect(l.kind).toBe('letter')
    expect(l.recipient.company).toBe('Logistik Nord GmbH')
    expect(l.body).toContain('Lagerlogistiker')
  })
})

describe('Import: Dateien', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docforge-import-'))

  it('Rundreise: DocForge-DOCX exportieren und wieder einlesen', async () => {
    const cv = createContent('cv', { name: 'Erika Muster', email: 'erika@example.com', phone: '0123 456789', city: 'Köln' }, 'de') as CvContent
    cv.sections[0].text = 'Erfahrene Bürokauffrau mit Schwerpunkt Buchhaltung.'
    cv.sections[1].entries = [{ ...emptyEntry(), title: 'Sachbearbeiterin', org: 'Kontor GmbH', location: 'Köln', start: '01/2020', end: 'heute', description: 'Kreditorenbuchhaltung' }]
    cv.sections[3].items = [emptyItem('DATEV'), emptyItem('Excel', 'sehr gut')]
    const file = join(dir, 'cv.docx')
    writeFileSync(file, await buildDocx(cv, '/nonexistent'))

    const { text } = await extractFile(file)
    const r = parseCv(text)
    expect(r.personal).toMatchObject({ name: 'Erika Muster', email: 'erika@example.com' })
    const exp = r.sections.find((s) => s.kind === 'experience')!.entries[0]
    expect(exp).toMatchObject({ title: 'Sachbearbeiterin', org: 'Kontor GmbH', start: '01/2020', end: 'heute' })
    expect(r.sections.find((s) => s.kind === 'skills')!.items.map((i) => i.name)).toContain('DATEV')
  })

  it('liest einen alten Word-Lebenslauf im Tabellen-Layout', async () => {
    const { text } = await extractFile(join(__dirname, '../fixtures/lebenslauf-alt.docx'))
    const r = parseCv(text)
    expect(r.personal).toMatchObject({ name: 'Max Mustermann', phone: '0201 1234567', email: 'max.mustermann@example.de', city: 'Essen', birthDate: '14.03.1992' })
    expect(r.personal.address).toBe('Musterstraße 12, 45127 Essen')
    expect(r.sections.map((s) => s.kind)).toEqual(['experience', 'education', 'skills', 'languages'])
    expect(r.sections[0].entries.map((e) => [e.start, e.end, e.title, e.org, e.location])).toEqual([
      ['04/2019', 'heute', 'Lagerlogistiker', 'Spedition Rhein GmbH', 'Duisburg'],
      ['08/2015', '03/2019', 'Fachkraft für Lagerlogistik', 'Metro AG', 'Essen']
    ])
    expect(r.sections[2].items.map((i) => i.name)).toEqual(['MS Office', 'SAP', 'Führerschein Klasse B'])
  })

  it('liest ein echtes PDF (DocForge-Export mit Beispieldaten)', async () => {
    const { text } = await extractFile(join(__dirname, '../fixtures/cv-beispiel.pdf'))
    const r = parseCv(text)
    expect(r.personal).toMatchObject({ name: 'Jana Weber', email: 'jana.weber@example.com' })
    expect(r.sections.find((s) => s.kind === 'experience')!.entries.map((e) => e.org)).toEqual(['Hanse Wind AG', 'SolarNord GmbH'])
    expect(r.sections.find((s) => s.kind === 'education')!.entries[0].title).toBe('M.Sc. Regenerative Energiesysteme')
  })

  it('lehnt alte .doc-Dateien und leere Dateien mit klarer Meldung ab', async () => {
    const doc = join(dir, 'alt.doc')
    writeFileSync(doc, 'x')
    await expect(extractFile(doc)).rejects.toThrow('IMPORT_DOC')
    const txt = join(dir, 'leer.txt')
    writeFileSync(txt, '   \n ')
    await expect(extractFile(txt)).rejects.toThrow('IMPORT_EMPTY')
  })
})
