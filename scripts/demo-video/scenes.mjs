// Single source of truth for scene order, ids and bilingual captions. Every
// other script in this folder reads this list instead of repeating it.
export const SCENES = [
  {
    id: '01-tanitim-giris-arama',
    tr: { title: 'Tanıtım sayfası ve doktor arama', subtitle: 'Hasta girişi, isim/branş filtresi, haftalık müsaitlik takvimi' },
    en: { title: 'Landing page and doctor search', subtitle: 'Patient login, name/specialty filter, weekly availability calendar' },
  },
  {
    id: '02-split-screen-rezervasyon',
    tr: { title: 'Gerçek zamanlı bildirim', subtitle: 'Hasta randevu alır almaz doktorun ekranına, sayfa yenilenmeden bildirim düşer' },
    en: { title: 'Real-time notification', subtitle: "The moment the patient books, the doctor's screen updates live - no reload" },
  },
  {
    id: '03-randevularim-ics',
    tr: { title: 'Randevularım ve takvime ekleme', subtitle: 'Onaylanan randevu için gerçek bir .ics dosyası indirilir' },
    en: { title: 'My appointments and calendar export', subtitle: 'A confirmed appointment downloads as a real .ics calendar file' },
  },
  {
    id: '04a-tema',
    tr: { title: 'Açık / koyu tema', subtitle: 'Tercih localStorage’da kalıcı, FOUC yok' },
    en: { title: 'Light / dark theme', subtitle: 'Preference persists in localStorage, no flash of unstyled content' },
  },
  {
    id: '04b-mobil',
    tr: { title: 'Mobil uyumlu arayüz', subtitle: 'Tek sütunlu grid ve hamburger menü' },
    en: { title: 'Responsive mobile layout', subtitle: 'Single-column grid and a hamburger menu' },
  },
  {
    id: '05-admin-panel',
    tr: { title: 'Admin paneli', subtitle: 'Kullanıcı/randevu istatistikleri, rol atama' },
    en: { title: 'Admin panel', subtitle: 'User/appointment statistics, role assignment' },
  },
  {
    id: '06-teknik',
    tr: { title: 'Gözlemlenebilirlik ve dokümantasyon', subtitle: 'RabbitMQ kuyrukları, Grafana, Jaeger dağıtık izleme, Swagger' },
    en: { title: 'Observability and documentation', subtitle: 'RabbitMQ queues, Grafana, Jaeger distributed tracing, Swagger' },
  },
];

export const RAW_DIR = 'raw';
export const CLIPS_DIR = 'clips';
export const FINAL_DIR = 'final';
