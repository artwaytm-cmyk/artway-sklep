/* Ustawienia integracji Allegro — mapowanie, harmonogram i automatyzacje. */
function allegroUstawieniaPanelHTML(){
  const offerStock=allegroStanOfertyProduktu(),audit=Object.values(allegroStan.offerDefaultsAudit?.items||{}),auditOpen=audit.filter(x=>!x.stockUpdated||!x.republishUpdated).length;
  const settings={autoMapping:true,mappingMinScore:88,lightSyncMinutes:15,fullSyncHours:6,...(allegroStan.offerSettings||{})};
  const sync=allegroStan.offerSyncState||{},maintenance=allegroStan.catalogMaintenance||{};
  const dataLabel=value=>value&&Number.isFinite(Date.parse(value))?esc(new Date(value).toLocaleString("pl-PL")):"jeszcze nie wykonano";
  const option=(value,current,label)=>`<option value="${value}" ${Number(current)===Number(value)?"selected":""}>${label}</option>`;
  return `<div class="panel allegro-section-panel allegro-integration-settings">
    <div class="order-section-head">
      <div><span class="order-pro-label">Allegro API</span><h2>⚙️ Ustawienia integracji</h2><p class="order-detail-lead">Jedno miejsce do ustawienia automatycznego mapowania, rytmu synchronizacji, aktualizacji ofert i domyślnych danych.</p></div>
      <div class="diag-actions"><button class="btn" type="button" onclick="allegroPolacz()">🔐 Połącz ponownie</button><button class="btn ghost" type="button" onclick="allegroWczytajDane(true)">Sprawdź połączenie</button></div>
    </div>
    <div class="orders-stat-grid">
      <div class="order-stat-card ${allegroStan.configured?"money":"hot"}"><span>🔧</span><b>${allegroStan.configured?"OK":"BRAK"}</b><small>konfiguracja aplikacji</small></div>
      <div class="order-stat-card ${allegroStan.connected?"money":"hot"}"><span>🔐</span><b>${allegroStan.connected?"TAK":"NIE"}</b><small>autoryzacja OAuth</small></div>
      <div class="order-stat-card"><span>🔄</span><b>${settings.lightSyncMinutes} min</b><small>lekka synchronizacja</small></div>
      <div class="order-stat-card"><span>📚</span><b>${settings.fullSyncHours} h</b><small>pełna synchronizacja</small></div>
    </div>
    <form class="allegro-settings-layout" onsubmit="event.preventDefault();allegroZapiszUstawieniaOfert(this)">
      <section class="allegro-settings-section primary">
        <div class="allegro-settings-section-head"><div><span>🤖</span><div><h3>Automatyczne mapowanie ofert</h3><p>Pewne, jednoznaczne zgodności EAN, ID produktu i kodu są łączone bez klikania. Wyjątki pozostają do ręcznej kontroli.</p></div></div><label class="switch-check"><input type="checkbox" name="autoMapping" ${settings.autoMapping!==false?"checked":""}><span>Włączone</span></label></div>
        <div class="allegro-settings-grid compact"><label>Próg pewności od 55%<input name="mappingMinScore" type="number" min="55" max="100" step="1" required value="${esc(settings.mappingMinScore)}"><small>Możesz ustawić dowolny próg od 55% do 100%. System nadal odrzuca konflikty i niejednoznaczne duplikaty.</small></label><div class="allegro-setting-action"><b>Natychmiastowa kontrola</b><small>Zapisz nowy próg i od razu połącz wszystkie pozycje, które go spełniają.</small><button class="btn" type="button" onclick="this.form.requestSubmit()">💾 Zapisz i połącz według progu</button></div></div>
      </section>
      <section class="allegro-settings-section">
        <div class="allegro-settings-section-head"><div><span>⏱️</span><div><h3>Harmonogram synchronizacji</h3><p>Ustawienia są wykonywane przez serwer również wtedy, gdy panel administratora jest zamknięty.</p></div></div></div>
        <div class="allegro-settings-grid"><label>Zamówienia, komunikacja i lista ofert<select name="lightSyncMinutes">${option(15,settings.lightSyncMinutes,"co 15 minut")}${option(30,settings.lightSyncMinutes,"co 30 minut")}${option(60,settings.lightSyncMinutes,"co 1 godzinę")}${option(120,settings.lightSyncMinutes,"co 2 godziny")}</select></label><label>Pełne dane, opisy i katalog<select name="fullSyncHours">${option(6,settings.fullSyncHours,"automatycznie co 6 godzin")}${option(12,settings.fullSyncHours,"automatycznie co 12 godzin")}${option(24,settings.fullSyncHours,"automatycznie co 24 godziny")}</select></label></div>
        <div class="allegro-sync-status-grid"><span><small>Ostatnia lekka</small><b>${dataLabel(sync.lastLightSyncAt)}</b><em>Następna: ${dataLabel(sync.nextLightSyncAt)}</em></span><span><small>Ostatnia pełna</small><b>${dataLabel(sync.lastFullSyncAt)}</b><em>Następna: ${dataLabel(sync.nextFullSyncAt)}</em></span><button class="btn ghost" type="button" onclick="allegroSynchronizujWszystko()">Synchronizuj wszystko teraz</button></div>
      </section>
      <section class="allegro-settings-section">
        <div class="allegro-settings-section-head"><div><span>🏷️</span><div><h3>Dane i konserwacja ofert</h3><p>Wybierz, które elementy system ma utrzymywać automatycznie po zapisaniu lub synchronizacji produktu.</p></div></div></div>
        <div class="allegro-settings-checks"><label class="check"><input type="checkbox" name="autoCatalog" ${settings.autoCatalog!==false?"checked":""}> Dobieraj katalog i kategorię</label><label class="check"><input type="checkbox" name="syncDescriptions" ${settings.syncDescriptions!==false?"checked":""}> Automatycznie poprawiaj krótki opis, pełny opis i układ</label><label class="check"><input type="checkbox" name="autoUpdateOffers" ${settings.autoUpdateOffers!==false?"checked":""}> Aktualizuj powiązaną ofertę</label><label class="check"><input type="checkbox" name="autoFees" ${settings.autoFees!==false?"checked":""}> Pobieraj prowizje i opłaty</label><label class="check"><input type="checkbox" name="autoCorrections" ${settings.autoCorrections!==false?"checked":""}> Kwarantanna błędnych powiązań</label></div>
      </section>
      <section class="allegro-settings-section">
        <div class="allegro-settings-section-head"><div><span>📦</span><div><h3>Domyślne dane oferty</h3><p>Stan ofertowy pozostaje niezależny od fizycznego stanu magazynu. Automatyczne wznawianie jest zawsze aktywne.</p></div></div></div>
        <div class="allegro-settings-grid"><label>Domyślny stan każdej oferty<input name="defaultStock" type="number" min="1" max="99999" step="1" required value="${offerStock}"><small>Nowe i aktualizowane oferty otrzymają tę wartość.</small></label><label>Dozwoleni producenci<textarea name="producers" rows="4" required>${esc(allegroListaProducentow().join("\n"))}</textarea><small>Po jednym producencie w wierszu.</small></label></div>
        <label class="check allegro-apply-existing"><input type="checkbox" name="applyExisting"> Zastosuj stan i wznawianie także do wszystkich ${allegroOferty.length} istniejących ofert</label>
        ${audit.length?`<small class="allegro-settings-audit">Ostatni audyt: ${audit.length-auditOpen} bez problemu • ${auditOpen} wymaga uzupełnienia.</small>`:""}
      </section>
      <div class="allegro-settings-savebar"><div><b>Wszystkie ustawienia zapisują się na serwerze</b><small>Obowiązują na każdym urządzeniu i dla zadań automatycznych.</small></div><button class="btn" type="submit" ${allegroOperacjaUstawien.busy?"disabled":""}>💾 Zapisz wszystkie ustawienia</button></div>
    </form>
    ${allegroPostepUstawienHTML()}
    <details class="allegro-manual-sync"><summary>Zaawansowane narzędzia i informacje techniczne</summary><div class="panel-subtle"><div class="diag-actions"><button class="btn ghost" type="button" onclick="allegroSynchronizujZamowienia()">Zamówienia</button><button class="btn ghost" type="button" onclick="allegroSynchronizujOferty()">Oferty</button><button class="btn ghost" type="button" onclick="allegroUruchomAutomatycznaKonserwacje()">Katalog i opisy</button><button class="btn ghost" type="button" onclick="allegroSynchronizujKomunikacje(false)">Komunikacja</button></div><p><b>Konserwacja:</b> ${maintenance.lastRun?`${dataLabel(maintenance.lastRun)} • sprawdzono ${esc(maintenance.scanned||0)} • poprawiono ${esc(maintenance.updated||0)}`:"oczekuje na pierwsze uruchomienie"}.</p><p>Środowisko: <b>${esc(allegroStan.env||"production")}</b>. Ostatni odczyt integracji: ${dataLabel(allegroStan.updated_at)}.</p></div></details>
  </div>`;
}
