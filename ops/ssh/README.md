# SSH serwera Artway-TM

Kanoniczna polityka znajduje się w `00-artway-access.conf`. Plik ma prefiks
`00-`, ponieważ OpenSSH dla większości dyrektyw zachowuje pierwszą napotkaną
wartość. Nie należy dopisywać późniejszych, sprzecznych wyjątków.

Założenia dostępu:

- jedyne konto interaktywne: `artway`,
- wyłącznie klucz publiczny,
- brak logowania `root`, hasłem i keyboard-interactive,
- dozwolone lokalne tunele potrzebne do VS Code i paneli na `127.0.0.1`,
- wyłączone X11, agent forwarding, zdalne wystawianie portów i tunele TUN/TAP.

Wdrożenie i kontrola:

```bash
sudo ./ops/ssh/install.sh
sudo ./ops/ssh/verify.sh
```

Instalator przed reloadem wykonuje kopię w `/var/backups/artway-ssh/`, test
składni `sshd -t` i kontrolę wynikowej konfiguracji. Po reloadzie sprawdza
usługę, port oraz listę metod uwierzytelniania. Nie wykonuje restartu serwera.

W razie awaryjnego przywrócenia należy skorzystać z konsoli OVH, odtworzyć
ostatni katalog z `/var/backups/artway-ssh/`, wykonać `sshd -t`, a dopiero
potem `systemctl reload ssh.service`.
