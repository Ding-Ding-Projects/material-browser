import React from 'react';
import { Button, Modal } from './components';
import type { Profile } from './api';

export function ProfileLaunch({ profile, busy, onClose, onLaunch, t }: {
  profile: Profile;
  busy: boolean;
  onClose: () => void;
  onLaunch: (id: string) => void;
  t: (text: string) => string;
}) {
  return <Modal title={t('Launch profile')} onClose={onClose}
    closeLabel={t('Cancel')} accessibilityLabel={t('Accessibility')}
    actions={<Button disabled={busy} onClick={() => onLaunch(profile.id)}>{t('Launch with standard identity')}</Button>}>
    <div className="launch-target"><strong>{profile.name}</strong><span>{profile.engine}</span><code className="literal">{profile.id}</code></div>
    <p>{t('Stable browser identity is unavailable in this build.')}</p>
    <p>{t('The saved profile identity is not enforced, so websites may recognize a different browser identity.')}</p>
    <p>{t('Standard launch uses the engine’s normal identity. It does not provide identity spoofing, stable cross-device identity or portable browser credentials.')}</p>
    <p>{t('Continue only if this standard identity behavior is suitable for this profile. This choice applies to this launch only.')}</p>
  </Modal>;
}
