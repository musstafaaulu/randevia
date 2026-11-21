import { useState, type FormEvent } from 'react';
import { changePassword, updateProfile } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FieldError } from '../components/FieldError';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [nameTouched, setNameTouched] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState<{ new?: boolean; confirm?: boolean }>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const nameError =
    nameTouched && name.trim().length < 2 ? 'Ad en az 2 karakter olmalı.' : undefined;
  const newPasswordError =
    passwordTouched.new && newPassword.length > 0 && newPassword.length < 8
      ? 'Şifre en az 8 karakter olmalı.'
      : undefined;
  const confirmPasswordError =
    passwordTouched.confirm && confirmPassword.length > 0 && confirmPassword !== newPassword
      ? 'Yeni şifreler birbiriyle eşleşmiyor.'
      : undefined;

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    setNameTouched(true);
    if (name.trim().length < 2) return;
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      await updateProfile(name);
      await refreshUser();
      setProfileMessage('Profiliniz güncellendi.');
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Profil güncellenemedi.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPasswordTouched({ new: true, confirm: true });
    setPasswordError(null);
    setPasswordMessage(null);

    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage('Şifreniz güncellendi.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Şifre güncellenemedi.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="page">
      <h1>Profilim</h1>

      <section className="panel-section">
        <h2 className="section-title">Profil Bilgileri</h2>
        {profileError && <div className="form-error">{profileError}</div>}
        {profileMessage && <div className="form-notice">{profileMessage}</div>}
        <form className="inline-form" onSubmit={handleProfileSubmit}>
          <label>
            Ad Soyad
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setNameTouched(true)}
            />
            <FieldError message={nameError} />
          </label>
          <label>
            E-posta
            <input type="email" value={user.email} disabled />
          </label>
          <button className="primary-button" type="submit" disabled={savingProfile}>
            {savingProfile ? 'Kaydediliyor…' : 'Profili Kaydet'}
          </button>
        </form>
      </section>

      <section className="panel-section">
        <h2 className="section-title">Şifre Değiştir</h2>
        {passwordError && <div className="form-error">{passwordError}</div>}
        {passwordMessage && <div className="form-notice">{passwordMessage}</div>}
        <form className="inline-form" onSubmit={handlePasswordSubmit}>
          <label>
            Mevcut Şifre
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            Yeni Şifre
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onBlur={() => setPasswordTouched((t) => ({ ...t, new: true }))}
            />
            <FieldError message={newPasswordError} />
          </label>
          <label>
            Yeni Şifre (Tekrar)
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setPasswordTouched((t) => ({ ...t, confirm: true }))}
            />
            <FieldError message={confirmPasswordError} />
          </label>
          <button className="primary-button" type="submit" disabled={savingPassword}>
            {savingPassword ? 'Güncelleniyor…' : 'Şifreyi Güncelle'}
          </button>
        </form>
      </section>
    </div>
  );
}
