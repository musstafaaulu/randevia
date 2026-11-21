export function AuthHero() {
  return (
    <div className="auth-hero">
      <span className="hero-logo">
        <img src="/favicon.svg" alt="" aria-hidden="true" className="hero-logo-icon" />
        Randevia
      </span>
      <h2>Sağlık randevularınız artık tek tıkla.</h2>
      <p>Doktorunuzu seçin, uygun saati işaretleyin; gerisini biz anında haber veririz.</p>
      <ul className="auth-hero-points">
        <li>
          <span aria-hidden="true">🩺</span> Uzmanlık alanına göre doktor bulun
        </li>
        <li>
          <span aria-hidden="true">📅</span> Müsaitlikleri canlı takip edin
        </li>
        <li>
          <span aria-hidden="true">⚡</span> Onay ve iptalleri anında bildirimle öğrenin
        </li>
      </ul>
    </div>
  );
}
