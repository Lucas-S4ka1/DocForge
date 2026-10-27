/** "Profil: Jana Weber ▾" – wechselt das aktive Profil (Hub-Kopfzeile). */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/app'
import { db, useQuery } from '@/store/db'
import { Dropdown, DropdownItem } from '../ui/Dropdown'
import { ProfileForm } from '@/screens/archive/forms'

export function ProfileSwitcher() {
  const { t } = useTranslation()
  const activeId = useApp((s) => s.settings.activeProfileId)
  const update = useApp((s) => s.updateSettings)
  const profiles = useQuery(() => db.profiles.list(), []).data ?? []
  const [creating, setCreating] = useState(false)
  const active = profiles.find((p) => p.id === activeId)

  return (
    <>
      <Dropdown align="right" label={`${active ? t('common.profile', { name: active.name }) : t('common.noProfile')} ▾`}>
        {profiles.map((p) => (
          <DropdownItem key={p.id} close checked={p.id === activeId} onClick={() => update({ activeProfileId: p.id })}>
            {p.name}
          </DropdownItem>
        ))}
        <DropdownItem close onClick={() => setCreating(true)}>
          + {t('archive.newProfile')}
        </DropdownItem>
      </Dropdown>
      {creating && <ProfileForm onClose={() => setCreating(false)} onSaved={(p) => update({ activeProfileId: p.id })} />}
    </>
  )
}
