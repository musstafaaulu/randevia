# ADR-0001: Database-per-service

**Durum:** Kabul edildi

## Bağlam

Üç servis var: auth-service, appointment-service, notification-service.
Hepsi az sayıda ilişkili veriye (kullanıcı, doktor/randevu, bildirim) ihtiyaç
duyuyor. Tek bir paylaşılan MongoDB ile servisler arası `$lookup`/join yapmak,
ya da her servise kendi veritabanını vermek arasında seçim yapılması gerekti.

## Karar

Her servisin kendi MongoDB örneği var (`mongo-auth`, `mongo-appointment`,
`mongo-notification`); hiçbir servis başka bir servisin veritabanına doğrudan
erişmez. Servisler arası veri ihtiyacı (örn. bir randevunun doktor adı,
bir bildirimin alıcı e-postası) ya denormalizasyon (bkz. ADR-0006) ya da
servisler arası HTTP çağrısı (bkz. `/auth/internal/users/:id`) ile çözülür.

## Sonuçlar

**Artı:**
- Servisler bağımsız geliştirilebilir, test edilebilir ve ölçeklenebilir;
  birinin şema değişikliği diğerlerini etkilemez.
- Bir veritabanındaki sorun (yavaşlama, disk dolması, index eksikliği)
  yalnızca sahibi servisi etkiler.
- Mikroservis sınırları kod seviyesinde değil, veri seviyesinde de zorlanır —
  "sadece bu tabloya bakayım" kolaylığı olmadığı için sınırın ileride
  aşınması daha zor.

**Eksi:**
- Servisler arası veri ihtiyacı için join yerine ya denormalizasyon (veri
  tekilliği riski, bkz. ADR-0006) ya da ek bir ağ çağrısı (gecikme, kısmi
  başarısızlık riski) gerekir.
- Dağıtık transaction yok; birden fazla servisi aynı anda tutarlı tutmak
  (örn. bir randevu oluşturulurken bildirim de garanti üretilsin) olay
  güdümlü bir çözüm gerektiriyor (bkz. ADR-0003).
