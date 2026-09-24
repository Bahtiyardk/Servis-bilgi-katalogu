# Servis-bilgi-katalogu

Statik teknik bilgi sitesi. Marka, model ve hata koduna göre yerel JSON kataloglarında arama yapar.

## Giriş bilgileri

- **Kullanıcı adı:** `admin`
- **Şifre:** `43214321`

## Kimlik doğrulama notu

Bu repo statik olarak yayınlandığı için giriş kontrolü tamamen istemci tarafında uygulanır. Amaç, ana içeriği giriş yapılmadan göstermemek ve normal kullanım akışında görünürlüğü sınırlamaktır; bu yapı gerçek sunucu tarafı güvenlik veya güçlü erişim kontrolü sağlamaz.

## GitHub Pages uyumluluğu

- Tüm stil, script ve veri yolları göreli (`./...`) bırakıldı; böylece proje alt dizinde de açılabilir.
- `.nojekyll` dosyası eklendi; GitHub Pages yayınında Jekyll dönüşümü devre dışı kalır ve statik dosyalar olduğu gibi sunulur.
- `_headers` dosyası GitHub Pages tarafından uygulanmaz; yalnızca destekleyen platformlarda anlamlıdır.

## Yerelde açma

Herhangi bir statik sunucu ile çalıştırabilirsiniz. Örneğin:

```bash
python -m http.server 8000
```

Sonra `http://localhost:8000` adresini açın.

## GitHub Pages'e yayınlama

1. Yayınlamak istediğiniz dalı GitHub'a gönderin.
2. GitHub'da **Settings > Pages** bölümüne gidin.
3. **Deploy from a branch** seçin.
4. Kaynak olarak yayınlamak istediğiniz dalı ve kök dizini (`/root`) seçin.
5. Yayın tamamlandığında oluşan GitHub Pages URL'sini açın ve giriş ekranı üzerinden doğrulayın.