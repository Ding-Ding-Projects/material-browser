import React from 'react';
import { Button, Modal } from './components';
import { Icon } from './Icon';
import { mdiShieldCheckOutline, mdiWeb, mdiRobotOutline } from '@mdi/js';
import type { Profile } from './api';
export function ProfileLaunch({ profile, busy, onClose, onLaunch, t }: {
  profile: Profile; busy: boolean; onClose: () => void; onLaunch: (id: string) => void; t: (text: string) => string;
}) {
  return <Modal title={t('Launch profile')} onClose={onClose} closeLabel={t('Cancel')} accessibilityLabel={t('Accessibility')}
    actions={<Button disabled={busy} onClick={() => onLaunch(profile.id)}>{t('Launch with standard identity')}</Button>}>
    <div className="launch-review">
      <div className="launch-target"><strong>{profile.name}</strong><code className="literal">{profile.id}</code></div>
      <div className="launch-options">
        <section className="launch-option"><Icon path={mdiWeb}/><small>{t('Engine')}</small><strong>{profile.engine}</strong><span>{t('Uses this profile’s saved engine.')}</span></section>
        <section className="launch-option"><Icon path={mdiRobotOutline}/><small>{t('Automation')}</small><strong>{profile.automation === 'off' ? t('Off') : profile.automation}</strong><span>{t('Change the saved automation preference in the profile inspector.')}</span></section>
      </div>
      <section className="launch-consent"><h2><Icon path={mdiShieldCheckOutline} size={22}/> {t('Review before launch')}</h2>
        <p>{t('Stable browser identity is unavailable in this build.')}</p>
        <p>{t('The saved profile identity is not enforced, so websites may recognize a different browser identity.')}</p>
        <p>{t('Standard launch uses the engine’s normal identity. It does not provide identity spoofing, stable cross-device identity or portable browser credentials.')}</p>
      </section>
      <section><h2>{t('What happens next')}</h2><ol className="launch-steps"><li>{t('The native host checks the vault and managed engine.')}</li><li>{t('The browser opens using the saved profile and automation preference.')}</li><li>{t('Actual runtime state appears in the profile inspector.')}</li></ol></section>
      <p>{t('Continue only if this standard identity behavior is suitable for this profile. This choice applies to this launch only.')}</p>
    </div>
  </Modal>;
}
