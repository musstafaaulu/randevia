# ADR-0003: Olay güdümlü iletişim + transactional outbox

**Durum:** Kabul edildi

## Bağlam

appointment-service bir randevu oluşturduğunda/onayladığında/iptal ettiğinde,
notification-service'in bundan haberdar olup bildirim üretmesi gerekiyor.
appointment-service'in notification-service'i senkron (HTTP ile) çağırması,
ikisini birbirine sıkıca bağlar (notification-service çökükse randevu da
oluşturulamaz). appointment-service önce veritabanına yazıp sonra RabbitMQ'ya
olay yayınlasa, ikisi arasında (yazma başarılı, yayın başarısız; ya da süreç
tam o anda çökerse) bir olay kalıcı olarak kaybolabilir.

## Karar

RabbitMQ üzerinde topic exchange ile olay güdümlü iletişim; appointment-service
olayı doğrudan yayınlamak yerine, **aynı MongoDB transaction'ı içinde** bir
`OutboxEvent` kaydı yazıyor (randevu kaydıyla birlikte, atomik). Ayrı bir
`outboxPublisher.ts` süreci bu tabloyu periyodik (2 sn) tarayıp RabbitMQ'ya
yayınlıyor ve başarılı olanı işaretliyor. notification-service tarafında da
gecikmeli retry kuyruğu + dead-letter queue (DLQ) + idempotent işleme var, bu
yüzden mesaj ne kaybolur ne iki kez işlenir. (mongo-appointment, outbox'ın
transaction gerektirmesi nedeniyle tek düğümlü bir replica set olarak
çalıştırılıyor — standalone MongoDB transaction'ı desteklemiyor.)

## Sonuçlar

**Artı:**
- Bir randevu oluşturma işlemi, RabbitMQ o anda kapalı/erişilemez olsa bile
  asla "yarım" kalmıyor: ya randevu da olay da birlikte yazılır ya hiçbiri.
  Olay, RabbitMQ geri geldiğinde publisher tarafından yayınlanır.
- appointment-service, notification-service'in (ya da RabbitMQ'nun) o anki
  durumundan bağımsız çalışır — zamansal bağlantısızlık (temporal decoupling).
- Test edilebilir: `brokerUnavailable.test.ts`, RabbitMQ kapalıyken üç farklı
  olayın da outbox'ta güvenle durduğunu doğruluyor.

**Eksi:**
- Ekstra bir tablo, ekstra bir arka plan süreci (poll aralığı = en kötü
  durumda olayın yayınlanma gecikmesi, burada 2 sn) ve mongo-appointment'in
  replica set olması gerekliliği — standalone'dan daha karmaşık bir yerel
  kurulum (self-initiating healthcheck ile otomatikleştirildi).
- Olaylar RabbitMQ'ya *en az bir kez* teslim edilir, hiçbir zaman *tam bir
  kez* değil; bu yüzden tüketici tarafında idempotency (notification-service'teki
  gibi) olay güdümlü mimarinin ayrılmaz bir parçası, opsiyonel değil.
