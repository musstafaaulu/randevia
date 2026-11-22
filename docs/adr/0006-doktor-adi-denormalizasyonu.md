# ADR-0006: Doktor adının appointment-service'e denormalize edilmesi

**Durum:** Kabul edildi

## Bağlam

Doktorun adı auth-service'teki `User` kaydında tutuluyor (ADR-0001'deki
database-per-service kuralı yüzünden appointment-service buraya join
yapamaz). Ama doktor listesi/detay sayfalarının adı göstermesi gerekiyor.
Üç seçenek vardı: appointment-service her istekte auth-service'e senkron
sorgu atsın; doktorun adı JWT'ye gömülsün; ya da appointment-service'teki
`Doctor` kaydına adı da yazılsın (denormalizasyon).

## Karar

`Doctor` dokümanına bir `name` alanı eklendi; doktor profilini her
kaydettiğinde (auth-service'ten aldığı kendi bilgisiyle) bu alan da
gönderiliyor.

## Sonuçlar

**Artı:**
- appointment-service'in doktor listesini/detayını gösterirken
  auth-service'e senkron bağımlılığı yok — auth-service o an yavaş/çökük
  olsa bile doktor listesi çalışır.
- JWT'ye isim eklemekten daha güvenli: JWT şişmez, kullanıcı adını
  değiştirdiğinde eski (henüz süresi dolmamış) token'larda isim bayatlamaz.

**Eksi:**
- Veri iki yerde yaşıyor; auth-service'teki isim değişse appointment-service'teki
  kopyası ancak doktor bir sonraki kez profilini kaydettiğinde güncellenir
  (anlık senkron değil). Doktorlar için düşük sıklıkta değişen bir alan
  olduğundan bu kabul edilebilir bulundu; hasta/randevu gibi sık değişen
  veriler için aynı yaklaşım tercih edilmezdi.
