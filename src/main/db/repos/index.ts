/** Bündelt alle Repositories für eine Datenbankverbindung. */
import type { Db } from '../connection'
import { profilesRepo } from './profiles'
import { companiesRepo } from './companies'
import { applicationsRepo } from './applications'
import { documentsRepo } from './documents'
import { eventsRepo, notesRepo, photosRepo, statsRepo, tagsRepo } from './misc'

export function createRepos(db: Db, photosDir: string) {
  return {
    profiles: profilesRepo(db),
    companies: companiesRepo(db),
    applications: applicationsRepo(db),
    documents: documentsRepo(db),
    notes: notesRepo(db),
    events: eventsRepo(db),
    photos: photosRepo(db, photosDir),
    tags: tagsRepo(db),
    stats: statsRepo(db)
  }
}

export type Repos = ReturnType<typeof createRepos>
