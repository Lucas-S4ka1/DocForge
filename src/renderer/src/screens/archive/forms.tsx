/**
 * Formular-Dialoge: Profil, Firma, Bewerbung, Termin (jeweils Anlegen & Bearbeiten).
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  applicationStatuses,
  eventKinds,
  type Application,
  type ApplicationStatus,
  type Company,
  type EventItem,
  type EventKind,
  type Profile
} from '@shared/models'
import { Modal } from '@/components/ui/Modal'
import { Row, SelectField, TextArea, TextField } from '@/components/ui/Form'
import { db, mutate, useQuery } from '@/store/db'
import { useApp } from '@/store/app'
import { nullify, useAction } from './common'

interface FormProps<T> {
  initial?: T
  onClose(): void
  onSaved?(saved: T): void
}

function Footer({ onClose, saving, isEdit }: { onClose(): void; saving: boolean; isEdit: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      <button type="button" className="btn" onClick={onClose}>
        {t('common.cancel')}
      </button>
      <button type="submit" form="entity-form" className="btn btn-primary" disabled={saving}>
        {isEdit ? t('common.save') : t('common.create')}
      </button>
    </>
  )
}

/** Gemeinsames Gerüst: Formular-State, Speichern mit Fehlerbehandlung. */
function useForm<V extends Record<string, unknown>>(initial: V) {
  const [values, setValues] = useState<V>(initial)
  const [saving, setSaving] = useState(false)
  const field = <K extends keyof V>(key: K) => ({
    value: (values[key] ?? '') as string,
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }))
  })
  return { values, setValues, saving, setSaving, field }
}

// ── Profil ──────────────────────────────────────────────────────────────────

export function ProfileForm({ initial, onClose, onSaved }: FormProps<Profile>) {
  const { t } = useTranslation()
  const run = useAction()
  const f = useForm({
    name: initial?.name ?? '',
    headline: initial?.headline ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
    city: initial?.city ?? '',
    birthDate: initial?.birthDate ?? ''
  })
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    f.setSaving(true)
    const data = nullify(f.values) as typeof f.values & { name: string }
    const saved = await run(
      () => mutate(() => (initial ? db.profiles.update(initial.id, data) : db.profiles.create(data))),
      t('archive.saved')
    )
    f.setSaving(false)
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }
  return (
    <Modal tag="PROFIL" title={initial ? t('archive.editProfile') : t('archive.newProfile')} onClose={onClose} footer={<Footer onClose={onClose} saving={f.saving} isEdit={!!initial} />}>
      <form id="entity-form" onSubmit={submit} className="flex flex-col gap-3">
        <TextField label={t('fields.name')} required autoFocus maxLength={120} {...f.field('name')} />
        <TextField label={t('fields.headline')} maxLength={200} {...f.field('headline')} />
        <Row>
          <TextField label={t('fields.email')} type="email" {...f.field('email')} />
          <TextField label={t('fields.phone')} {...f.field('phone')} />
        </Row>
        <Row>
          <TextField label={t('fields.address')} {...f.field('address')} />
          <TextField label={t('fields.city')} {...f.field('city')} />
        </Row>
        <TextField label={t('fields.birthDate')} type="date" {...f.field('birthDate')} />
      </form>
    </Modal>
  )
}

// ── Firma ───────────────────────────────────────────────────────────────────

export function CompanyForm({ initial, onClose, onSaved }: FormProps<Company>) {
  const { t } = useTranslation()
  const run = useAction()
  const f = useForm({
    name: initial?.name ?? '',
    industry: initial?.industry ?? '',
    address: initial?.address ?? '',
    city: initial?.city ?? '',
    website: initial?.website ?? '',
    contactName: initial?.contactName ?? '',
    contactEmail: initial?.contactEmail ?? ''
  })
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    f.setSaving(true)
    const data = nullify(f.values) as typeof f.values & { name: string }
    const saved = await run(
      () => mutate(() => (initial ? db.companies.update(initial.id, data) : db.companies.create(data))),
      t('archive.saved')
    )
    f.setSaving(false)
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }
  return (
    <Modal tag="FIRMA" title={initial ? t('archive.editCompany') : t('archive.newCompany')} onClose={onClose} footer={<Footer onClose={onClose} saving={f.saving} isEdit={!!initial} />}>
      <form id="entity-form" onSubmit={submit} className="flex flex-col gap-3">
        <TextField label={t('fields.companyName')} required autoFocus maxLength={200} {...f.field('name')} />
        <Row>
          <TextField label={t('fields.industry')} {...f.field('industry')} />
          <TextField label={t('fields.city')} {...f.field('city')} />
        </Row>
        <TextField label={t('fields.address')} {...f.field('address')} />
        <TextField label={t('fields.website')} placeholder="https://" {...f.field('website')} />
        <Row>
          <TextField label={t('fields.contactName')} {...f.field('contactName')} />
          <TextField label={t('fields.contactEmail')} type="email" {...f.field('contactEmail')} />
        </Row>
      </form>
    </Modal>
  )
}

// ── Bewerbung ───────────────────────────────────────────────────────────────

const NEW_COMPANY = '__new__'

export function ApplicationForm({ initial, onClose, onSaved }: FormProps<Application>) {
  const { t } = useTranslation()
  const run = useAction()
  const activeProfileId = useApp((s) => s.settings.activeProfileId)
  const profiles = useQuery(() => db.profiles.list(), []).data ?? []
  const companies = useQuery(() => db.companies.list(), []).data ?? []

  const f = useForm({
    profileId: String(initial?.profileId ?? activeProfileId ?? ''),
    companyId: String(initial?.companyId ?? NEW_COMPANY),
    newCompany: '',
    role: initial?.role ?? '',
    location: initial?.location ?? '',
    status: (initial?.status ?? 'draft') as ApplicationStatus,
    sentAt: initial?.sentAt ?? '',
    jobUrl: initial?.jobUrl ?? '',
    jobPosting: initial?.jobPosting ?? ''
  })
  // Erstes Profil vorauswählen, sobald geladen
  const profileId = f.values.profileId || String(profiles[0]?.id ?? '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    f.setSaving(true)
    const saved = await run(async () => {
      let companyId = Number(f.values.companyId)
      if (f.values.companyId === NEW_COMPANY) {
        companyId = (await db.companies.create({ name: f.values.newCompany })).id
      }
      const data = nullify({
        profileId: Number(profileId),
        companyId,
        role: f.values.role,
        location: f.values.location,
        status: f.values.status,
        sentAt: f.values.sentAt,
        jobUrl: f.values.jobUrl,
        jobPosting: f.values.jobPosting
      })
      return mutate(() => (initial ? db.applications.update(initial.id, data) : db.applications.create(data)))
    }, t('archive.saved'))
    f.setSaving(false)
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }

  return (
    <Modal tag="BEWERBUNG" title={initial ? t('archive.editApplication') : t('archive.newApplication')} onClose={onClose} width={600} footer={<Footer onClose={onClose} saving={f.saving} isEdit={!!initial} />}>
      {profiles.length === 0 ? (
        <p className="m-0 text-[14px] text-accent-300">{t('archive.needProfile')}</p>
      ) : (
        <form id="entity-form" onSubmit={submit} className="flex flex-col gap-3">
          <Row>
            <SelectField
              label={t('fields.profile')}
              required
              value={profileId}
              onChange={(e) => f.setValues((v) => ({ ...v, profileId: e.target.value }))}
              options={profiles.map((p) => ({ value: String(p.id), label: p.name }))}
            />
            <SelectField
              label={t('fields.company')}
              required
              {...f.field('companyId')}
              options={[{ value: NEW_COMPANY, label: t('archive.newCompanyOption') }, ...companies.map((c) => ({ value: String(c.id), label: c.name }))]}
            />
          </Row>
          {f.values.companyId === NEW_COMPANY && (
            <TextField label={t('fields.companyName')} required autoFocus maxLength={200} {...f.field('newCompany')} />
          )}
          <Row>
            <TextField label={t('fields.role')} required maxLength={200} {...f.field('role')} />
            <TextField label={t('fields.location')} {...f.field('location')} />
          </Row>
          <Row>
            <SelectField
              label={t('fields.status')}
              {...f.field('status')}
              options={applicationStatuses.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            />
            <TextField label={t('fields.sentAt')} type="date" {...f.field('sentAt')} />
          </Row>
          <TextField label={t('fields.jobUrl')} placeholder="https://" {...f.field('jobUrl')} />
          <TextArea label={t('fields.jobPosting')} rows={5} {...f.field('jobPosting')} />
        </form>
      )}
    </Modal>
  )
}

// ── Termin ──────────────────────────────────────────────────────────────────

export function EventForm({ applicationId, initial, onClose }: FormProps<EventItem> & { applicationId: number }) {
  const { t } = useTranslation()
  const run = useAction()
  const f = useForm({
    kind: (initial?.kind ?? 'interview') as EventKind,
    title: initial?.title ?? '',
    startsAt: initial?.startsAt?.slice(0, 16) ?? '',
    location: initial?.location ?? '',
    notes: initial?.notes ?? ''
  })
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    f.setSaving(true)
    const data = nullify({ ...f.values, applicationId }) as typeof f.values & { applicationId: number }
    const saved = await run(() => mutate(() => (initial ? db.events.update(initial.id, data) : db.events.create(data))), t('archive.saved'))
    f.setSaving(false)
    if (saved) onClose()
  }
  return (
    <Modal tag="TERMIN" title={initial ? t('archive.editEvent') : t('archive.newEvent')} onClose={onClose} footer={<Footer onClose={onClose} saving={f.saving} isEdit={!!initial} />}>
      <form id="entity-form" onSubmit={submit} className="flex flex-col gap-3">
        <Row>
          <SelectField label={t('fields.kind')} {...f.field('kind')} options={eventKinds.map((k) => ({ value: k, label: t(`eventKind.${k}`) }))} />
          <TextField label={t('fields.startsAt')} type="datetime-local" required {...f.field('startsAt')} />
        </Row>
        <TextField label={t('fields.title')} {...f.field('title')} />
        <TextField label={t('fields.location')} {...f.field('location')} />
        <TextArea label={t('fields.notes')} rows={3} {...f.field('notes')} />
      </form>
    </Modal>
  )
}
