/**
 * Fängt Darstellungsfehler eines Screens ab: statt eines weißen Fensters erscheint eine
 * Systemmeldung mit "Erneut versuchen". Daten sind nicht betroffen (liegen in der Datenbank).
 */
import { Component, type ReactNode } from 'react'
import i18n from '@/i18n'

interface Props {
  children: ReactNode
  /** Wechselt der Wert (z. B. Screen), wird der Fehlerzustand zurückgesetzt */
  resetKey: string
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    // Nur Fehlertyp loggen – keine Inhalte (können Nutzerdaten enthalten)
    console.error('[ui] Darstellungsfehler:', error.name)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="blueprint flex max-w-md flex-col items-start gap-4 border-danger/60 p-6">
          <span className="sys-label text-danger">[ SYSTEM ] {i18n.t('errorScreen.title')}</span>
          <p className="m-0 text-[14px] text-accent-200">{i18n.t('errorScreen.text')}</p>
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ failed: false })}>
            {i18n.t('errorScreen.retry')}
          </button>
        </div>
      </div>
    )
  }
}
