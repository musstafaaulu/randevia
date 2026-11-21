import { Link } from 'react-router-dom';

const STEPS = [
  { icon: '🔎', title: 'Doktorunuzu bulun', text: 'Uzmanlık alanına veya isme göre arayın, size uygun doktoru seçin.' },
  { icon: '🗓️', title: 'Uygun saati seçin', text: 'Doktorun müsait saatlerini canlı görün, birini işaretleyip randevu talep edin.' },
  { icon: '⚡', title: 'Anında haberdar olun', text: 'Doktor onayladığında ya da randevu değiştiğinde bildirim anında ekranınıza düşer.' },
];

const FEATURES = [
  { icon: '📡', title: 'Gerçek zamanlı', text: 'Randevu durumu ve müsaitlik, sayfa yenilemeden anlık güncellenir.' },
  { icon: '🔔', title: 'Akıllı bildirimler', text: 'Her randevu talebi, onay ve iptal; hem hastaya hem doktora anında bildirilir.' },
  { icon: '🔒', title: 'Güvenli giriş', text: 'Rol tabanlı yetkilendirme ve güvenli oturum yönetimiyle verileriniz korunur.' },
  { icon: '📱', title: 'Her cihazda', text: 'Telefon, tablet ya da masaüstü — Randevia her ekranda sorunsuz çalışır.' },
];

const SPECIALTIES = [
  'Kardiyoloji',
  'Dahiliye',
  'Çocuk Sağlığı ve Hastalıkları',
  'Göz Hastalıkları',
  'Ortopedi ve Travmatoloji',
  'Nöroloji',
  'Kadın Hastalıkları ve Doğum',
  'Kulak Burun Boğaz',
];

export function LandingPage() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <img src="/logo.svg" alt="Randevia" className="landing-hero-logo" />
        <h1>Sağlık randevularınız artık tek tıkla.</h1>
        <p>
          Doktorunuzu seçin, uygun saati işaretleyin; randevunuzun her adımını anlık
          bildirimlerle takip edin.
        </p>
        <div className="landing-hero-actions">
          <Link to="/kayit" className="primary-button">
            Hemen Kayıt Ol
          </Link>
          <Link to="/giris" className="secondary-button">
            Giriş Yap
          </Link>
        </div>
      </section>

      <section className="landing-section">
        <h2>Nasıl çalışır?</h2>
        <div className="landing-steps">
          {STEPS.map((step, i) => (
            <div key={step.title} className="landing-step">
              <span className="landing-step-number">{i + 1}</span>
              <span className="landing-step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-muted">
        <h2>Neden Randevia?</h2>
        <div className="landing-features">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="landing-feature">
              <span aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>Uzmanlık Alanları</h2>
        <div className="landing-specialties">
          {SPECIALTIES.map((specialty) => (
            <span key={specialty} className="specialty-tag landing-specialty">
              {specialty}
            </span>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2>Randevunuzu almaya hazır mısınız?</h2>
        <Link to="/kayit" className="primary-button">
          Ücretsiz Hesap Oluştur
        </Link>
      </section>
    </div>
  );
}
