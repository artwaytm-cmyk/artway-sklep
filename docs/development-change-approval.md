# Zasada audytu i zatwierdzania zmian

Od 30 lipca 2026 r. każda nowa zmiana funkcjonalna lub konstrukcyjna w Artway‑TM
jest poprzedzana raportem dla administratora. Raport powstaje przed edycją kodu i
zawiera:

1. stan faktyczny oraz dowody problemu;
2. pełną listę wykrytych przyczyn i skutków;
3. docelowe zachowanie interfejsu, danych, API i procesów w tle;
4. dokładny zakres plików i elementów, które mają zostać zmienione;
5. sposób migracji i ochrony istniejących danych;
6. kryteria odbioru, testy oraz plan jednej publikacji końcowej;
7. ograniczenia zewnętrzne, których kod sklepu nie może sam usunąć.

Implementacja rozpoczyna się po zatwierdzeniu raportu przez administratora.
Wyjątkiem jest wyłącznie pilna, minimalna naprawa awarii lub podatności
bezpieczeństwa; po niej raport i test regresji są uzupełniane niezwłocznie.

Zmiana jest uznana za ukończoną dopiero, gdy:

- zapis centralny i odczyt kontrolny potwierdzają nowy stan;
- testy modułowe, funkcjonalne i przeglądarkowe odpowiednie do zakresu przechodzą;
- budżety architektury nie mają nowych przekroczeń;
- wydanie zostało opublikowane atomowo na VPS i sprawdzone po wdrożeniu;
- administrator otrzymał checklistę potwierdzającą każdy zatwierdzony punkt.
