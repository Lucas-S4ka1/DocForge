/**
 * Print-Modus (#print): rendert nur das Dokument für den PDF-Export.
 * Wartet auf Schriften und Bilder und meldet dann "fertig" an den Main-Process.
 */
import { useEffect, useState } from 'react'
import { isDocContent, type DocContent } from '@shared/document'
import { DocumentView, pageMargins } from './DocumentView'

export function PrintApp() {
  const [data, setData] = useState<{ content: DocContent; lang: 'de' | 'en' } | null>(null)

  useEffect(() => {
    document.documentElement.classList.add('print-mode')
    void window.docforge.print.getDoc().then((r) => {
      if (r && isDocContent(r.doc.content)) setData({ content: r.doc.content, lang: r.lang })
    })
  }, [])

  useEffect(() => {
    if (!data) return
    const done = async () => {
      await document.fonts.ready
      await Promise.all(
        [...document.images].map((img) => (img.complete ? Promise.resolve() : new Promise((res) => ((img.onload = res), (img.onerror = res)))))
      )
      // Ein Frame Puffer, damit das Layout sicher steht
      requestAnimationFrame(() => window.docforge.print.ready())
    }
    void done()
  }, [data])

  if (!data) return null
  const m = pageMargins(data.content)
  return (
    <>
      <style>{`@page { size: A4; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }`}</style>
      <DocumentView content={data.content} mode="print" lang={data.lang} />
    </>
  )
}
