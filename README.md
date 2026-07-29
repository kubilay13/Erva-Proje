# TaskFlow - Görev Yönetim Servisi

TaskFlow, ekip görevlerini yönetmek için yazılmış küçük bir REST API servisidir. Görevler bellek içi repository ile saklanır; görev oluşturulurken şehir adına göre Open-Meteo üzerinden güncel sıcaklık alınır ve görev tamamlandığında iki farklı bildirim kanalı tetiklenir.

## Teknoloji Tercihi

Bu proje Node.js ve Express ile geliştirildi. Express seçildi çünkü küçük REST API'ler için sade, yaygın ve okunması kolay bir yapı sunuyor. Projede controller, service ve repository katmanları ayrı tutuldu; bu sayede HTTP detayları, iş kuralları ve veri erişimi birbirine karışmıyor.

Open-Meteo entegrasyonu iki resmi endpoint kullanır:

- Geocoding API: https://open-meteo.com/en/docs/geocoding-api
- Forecast API current weather alanı: https://open-meteo.com/en/docs

## Kurulum

```bash
npm install
copy ervaproje\.env.example ervaproje\.env
npm start
```

Windows PowerShell kullanıyorsanız `.env.example` dosyasını elle `ervaproje/.env` olarak da kopyalayabilirsiniz. Uygulama kodu `ervaproje` klasöründedir; repo kökündeki `npm install`, `npm start` ve `npm test` komutları otomatik olarak o klasöre yönlenir.

Varsayılan port `3000` olur. Servis çalışınca sağlık kontrolü:

```bash
curl http://localhost:3000/health
```

## Test

```bash
npm test
```

Testlerde Node.js'in yerleşik `node:test` modülü kullanıldı. Test seti görev oluşturma, listeleme, tek görev getirme, kısmi güncelleme, tamamlama ve silme akışını kapsar. Ayrıca geçersiz `priority` için `400`, eksik alan doğrulaması için `400`, olmayan görev için `404` ve beklenmeyen hata için `500` cevapları kontrol edilir. Dış hava durumu servisi hata verdiğinde görev oluşturmanın başarısız olmaması mock servis ile test edilir. Bildirim tarafında da görev tamamlanınca notification service'in iki farklı kanala gönderim yaptığı doğrulanır.

Beklenen başarılı test özeti:

```text
tests 8
pass 8
fail 0
```

## Environment Variables

`.env.example` içeriği:

```bash
PORT=3000
OPEN_METEO_GEOCODING_URL=https://geocoding-api.open-meteo.com/v1/search
OPEN_METEO_FORECAST_URL=https://api.open-meteo.com/v1/forecast
WEATHER_TIMEOUT_MS=3000
```

## Endpointler

### Görev Oluştur

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Sprint planla\",\"description\":\"Haftalık işleri çıkar\",\"priority\":\"high\",\"city\":\"Istanbul\"}"
```

### Görevleri Listele

```bash
curl "http://localhost:3000/api/v1/tasks?status=pending&priority=high&page=1&limit=10"
```

### Tek Görev Getir

```bash
curl http://localhost:3000/api/v1/tasks/TASK_ID
```

### Görevi Güncelle

```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d "{\"priority\":\"medium\",\"city\":\"Ankara\"}"
```

### Görevi Tamamla

```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/TASK_ID/complete
```

Bu endpoint çalıştığında sunucu terminalinde iki bildirim satırı görünür:

```text
[LogNotifier] Task completed: TASK_ID - TASK_TITLE
[EmailNotifier] Completion email sent for task: TASK_ID
```

### Görevi Sil

```bash
curl -X DELETE http://localhost:3000/api/v1/tasks/TASK_ID
```

## Hata Formatı

Tüm hata cevapları aynı gövde formatını kullanır:

```json
{
  "error": {
    "code": "INVALID_PRIORITY",
    "message": "Priority must be one of: low, medium, high."
  }
}
```

Doğrulama hataları `400`, bulunamayan görevler `404`, beklenmeyen hatalar `500` döner.

Geçersiz priority örneği:

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Hatalı görev\",\"description\":\"Priority testi\",\"priority\":\"urgent\",\"city\":\"Istanbul\"}"
```

Beklenen cevap:

```json
{
  "error": {
    "code": "INVALID_PRIORITY",
    "message": "Priority must be one of: low, medium, high."
  }
}
```

## Klasör Yapısı

```text
ervaproje/
  app.js
  bin/www
  src/
    config/
    controllers/
    errors/
    middlewares/
    notifiers/
    repositories/
    routes/
    services/
    utils/
  tests/
```

Route dosyası yalnızca URL ile controller fonksiyonlarını eşler. Controller HTTP request/response işini yönetir. Service katmanı doğrulama, iş kuralları, hava durumu alma ve bildirim tetikleme gibi davranışları içerir. Repository bellek içi Map kullanır ama dışarıya küçük bir veri erişim arayüzü sunduğu için ileride gerçek veritabanına geçiş daha az değişiklik ister.

## Bildirim Tasarımı

Bildirimler `NotificationService` üzerinden yönetilir ve her kanal `send(task)` fonksiyonuna sahip ayrı bir modül olarak yazılır. Şu an `LogNotifier` ve `EmailNotifier` var; ikisi de gerçek gönderim yerine `console.log` ile simülasyon yapar. Yeni bir Slack kanalı eklemek için `SlackNotifier` gibi yeni bir sınıf yazıp notifier listesine eklemek yeterlidir. Görev tamamlama akışı belirli bir kanala bağlı olmadığı için service katmanı Slack, email veya log detaylarını bilmez.

## Manuel Kontrol Akışı

Servisi bir terminalde çalıştırın:

```bash
npm start
```

Başka bir terminalden sırasıyla görev oluşturun, dönen `id` değerini kullanarak listeleyin, tekil kaydı getirin, güncelleyin, tamamlayın ve silin. `PATCH /api/v1/tasks/:id/complete` çağrısından sonra `npm start` çalışan terminalde `LogNotifier` ve `EmailNotifier` satırları görünmelidir. Veriler in-memory tutulduğu için servis yeniden başlatıldığında kayıtlar sıfırlanır.

## Vaktim Olsaydı

- Kalıcı veri için PostgreSQL veya MongoDB repository implementasyonu eklerdim.
- Request doğrulamasını Joi/Zod gibi bir şema kütüphanesiyle daha standart hale getirirdim.
- OpenAPI/Swagger dokümantasyonu ve Postman collection eklerdim.
- NotificationService için retry ve ayrı loglama stratejisi eklerdim.
- CI pipeline ile her PR'da testleri otomatik çalıştırırdım.

## Git Akışı Notu

Geliştirme `feature/taskflow-api` branch'i üzerinde küçük commitlerle yapılacak şekilde düzenlendi. GitHub üzerinde PR açarken açıklama olarak şu kısa metin kullanılabilir:

```text
TaskFlow REST API endpointleri, Open-Meteo hava durumu entegrasyonu, bildirim tasarımı ve temel testler eklendi.
```
