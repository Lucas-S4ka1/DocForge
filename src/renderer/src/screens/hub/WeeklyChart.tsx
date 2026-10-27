/**
 * Kleines Balkendiagramm: gesendete Bewerbungen pro Woche (8 Wochen).
 * Eine Datenreihe → eine Akzentfarbe, keine Legende (der Titel benennt die Reihe).
 * Dünne Balken mit abgerundeten Enden auf der Grundlinie, Tooltip beim Hovern,
 * zusätzlich eine Tabelle für Screenreader.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface WeekPoint {
  weekStart: string
  sent: number
}

/** ISO-Kalenderwoche */
function isoWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00`)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

const fmt = (s: string, lang: string) => new Date(`${s}T12:00`).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit' })

export function WeeklyChart({ data, goal, lang }: { data: WeekPoint[]; goal: number; lang: string }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)
  // Tatsächliche Breite messen → Schrift und Balken behalten ihre Größe (kein Hochskalieren)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(352)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(200, Math.round(el.clientWidth))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 92
  const top = 10
  const base = H - 18
  const slot = W / data.length
  const barW = 18
  const max = Math.max(1, goal, ...data.map((d) => d.sent))
  const y = (v: number) => base - ((base - top) * v) / max
  const goalY = goal > 0 ? y(goal) : null

  return (
    <div ref={box} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label={t('hub.weeklyTitle')}>
        {/* Wochenziel als dezente gestrichelte Linie */}
        {goalY !== null && (
          <>
            <line x1={0} x2={W} y1={goalY} y2={goalY} stroke="rgb(var(--accent-400) / 0.35)" strokeDasharray="3 3" strokeWidth={1} />
            <text x={W} y={goalY - 3} textAnchor="end" fontSize={9} fill="rgb(var(--accent-400))">
              {t('hub.goalLine', { n: goal })}
            </text>
          </>
        )}
        <line x1={0} x2={W} y1={base} y2={base} stroke="rgb(var(--accent-400) / 0.3)" strokeWidth={1} />
        {data.map((d, i) => {
          const x = i * slot + (slot - barW) / 2
          const h = base - y(d.sent)
          const r = Math.min(4, h)
          const current = i === data.length - 1
          return (
            <g key={d.weekStart} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* großzügige, unsichtbare Trefferfläche */}
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {d.sent > 0 && (
                <path
                  d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z`}
                  fill={current ? 'rgb(var(--accent-300))' : 'rgb(var(--accent-500))'}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={current ? 'rgb(var(--accent-200))' : 'rgb(var(--accent-400))'}>
                {isoWeek(d.weekStart)}
              </text>
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-accent-400 bg-ground px-2 py-1 text-[11px] text-accent-100 shadow-glow-sm"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
        >
          {t('hub.weekTooltip', { week: isoWeek(data[hover].weekStart), from: fmt(data[hover].weekStart, lang), count: data[hover].sent })}
        </div>
      )}
      {/* Tabellenansicht für Screenreader */}
      <table className="sr-only">
        <caption>{t('hub.weeklyTitle')}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.weekStart}>
              <th scope="row">{t('hub.week', { n: isoWeek(d.weekStart) })}</th>
              <td>{d.sent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
