/**
 * Tests für das Anwenden von KI-Änderungen (JSON Pointer, Schutz, Diff).
 */
import { describe, expect, it } from 'vitest'
import { applyChange, applyChanges, validateChanges, wordDiff, type AiChange } from '../../src/shared/ai'
import { createContent, type CvContent, type LetterContent } from '../../src/shared/document'

const letter = () => createContent('cover_letter', { name: 'Erika Muster', city: 'Kiel' }, 'de', 'ACME') as LetterContent
const cv = () => {
  const c = createContent('cv', { name: 'Erika Muster' }, 'de') as CvContent
  c.sections[3].items = [
    { id: 'a', name: 'Excel', level: '' },
    { id: 'b', name: 'SAP', level: '' }
  ]
  return c
}
const ch = (path: string, action: AiChange['action'], v?: unknown): AiChange => ({ label: 'x', path, action, new_value_json: v === undefined ? '' : JSON.stringify(v) })

describe('KI-Änderungen anwenden', () => {
  it('ersetzt Textfelder', () => {
    const r = applyChange(letter(), ch('/salutation', 'replace', 'Sehr geehrte Frau Hansen,')) as LetterContent
    expect(r.salutation).toBe('Sehr geehrte Frau Hansen,')
  })

  it('fügt Listeneinträge ein (mit ID) und entfernt sie', () => {
    const r = applyChange(cv(), ch('/sections/3/items/0', 'insert', { name: 'Python', level: 'gut' })) as CvContent
    expect(r.sections[3].items.map((i) => i.name)).toEqual(['Python', 'Excel', 'SAP'])
    expect(typeof r.sections[3].items[0].id).toBe('string')
    const r2 = applyChange(r, ch('/sections/3/items/2', 'remove')) as CvContent
    expect(r2.sections[3].items.map((i) => i.name)).toEqual(['Python', 'Excel'])
  })

  it('lehnt geschützte Pfade, falsche Typen und unbekannte Felder ab', () => {
    const { valid, invalid } = validateChanges(letter(), [
      ch('/style/accent', 'replace', '#000000'),
      ch('/salutation', 'replace', 42),
      ch('/nichtda', 'replace', 'x'),
      ch('/kind', 'replace', 'cv'),
      ch('/subject', 'replace', 'Bewerbung als Projektleiterin')
    ])
    expect(valid.map((c) => c.path)).toEqual(['/subject'])
    expect(invalid).toBe(4)
  })

  it('wendet mehrere Einfügungen in dieselbe Liste stabil an', () => {
    const r = applyChanges(cv(), [ch('/sections/3/items/0', 'insert', { name: 'A', level: '' }), ch('/sections/3/items/2', 'insert', { name: 'B', level: '' })]) as CvContent
    // Indizes beziehen sich auf das Original: B hinter SAP, A ganz vorne
    expect(r.sections[3].items.map((i) => i.name)).toEqual(['A', 'Excel', 'SAP', 'B'])
  })

  it('berechnet einen Wort-Diff', () => {
    const d = wordDiff('Hallo zusammen, wie geht es', 'Sehr geehrte Damen und Herren, wie geht es')
    expect(d.map((p) => [p.type, p.text.trim()])).toEqual([
      ['del', 'Hallo zusammen,'],
      ['add', 'Sehr geehrte Damen und Herren,'],
      ['same', 'wie geht es']
    ])
  })
})
