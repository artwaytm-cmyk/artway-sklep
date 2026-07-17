export const MAPA_STATUS_EMAIL = Object.freeze({
  'w realizacji': 'przygotowanie',
  'gotowe do wysyłki': 'przygotowanie',
  nadane: 'nadanie',
  wysłane: 'nadanie',
  dostarczone: 'dostarczenie',
  zakończone: 'dostarczenie',
  zwrot: 'zwrot',
  'zwrot pieniędzy': 'zwrot_pieniedzy',
  anulowane: 'anulowanie',
});

export const STATUS_EMAIL_META = Object.freeze({
  przygotowanie: { badge: 'Realizacja zamówienia', title: 'Zamówienie jest przygotowywane', accent: '#7c3aed', opis: 'Kompletujemy produkty i przygotowujemy paczkę do wysyłki. Wkrótce przekażemy przesyłkę przewoźnikowi.', subject: (nr) => `Zamówienie ${nr} jest przygotowywane — Artway-TM` },
  nadanie: { badge: 'Przesyłka w drodze', title: 'Twoja paczka została nadana', accent: '#059669', opis: 'Przesyłka jest już w InPost. Poniżej znajdziesz numer i link do śledzenia.', subject: (nr) => `Zamówienie ${nr} zostało nadane — Artway-TM` },
  dostarczenie: { badge: 'Dostarczono', title: 'Przesyłka została dostarczona', accent: '#16a34a', opis: 'Przesyłka została oznaczona jako dostarczona.', subject: (nr) => `Zamówienie ${nr} zostało dostarczone — Artway-TM` },
  anulowanie: { badge: 'Aktualizacja zamówienia', title: 'Zamówienie zostało anulowane', accent: '#dc2626', opis: 'Zamówienie zostało anulowane. Jeśli to pomyłka lub masz pytania, odpowiedz na tę wiadomość.', subject: (nr) => `Zamówienie ${nr} zostało anulowane — Artway-TM` },
  zwrot: { badge: 'Zwrot przesyłki', title: 'Przesyłka wraca do nadawcy', accent: '#ea580c', opis: 'Przesyłka została oznaczona jako zwrot do nadawcy. Skontaktujemy się w sprawie dalszych kroków.', subject: (nr) => `Zwrot przesyłki dla zamówienia ${nr} — Artway-TM` },
  zwrot_pieniedzy: { badge: 'Zwrot pieniędzy', title: 'Zwróciliśmy Ci pieniądze', accent: '#0ea5e9', opis: 'Zwrot środków został zainicjowany. Pieniądze wrócą na Twoje konto w ciągu kilku dni roboczych.', subject: (nr) => `Zwrot pieniędzy za zamówienie ${nr} — Artway-TM` },
  problem: { badge: 'Ważna informacja', title: 'Problem z przesyłką', accent: '#dc2626', opis: 'Przewoźnik zgłosił problem dotyczący przesyłki. Monitorujemy sytuację i przekażemy kolejną informację po jej wyjaśnieniu.', subject: (nr) => `Ważna informacja o przesyłce ${nr} — Artway-TM` },
  dostepnosc_potwierdzona: { badge: 'Dostępność potwierdzona', title: 'Potwierdziliśmy zamówioną ilość', accent: '#16a34a', opis: 'Wszystkie zamówione sztuki są dostępne i zamówienie może przejść do dalszej realizacji.', subject: (nr) => `Potwierdziliśmy dostępność zamówienia ${nr} — Artway-TM` },
});

export const STATUS_EMAIL_CODALEJ = Object.freeze({
  przygotowanie: ['Co dalej?', 'Kompletujemy Twoje produkty. Gdy paczka trafi do przewoźnika, dostaniesz e-mail z numerem do śledzenia.'],
  nadanie: ['Śledź swoją paczkę', 'Paczka jest już w drodze. Link w wiadomości prowadzi do aktualnego statusu przesyłki.'],
  dostarczenie: ['Dziękujemy za zakupy', 'Przesyłka została dostarczona. Jeśli coś będzie nie tak, odpowiedz na tę wiadomość.'],
  anulowanie: ['Masz pytania?', 'Jeśli anulowanie to pomyłka albo chcesz coś wyjaśnić, odpowiedz na tę wiadomość.'],
  zwrot: ['Co dalej?', 'Skontaktujemy się w sprawie dalszych kroków dotyczących zwracanej przesyłki.'],
  zwrot_pieniedzy: ['Zwrot środków', 'Pieniądze wrócą na Twoje konto w ciągu kilku dni roboczych, zależnie od banku.'],
  problem: ['Czuwamy nad przesyłką', 'Monitorujemy sytuację w InPost i przekażemy kolejną informację po jej wyjaśnieniu.'],
  dostepnosc_potwierdzona: ['Co dalej?', 'Zamówiona ilość została potwierdzona. Teraz przygotujemy produkty do wysyłki i poinformujemy o następnym etapie.'],
});
