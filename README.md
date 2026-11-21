<p align="center"><img src="web/public/logo.svg" alt="Randevia" height="56" /></p>

<p align="center">
  <a href="https://github.com/musstafaaulu/randevia/actions/workflows/ci.yml"><img src="https://github.com/musstafaaulu/randevia/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/RabbitMQ-3-FF6600?logo=rabbitmq&logoColor=white" alt="RabbitMQ" />
</p>

# Randevia

**Randevia**, hastaların doktorlardan randevu alabildiği, doktorların randevularını yönetebildiği ve her iki tarafın da randevu hareketlerinden **anlık (gerçek zamanlı)** olarak haberdar edildiği, **mikroservis mimarisiyle** geliştirilmiş bir sağlık randevu sistemidir.

Sistem; tek giriş noktası olan bir **API Gateway**, kendi veritabanına sahip üç bağımsız servis, servisler arası asenkron iletişim için **RabbitMQ** üzerine kurulu olay güdümlü (event-driven) bir yapı, tarayıcıya anlık bildirim ve müsaitlik güncellemesi ileten bir **Socket.io** katmanı ve bunların hepsini kullanan bir **React web arayüzü**nden oluşur. Tamamı tek komutla (`docker compose up`) ayağa kalkar.

> Geliştirici: **Mustafa Ulu**

<p align="center">
  <img src="docs/screenshots/live-notification.gif" alt="Hasta bir doktora randevu alır almaz, doktorun ekranında sayfa yenilenmeden beliren canlı bildirim" width="720" />
  <br />
  <em>Solda hasta, sağda doktor — hasta randevu alır almaz doktorun ekranına sayfa yenilenmeden bildirim düşüyor.</em>
</p>

---

## İçindekiler

- [Öne Çıkanlar](#öne-çıkanlar)
- [Mimari](#mimari)
- [Servisler](#servisler)
- [Kullanılan Teknolojiler](#kullanılan-teknolojiler)
- [Kurulum](#kurulum)
- [Demo Hesapları](#demo-hesapları)
- [Ekran Görüntüleri](#ekran-görüntüleri)
- [Yapılandırma](#yapılandırma)
- [Endpoint Listesi](#endpoint-listesi)
- [Gerçek Zamanlı Olaylar (Socket.io)](#gerçek-zamanlı-olaylar-socketio)
- [Örnek Akış](#örnek-akış)
- [Testler ve Sonuçlar](#testler-ve-sonuçlar)
- [Tasarım Kararları](#tasarım-kararları)
- [Proje Yapısı](#proje-yapısı)
- [Yol Haritası](#yol-haritası)

---

## Öne Çıkanlar

- **Tek giriş noktası:** Tüm istemci trafiği (REST **ve** WebSocket) API Gateway üzerinden geçer; servisler ve veritabanları dış dünyaya kapalıdır.
- **Database-per-service:** Her servis yalnızca kendi MongoDB örneğine erişir.
- **Olay güdümlü iletişim:** Randevu olayları RabbitMQ topic exchange'i üzerinden yayınlanır, bildirim servisi bunları asenkron olarak tüketir.
- **Gerçek zamanlı katman:** JWT ile doğrulanmış bir Socket.io sunucusu; her kullanıcı kendi `user:<id>` odasında anlık bildirim alır, bir doktorun sayfasını izleyen herkes `doctor:<doctorId>` odasında müsaitlik değişikliğini (`slot.updated`) anında görür. Birden fazla notification-service örneği arasında olayları paylaşmak için Redis adapter kullanılır.
- **Dayanıklı mesajlaşma:** Gecikmeli yeniden deneme (retry) kuyruğu, dead-letter queue (DLQ) ve idempotent işleme sayesinde mesajlar ne kaybolur ne de iki kez işlenir.
- **Rol tabanlı yetkilendirme:** `patient`, `doctor`, `admin` rolleri; doktor rolü yalnızca admin tarafından atanabilir.
- **Güvenlik:** JWT (access + refresh token), httpOnly refresh cookie, bcrypt ile parola özeti, helmet, CORS, rate limiting.
- **Gözlemlenebilirlik:** Her isteğe atanan `X-Request-Id` gateway'den servislere taşınır ve tüm loglarda yer alır; yapılandırılmış JSON loglar.
- **Web arayüzü:** React + TypeScript SPA; Türkçe, mobil uyumlu, açık/koyu tema, yalnızca gateway ile konuşur. Tanıtım sayfası, doktor arama/filtre, haftalık müsaitlik takvimi, onay pencereleri, profil/şifre yönetimi, admin istatistik paneli, canlı bildirim zili, toast mesajları ve anlık güncellenen doktor müsaitliği içerir.
- **Tamamen Türkçe:** Arayüz metinleri ve API'nin ürettiği her hata/uyarı mesajı (doğrulama hataları dahil) Türkçe; hata *kodları* ve loglar İngilizce kalır.
- **Kalite:** TypeScript strict mode, Zod ile girdi ve ortam değişkeni doğrulaması, ESLint + Prettier, 183 backend birim/entegrasyon testi, 27 web bileşen testi (Vitest), 34 adımlık REST uçtan uca test, Socket.io üzerinden iki tarayıcıyla çalışan bir Playwright uçtan uca testi ve her push'ta çalışan bir GitHub Actions CI hattı.

---

## Mimari

```mermaid
flowchart LR
    browser([Tarayıcı<br/>React web arayüzü])

    subgraph edge[" "]
        gateway["<b>API Gateway</b><br/>:3000<br/>helmet · CORS · rate limit<br/>request id · HTTP + WS proxy"]
    end

    subgraph services["Servisler (yalnızca iç ağ)"]
        auth["<b>auth-service</b><br/>:4000<br/>kayıt · giriş · JWT · roller"]
        appt["<b>appointment-service</b><br/>:4001<br/>doktorlar · müsaitlik · randevular"]
        notif["<b>notification-service</b><br/>:4002<br/>bildirimler · Socket.io"]
    end

    subgraph data["Veri katmanı"]
        mauth[(MongoDB<br/>randevia_auth)]
        mappt[(MongoDB<br/>randevia_appointment)]
        mnotif[(MongoDB<br/>randevia_notification)]
        redis[(Redis<br/>Socket.io adapter)]
    end

    subgraph broker["RabbitMQ"]
        exchange{{"randevia.events<br/>(topic exchange)"}}
        queue[["appointment-events<br/>kuyruğu"]]
        retry[["retry kuyruğu<br/>(TTL ile gecikme)"]]
        dlq[["dead-letter<br/>kuyruğu"]]
    end

    browser -->|HTTPS / JSON| gateway
    browser <-->|"WebSocket<br/>/socket.io"| gateway
    gateway -->|/api/v1/auth| auth
    gateway -->|/api/v1/doctors<br/>/api/v1/appointments| appt
    gateway -->|/api/v1/notifications| notif
    gateway <-.->|"WS upgrade"| notif

    auth --> mauth
    appt --> mappt
    notif --> mnotif
    notif <-.-> redis

    appt -- "appointment.created<br/>appointment.confirmed<br/>appointment.cancelled" --> exchange
    exchange -->|appointment.*| queue
    queue -->|consume| notif
    notif -. "geçici hata" .-> retry
    retry -. "süre dolunca" .-> queue
    notif -. "bozuk mesaj /<br/>deneme hakkı bitti" .-> dlq
    notif -. "notification / slot.updated<br/>(anlık)" .-> browser
```

**JWT doğrulaması:** Token'ları yalnızca `auth-service` üretir. Diğer servisler aynı `JWT_ACCESS_SECRET` ile token'ı kendileri doğrular; her istekte auth-service'e senkron çağrı yapılmaz. Böylece auth-service geçici olarak erişilemez olsa bile geçerli token'a sahip kullanıcılar randevu ve bildirim işlemlerine devam edebilir.

### Randevu olayının yaşam döngüsü

```mermaid
sequenceDiagram
    autonumber
    participant P as Hasta (tarayıcı)
    participant D as Doktor (tarayıcı, socket bağlı)
    participant G as API Gateway
    participant A as appointment-service
    participant R as RabbitMQ
    participant N as notification-service

    P->>G: POST /api/v1/appointments (Bearer JWT)
    G->>A: isteği iletir (+ X-Request-Id, X-Forwarded-For)
    A->>A: JWT doğrula, çakışma kontrolü, kaydet
    A-->>G: 201 Created (status: pending)
    G-->>P: 201 Created
    A--)R: publish appointment.created (persistent, publisher confirm)
    R--)N: deliver
    N->>N: (eventId, recipientRole) ile upsert → hasta + doktor bildirimi
    N--)R: ack
    N--)G: Socket.io: "notification" → user:<doktorId> odası
    N--)G: Socket.io: "slot.updated" → doctor:<doktorId> odasını izleyen herkes
    G--)D: WebSocket üzerinden anlık iletim (sayfa yenilemeden)
    D->>D: Bildirim zili + toast güncellenir, müsaitlik yeniden çekilir
```

---

## Servisler

| Servis | Port | Sorumluluk | Veritabanı |
|---|---|---|---|
| **api-gateway** | 3000 (dışa açık) | Tek giriş noktası; yönlendirme (HTTP + WebSocket), helmet, CORS, rate limit, request id, upstream hata yönetimi (502/504), sistem sağlık kontrolü | — |
| **auth-service** | 4000 | Kayıt, giriş, token yenileme, profil, admin kullanıcı ve rol yönetimi, ilk admin'in otomatik oluşturulması | `mongo-auth` |
| **appointment-service** | 4001 | Doktor profilleri, müsaitlik takvimi, randevu oluşturma / onaylama / iptal; randevu olaylarını yayınlama; dolu saatleri (`bookedSlots`) raporlama | `mongo-appointment` |
| **notification-service** | 4002 | Randevu olaylarını tüketme, hasta ve doktor için bildirim üretme ve gönderme (simüle e-posta), bildirim listeleme/okundu işaretleme, **Socket.io sunucusu** ile anlık bildirim ve müsaitlik yayını | `mongo-notification` |
| **web** | 8080 (dışa açık) | React + Vite tabanlı web arayüzü; nginx ile statik olarak sunulur, yalnızca gateway ile konuşur | — |
| **rabbitmq** | 5672 / 15672 | Mesaj aracısı; `randevia.events` topic exchange, retry ve dead-letter kuyrukları | — |
| **redis** | (yalnızca iç ağ) | Socket.io Redis adapter; notification-service birden fazla örnekle çalışırken olayları örnekler arasında paylaştırır | — |

Her servis aynı iskeleti paylaşır: ortam değişkeni doğrulama (Zod), winston logger, merkezi hata yönetimi, `/api/v1/health` endpoint'i, graceful shutdown ve Jest testleri.

---

## Kullanılan Teknolojiler

| Alan | Teknoloji |
|---|---|
| Çalışma ortamı | Node.js 22, TypeScript 6 (strict) |
| Web framework | Express 5 |
| Veritabanı | MongoDB 7, Mongoose 9 |
| Mesajlaşma | RabbitMQ 3 (management), amqplib |
| Gerçek zamanlı | Socket.io 4 (JWT auth middleware, oda bazlı yayın), `@socket.io/redis-adapter`, Redis 7 |
| API Gateway | http-proxy-middleware (HTTP + WebSocket proxy), helmet, cors, express-rate-limit |
| Kimlik doğrulama | JSON Web Token (jsonwebtoken), bcryptjs, cookie-parser |
| Doğrulama | Zod 4 (istek gövdesi, parametreler, query ve ortam değişkenleri) |
| Loglama | winston (JSON), morgan |
| Web arayüzü | React 19, TypeScript, Vite, React Router, socket.io-client, nginx (üretim imajı) |
| Test | Jest 30, ts-jest, Supertest, socket.io-client (entegrasyon), Vitest + Testing Library (web bileşen testleri), Playwright (uçtan uca) |
| Kod kalitesi | ESLint 10 (typescript-eslint), Prettier, oxlint (web) |
| Altyapı | Docker (multi-stage build), Docker Compose, GitHub Actions (CI) |

---

## Kurulum

### Gereksinimler

- [Docker](https://docs.docker.com/get-docker/) ve Docker Compose v2
- (Yalnızca yerel geliştirme ve testler için) Node.js 20+ ve npm

### Tüm sistemi Docker ile çalıştırma

```bash
git clone <repo-url> randevia
cd randevia

# Gizli değerleri tanımla (zorunlu): .env içinde JWT_ACCESS_SECRET,
# JWT_REFRESH_SECRET ve ADMIN_PASSWORD alanlarını doldur.
cp .env.example .env
# Rastgele bir secret üretmek için:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

docker compose up -d --build
```

Repoda hiçbir gizli değerin varsayılanı yoktur: `.env` eksikse `docker compose up` hangi değişkenin eksik olduğunu söyleyerek durur. Servisler production modunda 32 karakterden kısa JWT secret'ıyla açılmaz.

Tüm konteynerler sağlık kontrollerine göre sırayla başlar: önce MongoDB'ler ve RabbitMQ, ardından servisler, en son gateway.

```bash
docker compose ps                                   # hepsi "healthy" olmalı
curl http://localhost:3000/api/v1/health/services   # tüm servislerin durumu
```

| Adres | Açıklama |
|---|---|
| http://localhost:8080 | **Web arayüzü** |
| http://localhost:3000 | API Gateway (tüm API istekleri, Socket.io dahil) |
| http://localhost:15672 | RabbitMQ yönetim paneli (`guest` / `guest`) |

Admin hesabı: `ADMIN_EMAIL` (varsayılan `admin@randevia.local`) ve `.env`'de belirlediğin `ADMIN_PASSWORD`. Şifre her açılışta `.env`'den yeniden uygulanır; değiştirip `docker compose up -d` çalıştırmak şifreyi yeniler.

> **Not:** `CORS_ORIGIN` varsayılan olarak `http://localhost:8080,http://localhost:5173` içerir (web arayüzünün üretim ve geliştirme adresleri). Giriş çerezinin ve Socket.io bağlantısının çalışması için tarayıcıdan açılan adresin bu listede olması gerekir; farklı bir adres/port kullanıyorsan `.env`'de güncelle.

Sistemi durdurmak için `docker compose down`, verileri de silmek için `docker compose down -v`.

### Örnek veriyle doldurma (isteğe bağlı)

Sistem ayaktayken, web arayüzünü boş görmemek için bir hasta, birkaç doktor profili ve yaklaşan müsaitlik ekler (tekrar çalıştırmak güvenlidir):

```bash
node scripts/seed-demo.mjs
```

Oluşturduğu hesaplar için bkz. [Demo Hesapları](#demo-hesapları).

### Uçtan uca testi çalıştırma

Sistem ayaktayken (admin bilgileri kök `.env` dosyasından okunur):

```bash
node scripts/e2e.mjs
```

Web arayüzünün gerçek zamanlı akışını iki tarayıcıyla (hasta + doktor) doğrulayan Playwright testi için [`web/e2e/README.md`](web/e2e/README.md) dosyasına bakın.

Her iki test de kendi oluşturduğu kullanıcı/doktor/randevu/bildirimi, çalışma biter bitmez (`scripts/clean-test-data.mjs` ile) otomatik temizler. Script, `@randevia.local` dışındaki her auth kullanıcısını ve ona referans veren her kaydı siler; demo hesapları ve seed doktorları (hepsi `@randevia.local`) etkilenmez. Elle de çalıştırılabilir:

```bash
node scripts/clean-test-data.mjs
```

### Yerel geliştirme (Docker olmadan servis çalıştırma)

```bash
docker compose up -d rabbitmq                 # mesaj aracısı
docker run -d --name randevia-mongo -p 27017:27017 mongo:7

cd auth-service
cp .env.example .env
npm install
npm run dev                                   # tsx watch ile sıcak yeniden yükleme
```

Diğer servisler için de aynı adımlar geçerlidir (`appointment-service`, `notification-service`, `api-gateway`). Her serviste kullanılabilen script'ler:

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (watch modu) |
| `npm run build` / `npm start` | TypeScript derleme / derlenmiş çıktıyı çalıştırma |
| `npm test` | Jest testleri |
| `npm run test:coverage` | Kapsam raporu ile testler |
| `npm run lint` / `npm run format:check` | ESLint / Prettier kontrolü (`src/` ve `tests/`) |

---

## Demo Hesapları

`node scripts/seed-demo.mjs` çalıştırıldığında aşağıdaki hesaplar oluşturulur (veya zaten varsa yeniden kullanılır):

| Rol | E-posta | Şifre |
|---|---|---|
| Hasta | `hasta@randevia.local` | `Demo12345!` |
| Doktor (Kardiyoloji) | `doktor@randevia.local` | `Demo12345!` |
| Admin | `.env` içindeki `ADMIN_EMAIL` (varsayılan `admin@randevia.local`) | `.env` içindeki `ADMIN_PASSWORD` |

Script ayrıca listeyi gerçekçi göstermek için farklı uzmanlıklarda birkaç doktor profili daha ekler (bunların giriş bilgileri belgelenmez, yalnızca içerik amaçlıdır).

---

## Ekran Görüntüleri

Aşağıdaki görüntüler, `docker compose up` ile ayağa kalkan ve `seed-demo.mjs` ile doldurulan gerçek sistemden, Playwright ile otomatik olarak alınmıştır. Canlı bildirim akışı için bkz. [README'nin en üstündeki GIF](#randevia). Her sayfanın hem açık hem koyu tema görüntüsü aşağıdadır.

| Sayfa | Açık tema | Koyu tema |
|---|---|---|
| Tanıtım ana sayfası | ![Ana sayfa](docs/screenshots/00-anasayfa.png) | ![Ana sayfa - koyu](docs/screenshots/00-anasayfa-dark.png) |
| Giriş | ![Giriş](docs/screenshots/01-giris.png) | ![Giriş - koyu](docs/screenshots/01-giris-dark.png) |
| Doktor listesi (arama/filtre) | ![Doktorlar](docs/screenshots/02-doktorlar.png) | ![Doktorlar - koyu](docs/screenshots/02-doktorlar-dark.png) |
| Doktor detayı – haftalık müsaitlik | ![Doktor detayı](docs/screenshots/03-doktor-detay.png) | ![Doktor detayı - koyu](docs/screenshots/03-doktor-detay-dark.png) |
| Randevularım | ![Randevularım](docs/screenshots/04-randevularim.png) | ![Randevularım - koyu](docs/screenshots/04-randevularim-dark.png) |
| Doktor paneli | ![Doktor paneli](docs/screenshots/05-doktor-paneli.png) | ![Doktor paneli - koyu](docs/screenshots/05-doktor-paneli-dark.png) |
| Admin paneli – istatistikler | ![Admin paneli](docs/screenshots/06-admin-paneli.png) | ![Admin paneli - koyu](docs/screenshots/06-admin-paneli-dark.png) |
| Mobil görünüm | ![Mobil görünüm](docs/screenshots/08-mobil-doktorlar.png) | ![Mobil görünüm - koyu](docs/screenshots/08-mobil-doktorlar-dark.png) |
| Profilim | ![Profilim](docs/screenshots/09-profilim.png) | ![Profilim - koyu](docs/screenshots/09-profilim-dark.png) |

---

## Yapılandırma

Kök dizindeki [`.env.example`](.env.example) docker compose için değiştirilebilir ayarları listeler. Her servisin kendi klasöründeki `.env.example` dosyası tüm ortam değişkenlerini açıklamalarıyla birlikte içerir. Başlıcaları:

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | — (zorunlu) | Token imzalama anahtarları (tüm servislerde aynı access secret); production'da en az 32 karakter |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | Token ömürleri |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@randevia.local` / — (zorunlu) | Açılışta oluşturulan admin; şifre her açılışta yeniden uygulanır |
| `CORS_ORIGIN` | `http://localhost:8080,http://localhost:5173` | Cookie ve Socket.io credentials gerektirdiği için `*` yerine web arayüzünün tam adresi/adresleri (virgülle ayrılmış) |
| `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | `300` / `20` | 15 dakikada IP başına genel / giriş-kayıt-yenileme limiti |
| `PROXY_TIMEOUT_MS` | `10000` | Gateway'in servis yanıtını bekleme süresi (aşılırsa 504) |
| `MESSAGE_MAX_RETRIES` / `MESSAGE_RETRY_DELAY_MS` | `3` / `5000` | Bildirim işleme yeniden deneme sayısı ve aralığı |
| `REDIS_URL` | `redis://localhost:6379` (compose'da `redis://redis:6379`) | Socket.io Redis adapter; erişilemezse notification-service tek örnek modunda çalışmaya devam eder |
| `WEB_PORT` / `WEB_API_BASE_URL` | `8080` / `http://localhost:3000` | Web arayüzünün dışa açık portu ve derleme anında gömülen gateway adresi |
| `TRUST_PROXY` | `0` (compose'da `1`) | Önündeki proxy sayısı; gerçek istemci IP'si için |
| `LOG_LEVEL` | `info` | `http` seviyesinde istek logları (request id ile) görünür |

---

## Endpoint Listesi

Tüm istekler gateway üzerinden yapılır: `http://localhost:3000`. 🔒 işaretli endpoint'ler `Authorization: Bearer <accessToken>` başlığı gerektirir.

### Sistem (api-gateway)

| Metot | Yol | Yetki | Açıklama |
|---|---|---|---|
| GET | `/api/v1/health` | — | Gateway canlılık kontrolü |
| GET | `/api/v1/health/services` | — | Tüm servislerin durumu ve gecikmesi; biri kapalıysa `503` |

### Kimlik doğrulama ve kullanıcılar (auth-service)

| Metot | Yol | Yetki | Açıklama |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | Hasta olarak kayıt olur; access token döner, refresh token cookie'ye yazılır |
| POST | `/api/v1/auth/login` | — | Giriş yapar |
| POST | `/api/v1/auth/refresh` | — | Refresh token (cookie veya gövde) ile yeni token çifti alır |
| GET | `/api/v1/auth/me` | 🔒 herkes | Oturumdaki kullanıcının profili |
| PATCH | `/api/v1/auth/me` | 🔒 herkes | Kendi adını günceller |
| PATCH | `/api/v1/auth/me/password` | 🔒 herkes | Şifresini değiştirir (mevcut şifre doğrulamalı) |
| GET | `/api/v1/auth/users?role=&page=&limit=` | 🔒 admin | Kullanıcıları listeler, role göre filtreler |
| GET | `/api/v1/auth/users/stats` | 🔒 admin | Role göre kullanıcı sayıları (admin paneli istatistikleri için) |
| PATCH | `/api/v1/auth/users/:id/role` | 🔒 admin | Kullanıcının rolünü değiştirir (`patient` / `doctor` / `admin`) |

### Doktorlar (appointment-service)

| Metot | Yol | Yetki | Açıklama |
|---|---|---|---|
| GET | `/api/v1/doctors` | 🔒 herkes | Doktorları listeler |
| GET | `/api/v1/doctors/:id` | 🔒 herkes | Doktor detayı, müsaitlik aralıkları ve dolu saatler (`bookedSlots`) |
| POST | `/api/v1/doctors/me` | 🔒 doctor | Kendi doktor profilini oluşturur / günceller (ad, uzmanlık, biyografi) |
| POST | `/api/v1/doctors/me/availability` | 🔒 doctor | Müsaitlik aralığı ekler |
| DELETE | `/api/v1/doctors/me/availability/:id` | 🔒 doctor | Kendi müsaitlik aralığını siler |

### Randevular (appointment-service)

| Metot | Yol | Yetki | Açıklama |
|---|---|---|---|
| POST | `/api/v1/appointments` | 🔒 patient | Randevu talebi oluşturur (`pending`); `appointment.created` olayı yayınlanır |
| GET | `/api/v1/appointments/me` | 🔒 patient, doctor | Kullanıcının randevuları |
| GET | `/api/v1/appointments/stats` | 🔒 admin | Durum dağılımı, toplam doktor/randevu sayısı ve 14 günlük günlük randevu trendi (admin paneli istatistikleri için) |
| PATCH | `/api/v1/appointments/:id/confirm` | 🔒 doctor | Randevuyu onaylar; `appointment.confirmed` olayı |
| PATCH | `/api/v1/appointments/:id/cancel` | 🔒 patient | Randevuyu iptal eder; `appointment.cancelled` olayı |

### Bildirimler (notification-service)

| Metot | Yol | Yetki | Açıklama |
|---|---|---|---|
| GET | `/api/v1/notifications/me?page=&limit=` | 🔒 herkes | Kullanıcının bildirimleri, en yeniden eskiye, sayfalı, okunmamış sayısıyla (`unreadCount`) birlikte |
| PATCH | `/api/v1/notifications/:id/read` | 🔒 herkes | Tek bir bildirimi okundu işaretler (yalnızca kendi bildirimi) |
| PATCH | `/api/v1/notifications/read-all` | 🔒 herkes | Kullanıcının tüm okunmamış bildirimlerini okundu işaretler |

### Yanıt formatı

Başarılı yanıtlar `{ "success": true, "data": { ... } }`, hatalar `{ "success": false, "message": "...", "details": { ... } }` biçimindedir. Gateway kaynaklı hatalar (`404`, `429`, `502`, `504`) ayrıca `requestId` alanını içerir. Her yanıtta `X-Request-Id` başlığı bulunur.

---

## Gerçek Zamanlı Olaylar (Socket.io)

Gateway, `/socket.io` yolundaki WebSocket trafiğini notification-service'e yönlendirir; istemci tarafı adresi gateway'dir (`http://localhost:3000`), notification-service'in kendisi değil.

**Bağlantı:** `io(GATEWAY_URL, { path: '/socket.io', auth: { token: accessToken } })`. Token geçersiz veya eksikse bağlantı `connect_error` ile reddedilir. Bağlanan her soket otomatik olarak kendi `user:<kullanıcıId>` odasına katılır.

| Olay | Yön | Açıklama |
|---|---|---|
| `doctor:watch` (`doctorId`) | istemci → sunucu | O doktorun sayfasını izlemeye başlar (`doctor:<doctorId>` odasına katılır) |
| `doctor:unwatch` (`doctorId`) | istemci → sunucu | İzlemeyi bırakır |
| `notification` (`{ notification, unreadCount }`) | sunucu → istemci | İlgili kullanıcının `user:<id>` odasına; randevu oluştuğunda/onaylandığında/iptal edildiğinde hem hastaya hem doktora gönderilir |
| `slot.updated` (`{ doctorId, appointmentId, date, status, eventType }`) | sunucu → istemci | O doktoru izleyen **herkese** (hasta veya doktor fark etmeksizin); web arayüzü bunu alınca doktor detayını yeniden çeker |

Birden fazla notification-service örneği çalıştığında (`docker compose up --scale notification-service=2` gibi), örnekler arasında olayları paylaştırmak için Redis adapter kullanılır; Redis'e erişilemezse servis yine de tek örnek modunda çalışmaya devam eder.

---

## Örnek Akış

```bash
GW=http://localhost:3000

# 1) Hasta kaydı
curl -s -X POST $GW/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ayşe Yılmaz","email":"ayse@example.com","password":"gizli-parola-123"}'

# 2) Doktor adayı önce hasta olarak kayıt olur, admin rolünü doktor yapar
ADMIN=$(curl -s -X POST $GW/api/v1/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@randevia.local\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r .data.accessToken)
curl -s -X PATCH $GW/api/v1/auth/users/<kullaniciId>/role \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"role":"doctor"}'

# 3) Doktor tekrar giriş yapar, profil ve müsaitlik ekler
curl -s -X POST $GW/api/v1/doctors/me -H "Authorization: Bearer $DOKTOR" \
  -H 'Content-Type: application/json' -d '{"specialty":"Kardiyoloji"}'

# 4) Hasta randevu alır, doktor onaylar
curl -s -X POST $GW/api/v1/appointments -H "Authorization: Bearer $HASTA" \
  -H 'Content-Type: application/json' -d '{"doctorId":"<doktorProfilId>","date":"2030-01-15T10:00:00.000Z"}'
curl -s -X PATCH $GW/api/v1/appointments/<randevuId>/confirm -H "Authorization: Bearer $DOKTOR"

# 5) Her iki taraf da bildirimlerini görür
curl -s $GW/api/v1/notifications/me -H "Authorization: Bearer $HASTA"
```

Bu akışın tamamı, doğrulamalarıyla birlikte [`scripts/e2e.mjs`](scripts/e2e.mjs) içinde otomatik olarak çalıştırılır.

---

## Testler ve Sonuçlar

Her servis, gerçek MongoDB ve RabbitMQ'ya karşı çalışan entegrasyon testleri ile birim testlerine sahiptir. Gateway testleri, süreç içinde başlatılan sahte upstream servislerle çalışır.

| Servis | Test sayısı | Kapsanan başlıca senaryolar |
|---|---:|---|
| auth-service | **50** ✅ | Kayıt, giriş, refresh (cookie ve gövde), `/me`, profil adı güncelleme, şifre değiştirme (mevcut şifre doğrulamalı), doktor rolüyle kendi kendine kayıt reddi, admin rol atama ve listeleme, kullanıcı istatistikleri (`/users/stats`), yetkisiz erişim (401/403), admin'in kendi rolünü değiştirememesi, admin bootstrap ve şifre rotasyonu, production'da zayıf secret reddi, validate middleware (Express 5 `req.query`) |
| appointment-service | **55** ✅ | Doktor profili (adıyla birlikte) ve müsaitlik ekleme/silme, randevu oluşturma, çakışma (409), onay/iptal kuralları, rol kısıtları, olay yayınlama, dolu saatlerin (`bookedSlots`) yalnızca pending/confirmed randevulardan gelmesi, randevu istatistikleri (durum dağılımı + 14 günlük trend, UTC'de), RabbitMQ kapalıyken iş akışının sürmesi, yeniden bağlanma, ortam değişkeni doğrulaması, validate middleware |
| notification-service | **50** ✅ | Olaydan bildirim üretimi, şablonlar, ack/nack kararları, gecikmeli retry, deneme hakkı bitince DLQ, bozuk mesajın DLQ'ya gitmesi, idempotency, sayfalama, okundu işaretleme (tekil/toplu, başkasının bildirimini okuyamama), **Socket.io**: yetkisiz/geçersiz token reddi, doğru kullanıcıya doğru `notification` olayı ve unread count, başkasına sızmaması, `doctor:watch` ile `slot.updated` yayını, ortam değişkeni doğrulaması |
| api-gateway | **28** ✅ | Yönlendirme ve yol koruma, gövde/başlık/cookie aktarımı, request id üretme/taşıma/temizleme, helmet, CORS (liste, `*`, preflight, upstream başlıklarının ezilmesi), genel ve giriş limitleri (429), 502/504, sağlık kontrolleri, **gerçek bir Socket.io el sıkışmasının ve mesajının websocket upgrade üzerinden notification-service'e iletilmesi** |
| **Toplam** | **183** ✅ | |

**Uçtan uca test** (`scripts/e2e.mjs`, `docker compose up` ile ayağa kalkan gerçek sisteme karşı, yalnızca gateway üzerinden): **34/34 kontrol başarılı** ✅ — sağlık, request id, güvenlik başlıkları, rate limit başlıkları, kayıt, rol atama, doktor profili ve müsaitlik, randevu alma, çift rezervasyon engeli, onay, iptal, RabbitMQ üzerinden hasta ve doktora iletilen bildirimler, sayfalama ve kuyruk topolojisi. Her koşu, kendi oluşturduğu test verisini sonunda otomatik temizler (`scripts/clean-test-data.mjs`).

**Web birim/bileşen testleri** ([`web/vitest.config.ts`](web/vitest.config.ts), Vitest + Testing Library, `npm test`): **27/27** ✅ — `avatarColor`/`isValidEmail` gibi saf mantık, `FieldError`/`EmptyState`/`ConfirmDialog`/`ThemeToggle` bileşenleri, ve API'si mock'lanmış `DoctorsListPage` (listeleme, arama, uzmanlık filtresi, boş durum, hata durumu).

**Web arayüzü uçtan uca testi** ([`web/e2e/realtime.spec.ts`](web/e2e/realtime.spec.ts), Playwright, gerçek `docker compose` sistemine karşı): iki ayrı tarayıcı bağlamı açar (hasta ve doktor), hasta gerçek arayüz üzerinden bir doktora randevu alır ve doktorun ekranında **sayfa hiç yenilenmeden** bildirim zilinin, okunmamış sayısının ve toast mesajının anlık olarak belirdiğini doğrular — bkz. [`web/e2e/README.md`](web/e2e/README.md).

**CI (GitHub Actions, [`.github/workflows/ci.yml`](.github/workflows/ci.yml)):** her push ve pull request'te dört backend servisi (Mongo + RabbitMQ + Redis servis konteynerleriyle) ve web için lint, tip kontrolü/derleme ve testler çalışır; ayrıca beş Dockerfile'ın da hâlâ build olduğu ayrıca doğrulanır.

Canlı sistem üzerinde ayrıca elle doğrulanan senaryolar:

- notification-service kapalıyken yayınlanan bir olay kuyrukta bekledi ve servis açıldığında işlendi (**olay kaybı yok**).
- Aynı olay ikinci kez gönderildiğinde yeni bildirim oluşmadı (**idempotency**).
- Geçersiz JSON içeren mesaj doğrudan dead-letter kuyruğuna düştü, tüketici çalışmaya devam etti.
- Gateway'e gönderilen `X-Request-Id`, hem gateway hem auth-service loglarında aynı değerle göründü; servisler gerçek istemci IP'sini gördü.

Testleri çalıştırmak için (MongoDB `localhost:27017` ve RabbitMQ `localhost:5672` erişilebilir olmalı):

```bash
cd auth-service && npm test
```

---

## Tasarım Kararları

### Database-per-service

Her servisin kendi MongoDB örneği vardır ve hiçbir servis başka bir servisin veritabanına erişmez. Bu sayede servisler bağımsız olarak geliştirilebilir, ölçeklenebilir ve dağıtılabilir; bir servisin şema değişikliği diğerlerini etkilemez, bir veritabanındaki sorun yalnızca sahibini etkiler.

Servisler arasında ihtiyaç duyulan veri, senkron sorgu yerine **JWT içeriği** (kullanıcı kimliği ve rolü) ve **olay yükü** (event payload) ile taşınır. Örneğin `appointment.created` olayı, bildirim servisinin ihtiyaç duyduğu hasta ve doktor kimliklerini ve randevu tarihini içerir; bildirim servisi randevu veritabanını sorgulamak zorunda kalmaz. Bunun bedeli, servisler arasında **nihai tutarlılık** (eventual consistency) kabul edilmesidir.

### Event-driven iletişim

Randevu oluşturma, onaylama ve iptal işlemleri `randevia.events` adlı bir **topic exchange**'e `appointment.created`, `appointment.confirmed`, `appointment.cancelled` routing key'leriyle yayınlanır. appointment-service bildirim servisinin varlığından habersizdir; yeni bir tüketici (ör. SMS veya raporlama servisi) eklemek için yalnızca yeni bir kuyruğu exchange'e bağlamak yeterlidir.

- Mesajlar **persistent** olarak ve **publisher confirm** ile gönderilir; broker mesajı diske yazdığını onaylamadan yayın başarılı sayılmaz.
- Kuyruklar **durable**'dır; tüketici kapalıyken gelen olaylar kuyrukta bekler.
- Yayınlama "best-effort"tur: RabbitMQ erişilemezse randevu işlemi yine başarılı olur, olay loglanır ve bağlantı üstel geri çekilme (exponential backoff + jitter) ile yeniden kurulur. Bu boşluğu tamamen kapatmak için outbox pattern [yol haritasındadır](#yol-haritası).

### Dead-letter queue ve yeniden deneme

Bildirim servisi her mesaj için açık bir ack/nack kararı verir:

| Durum | Karar |
|---|---|
| Başarıyla işlendi | `ack` |
| Bozuk mesaj (geçersiz JSON veya şemaya uymuyor) | `nack(requeue=false)` → doğrudan **DLQ** (tekrar denemenin anlamı yok) |
| Geçici hata, deneme hakkı var | Mesaj `x-retry-count + 1` başlığıyla **retry kuyruğuna** kopyalanır, orijinal `ack`'lenir |
| Geçici hata, deneme hakkı bitti | `nack(requeue=false)` → **DLQ** |

Retry kuyruğunun tüketicisi yoktur; mesaja verilen TTL (`MESSAGE_RETRY_DELAY_MS`) dolunca RabbitMQ mesajı dead-letter mekanizmasıyla ana kuyruğa geri gönderir. Böylece uygulama içinde zamanlayıcı tutmadan **gecikmeli yeniden deneme** elde edilir. İşleme hatalarında hiçbir zaman `requeue=true` kullanılmaz; bu, hatalı bir mesajın kuyrukta sonsuz döngüye girmesini (poison message) engeller. DLQ'daki mesajlar incelenip gerekirse elle yeniden kuyruğa alınabilir.

### Idempotency

RabbitMQ **en az bir kez** (at-least-once) teslim garantisi verir: bağlantı koptuğunda veya servis ack göndermeden çöktüğünde aynı mesaj yeniden teslim edilir. Bu nedenle bildirim işleme idempotent tasarlanmıştır:

- Her olayın benzersiz bir `eventId`'si (UUID) vardır.
- Bildirimler `(eventId, recipientRole)` üzerinde **benzersiz indeks** ile `upsert` edilir; aynı olay kaç kez gelirse gelsin hasta ve doktor için en fazla birer kayıt oluşur.
- Yalnızca `pending` durumundaki bildirimler gönderilir ve ardından `sent` olarak işaretlenir. Gönderim yarıda kalırsa yeniden teslimde iş kaldığı yerden tamamlanır, gönderilmiş bildirim tekrar gönderilmez.

### API Gateway

İstemciler servislerin adreslerini bilmez; tek bir adresle konuşur. Ortak kaygılar (güvenlik başlıkları, CORS, rate limiting, request id, upstream hata yönetimi) tek bir yerde çözülür:

- İstek gövdeleri ayrıştırılmadan **stream** edilir; yollar değiştirilmeden iletilir.
- CORS kararı yalnızca gateway'de verilir, servislerden gelen CORS başlıkları temizlenir.
- `X-Forwarded-For` eklenir, servisler `TRUST_PROXY=1` ile gerçek istemci IP'sini görür; aksi halde servislerin kendi rate limiter'ları tüm kullanıcıları tek bir IP gibi sayardı.
- Giriş, kayıt ve token yenileme için daha sıkı bir limit uygulanarak kaba kuvvet saldırıları zorlaştırılır.
- Erişilemeyen servis için `502`, zaman aşımında `504` JSON yanıtı döner.

### Yetkilendirme ve rol yönetimi

Herkes yalnızca **hasta** olarak kayıt olabilir; `role: "doctor"` ile kayıt isteği `400` ile reddedilir. Doktor (ve admin) rolü yalnızca admin tarafından `PATCH /api/v1/auth/users/:id/role` ile atanır. İlk admin, açılışta `ADMIN_EMAIL` / `ADMIN_PASSWORD` değişkenlerinden oluşturulur. Admin'in kendi rolünü değiştirmesi engellenmiştir (sistemin admin'siz kalmaması için). Yeni rol, kullanıcının bir sonraki access token'ında geçerli olur (en geç `JWT_ACCESS_EXPIRES_IN` sonra, `/refresh` ile hemen).

### Türkçe hata ve uyarı mesajları

Kullanıcının görebileceği her metin Türkçedir: doğrulama hataları, 401/403/404/409/429 mesajları, gateway'in 502/504 yanıtları, başarı mesajları ve arayüzdeki tüm metinler. Kod tarafı (değişken/fonksiyon/dosya adları, loglar, commit mesajları, URL'ler) İngilizce kalır — ayrım, "kullanıcıya gösterilen" ile "geliştiriciye/sisteme ait" arasındadır.

Elle yazılan her `ApiError` mesajı ve her Zod şema mesajı Türkçeye çevrildi; ayrıca Zod v4'ün kendi ürettiği mesajlar (örn. bir enum'a özel mesaj yazılmadıysa "geçersiz seçenek" hatası) için `zod/locales`'teki hazır Türkçe sözlük üç servisin açılışında (`z.config(tr())`) etkinleştirildi. Böylece gelecekte eklenecek yeni bir şemaya mesaj yazmayı unutsak bile kullanıcı İngilizce bir hata görmez.

### Gerçek zamanlı katman (Socket.io + Redis)

Socket.io sunucusu notification-service içinde, REST API ile aynı HTTP sunucusu üzerinde çalışır; gateway, `/socket.io` yolundaki hem normal hem websocket-upgrade isteklerini oraya proxy'ler, böylece istemci tek bir adres (gateway) bilir. Bağlantı anında `io.use` middleware'i JWT'yi `verifyAccessToken` ile doğrular (REST istekleriyle aynı fonksiyon); geçersiz veya eksik token `connect_error` ile reddedilir. Her soket kendi `user:<id>` odasına katılır; bir doktorun sayfasını izleyen herkes (rolünden bağımsız) isteğe bağlı olarak `doctor:<doctorId>` odasına katılabilir.

Bildirim üretimiyle gerçek zamanlı yayın aynı yerde (`processAppointmentEvent`) tetiklenir: RabbitMQ'dan tüketilen her olay, veritabanına yazıldıktan hemen sonra ilgili kullanıcılara `notification` ve doktoru izleyenlere `slot.updated` olarak yayınlanır — yani WebSocket yayını da RabbitMQ'nun dayanıklılığından (retry/DLQ) faydalanır; olay kaybolmaz, yalnızca anlık bildirim "en iyi çaba" ile iletilir (socket bağlı değilse kullanıcı bir sonraki `GET /notifications/me` çağrısında aynı veriyi zaten görür).

Redis adapter bağlantısı **en iyi çaba** (best-effort) ile kurulur ve beklenmez: Redis açılışta erişilemezse servis yine de tek örnek modunda normal çalışır, tıpkı RabbitMQ bağlantısının ele alınma şekli gibi. Bu, sistemin tek bir notification-service örneğiyle Redis olmadan da çalışabilmesini sağlarken, birden fazla örnek çalıştırıldığında (yatay ölçekleme) olayların tüm örnekler arasında paylaşılmasına da imkân tanır.

### Web arayüzü

React SPA, sunucu adreslerini bilmez; yalnızca gateway'in adresiyle konuşur (REST ve Socket.io için aynı adres). Erişim token'ı yalnızca bellekte tutulur (XSS'e karşı `localStorage` kullanılmaz); sayfa yenilendiğinde `httpOnly` refresh çerezi ile sessizce yeni bir access token alınır. Bu nedenle `CORS_ORIGIN`'in gateway'de tam olarak web arayüzünün adresine ayarlanması gerekir (`*` ile credentials'lı istekler tarayıcı tarafından reddedilir).

Doktor detay sayfasındaki "müsait saatler" listesi, müsaitlik aralıklarından (30 dakikalık adımlarla) istemci tarafında üretilir ve `bookedSlots` ile karşılaştırılır; `slot.updated` olayı geldiğinde sayfa tamamen yeniden çekilir (ince taneli, kısmi state güncellemesi yerine) — daha az kod ile her zaman doğru sonucu garanti eder.

**Doktorun adı nereden geliyor?** appointment-service, auth-service'e senkron çağrı yapmaz; JWT de yalnızca kullanıcı kimliği ve rolünü taşır, adını değil. Bu yüzden doktor profilini oluşturduğunda (veya seed script çalıştığında) doktorun adı appointment-service'teki `Doctor` dokümanına da yazılır (denormalize edilir) — doktor kartlarının ve detay sayfasının başlık olarak gerçek bir ad gösterebilmesinin tek yolu budur.

**Tasarım sistemi:** Inter yazı tipi, teal/mavi marka paleti, doktor adından türetilen deterministik renkli avatarlar (aynı doktor her zaman aynı rengi alır), uzmanlık için rozet (badge), randevu durumları için renkli rozetler, kartlarda yumuşak hover efektleri, liste yüklenirken iskelet (skeleton) yer tutucular ve her boş liste için tutarlı bir "boş durum" bileşeni. Logo, takvim ve nabız çizgisini birleştiren özgün bir SVG ikon + "Randevia" yazısından oluşur; favicon, üst menü ve giriş/kayıt sayfası karşılama alanında aynı logo kullanılır.

### Diğer kararlar

- **Graceful shutdown:** `SIGTERM` alındığında HTTP sunucusu yeni istek almayı bırakır, bildirim servisi önce tüketiciyi iptal edip işlenmekte olan mesajları bitirir, ardından RabbitMQ ve MongoDB bağlantıları kapatılır. Docker imajlarında `node` doğrudan ana süreçtir, böylece sinyal kaybolmaz.
- **Güvenli imajlar:** Multi-stage build ile çalışma imajında yalnızca üretim bağımlılıkları ve derlenmiş kod bulunur; konteynerler root olmayan `node` kullanıcısıyla çalışır.
- **Fail-fast yapılandırma:** Tüm ortam değişkenleri açılışta Zod ile doğrulanır; eksik veya hatalı yapılandırmada servis hiç başlamaz.
- **Varsayılan gizli değer yok:** JWT secret'ları ve admin şifresi repoda tutulmaz, `.env`'den gelir; production'da kısa (ör. `changeme`) JWT secret'ları reddedilir. JWT secret'ını bilen biri herhangi bir kullanıcı ve rol için token üretebileceği için bu bir zorunluluktur.

---

## Proje Yapısı

```
randevia/
├── .github/workflows/ci.yml # Her push/PR'da lint + tip kontrolü + test + docker build
├── api-gateway/            # Tek giriş noktası (port 3000), HTTP + WS proxy
├── auth-service/           # Kimlik doğrulama ve roller (port 4000)
├── appointment-service/    # Doktorlar ve randevular (port 4001)
├── notification-service/   # Bildirimler + Socket.io sunucusu (port 4002)
├── web/                    # React + Vite web arayüzü (port 8080, nginx)
├── docs/screenshots/       # README'deki ekran görüntüleri
├── scripts/
│   ├── e2e.mjs             # Uçtan uca REST testi
│   ├── seed-demo.mjs       # Demo hesapları ve örnek veri
│   └── clean-test-data.mjs # @e2e.test test verisini temizler
├── docker-compose.yml      # Tüm sistem: 5 servis + 3 MongoDB + RabbitMQ + Redis
└── .env.example            # docker compose ayarları
```

auth-service, appointment-service, notification-service ve api-gateway aynı katmanlı yapıyı izler:

```
<servis>/
├── src/
│   ├── config/         # ortam değişkenleri (Zod), veritabanı bağlantısı
│   ├── controllers/    # HTTP katmanı
│   ├── services/       # iş kuralları
│   ├── models/         # Mongoose şemaları
│   ├── routes/         # Express router'ları
│   ├── middlewares/    # authenticate, authorize, validate, hata yönetimi
│   ├── validations/    # Zod istek şemaları
│   ├── messaging/      # RabbitMQ bağlantısı, publisher / consumer
│   ├── events/         # olay sözleşmeleri
│   ├── realtime/       # (yalnızca notification-service) Socket.io sunucusu
│   ├── app.ts          # Express uygulaması
│   └── server.ts       # açılış ve graceful shutdown
├── tests/              # unit/ ve integration/
├── Dockerfile
└── package.json
```

`web/` React SPA olarak ayrı bir yapı izler:

```
web/
├── src/
│   ├── api/            # gateway'e REST çağrıları (fetch istemcisi dahil)
│   ├── auth/            # AuthContext: oturum, token yenileme
│   ├── socket/           # SocketContext: Socket.io bağlantısı
│   ├── context/          # NotificationContext: zil, toast, okundu işaretleme
│   ├── components/       # Layout, bildirim zili, korumalı route'lar
│   ├── pages/            # giriş/kayıt, doktorlar, randevularım, paneller
│   └── types/            # paylaşılan API tipleri
├── e2e/                  # Playwright uçtan uca testi
├── Dockerfile            # çok aşamalı derleme + nginx
└── nginx.conf
```

---

## Yol Haritası

- **Outbox pattern:** Olayın randevu kaydıyla aynı veritabanı işleminde bir outbox koleksiyonuna yazılıp ayrı bir süreçle yayınlanması; RabbitMQ kapalıyken bile olay kaybını tamamen önler.
- Gerçek e-posta / SMS sağlayıcı entegrasyonu (şu an gönderim simüle edilip loglanıyor).
- Refresh token rotasyonu ve iptali (logout, token blacklist).
- Dağıtık rate limiting için gateway'de Redis store (şu an yalnızca Socket.io adapter'ı Redis kullanıyor).
- OpenAPI / Swagger dokümantasyonu.
- CI pipeline (GitHub Actions) ile lint, test ve imaj build.
- Web arayüzü için bileşen/birim testleri (şu an yalnızca uçtan uca Playwright testi var).
- Doktor panelinde müsaitlik silme/düzenleme ve randevu geçmişinde sayfalama.

---

## Geliştirici

**Mustafa Ulu**
