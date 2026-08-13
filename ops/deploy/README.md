# Atomowe publikacje Artway-TM

Produkcja nie kopiuje już plików bezpośrednio do katalogu obsługiwanego przez
Nginx. Każda wersja powstaje w osobnym katalogu:

```text
/srv/artway/releases/
├── 20260722-120000-abcdef123456/
├── 20260722-130000-fedcba654321/
└── current -> 20260722-130000-fedcba654321/
```

Nginx obsługuje wyłącznie `/srv/artway/releases/current`. Polecenie:

```bash
cd /srv/artway/shop
npm run deploy:atomic
```

wykonuje kolejno:

1. kontrolę aktualności zbudowanych plików,
2. zbudowanie kompletnego, niezmiennego katalogu wydania,
3. zapis manifestu z sumą SHA-256 każdego pliku,
4. atomowe przełączenie symlinku,
5. sprawdzenie backendu i publicznego `release.json`,
6. automatyczny rollback po dowolnym nieudanym health-checku,
7. zapis historii oraz zachowanie ośmiu ostatnich wersji.

Równoległe uruchomienie blokuje plik `.deploy.lock`. Nie wolno ręcznie
nadpisywać plików wewnątrz aktywnego wydania. Kod aplikacji przechodzi najpierw
workflow `.github/workflows/ci.yml`: czysty build, pełne testy, audyt
architektury i kontrolę podatności zależności.

Awaryjny powrót polega na atomowym wskazaniu poprzedniego katalogu przez
symlink `current`; standardowy skrypt robi to sam, jeśli kontrola nowego
wydania nie powiedzie się.

