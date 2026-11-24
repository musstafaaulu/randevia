# ADR-0008: Servis bazlı rate limit — sabit değer yerine ortam değişkeni

**Durum:** Kabul edildi

## Bağlam

k6 yük testi (bkz. README "k6 Yük Testi") şunu ortaya çıkardı:
auth-service, appointment-service ve notification-service'in her birinde,
gateway'inkinden (`RATE_LIMIT_MAX`) bağımsız, kodun içine gömülü sabit bir
IP başına limit vardı (100 istek/15 dk). ADR-0002'deki tasarım yüzünden bu
servisler tüm istemcileri aynı IP'den (gateway container'ı) görüyor; yani bu
100'lük limit tek bir kullanıcıya değil, **o anda sistemi kullanan herkese
birlikte** uygulanıyordu. 10 eşzamanlı kullanıcılık bir yük testi bunu
saniyeler içinde tüketip isteklerin %56'sının 429 almasına sebep oldu.

## Karar

Limiti kaldırmak (savunma derinliğini azaltır, ADR-0002'nin "gateway tek
giriş noktası" ilkesiyle çelişir — iç ağdan yapılan doğrudan bir istek de
sınırsız kalır) yerine, her üç servisteki limiti gateway'inkiyle aynı
isimlendirme kalıbıyla (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`) ortam
değişkenine taşıdım. Varsayılan değer değişmedi (100/15dk) — bu yüzden
mevcut davranış etkilenmedi; yalnızca gerçek trafik hacmine göre
yükseltilebilir hâle geldi.

## Sonuçlar

**Artı:**
- Üretimde gerçek kullanıcı sayısına göre (ör. `SERVICE_RATE_LIMIT_MAX=5000`)
  ayarlanabilir, kod değişikliği/yeniden derleme gerekmiyor.
- Varsayılan davranış korunduğu için bu, davranışı değiştiren değil, yalnızca
  yapılandırılabilir kılan bir değişiklik — geriye dönük uyumlu.
- k6 testi artık gerçek kapasiteyi (gateway + servisler) ölçebiliyor,
  servislerin birbirinden bağımsız iç limitleriyle değil.

**Eksi:**
- Doğru değeri bulmak (gerçek kullanıcı sayısına göre) operasyonel bir
  karar hâline geldi — "varsayılan her zaman yeterlidir" değil, dağıtımdan
  önce düşünülmesi gereken bir ayar.
- Gateway'in `RATE_LIMIT_MAX`'ı ile servislerin `RATE_LIMIT_MAX`'ı artık iki
  farklı katmanda, iki farklı amaçla (gateway: genel istismar koruması;
  servisler: savunma derinliği) var — ikisinin birlikte tutarlı
  ayarlanması gerekiyor, aksi hâlde aynı darboğaz tekrar oluşabilir.
