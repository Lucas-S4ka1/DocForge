/**
 * Fehler mit stabilem Code, damit der Renderer passende Meldungen anzeigen kann.
 * Über IPC wird nur "[CODE] Nachricht" übertragen – niemals Nutzerdaten.
 */
export type DbErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'IN_USE'
  | 'BACKUP_INVALID'
  | 'BACKUP_TOO_NEW'
  | 'CANCELLED'
  | 'INTERNAL'

export class DbError extends Error {
  constructor(
    public readonly code: DbErrorCode,
    message: string = code
  ) {
    super(message)
  }
}
