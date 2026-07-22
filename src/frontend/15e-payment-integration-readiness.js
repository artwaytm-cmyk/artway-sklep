/* Czytelne rozdzielenie integracji płatniczych od logistycznego ShipX. */
function inpostPayReadinessHTML(){
  return `<div class="panel inpost-pay-readiness">
    <div class="order-section-head"><div><span class="order-pro-label">DRUGI KANAŁ ZAKUPU • NIEZALEŻNY OD SHIPX</span><h2>🟨 InPost Pay obok Paynow</h2></div><span class="lvl lvl-ostrzezenie">wymaga osobnej umowy</span></div>
    <p>Obie możliwości mogą działać jednocześnie: <b>Paynow</b> pozostaje płatnością w zwykłym formularzu sklepu, a <b>InPost Pay</b> jest dodatkowym przyciskiem ekspresowego zakupu z płatnością i dostawą finalizowaną w aplikacji InPost.</p>
    <div class="settings-grid">
      <div class="setting-box"><h3>1. Umowa InPost Pay</h3><p>InPost udostępnia dokumentację techniczną i dane wdrożeniowe po rozpoczęciu procesu handlowego.</p></div>
      <div class="setting-box"><h3>2. Środowisko testowe</h3><p>Przycisk i wymiana koszyka zostaną uruchomione najpierw w testach, bez mieszania z produkcyjnym ShipX.</p></div>
      <div class="setting-box"><h3>3. Odbiór techniczny</h3><p>Opcja klienta będzie widoczna dopiero po pozytywnym sprawdzeniu przez InPost.</p></div>
    </div>
    <div class="backend-note" style="margin-top:.8rem"><b>Ważne:</b> obecne połączenie InPost do paczkomatów, etykiet i śledzenia to ShipX. Nie jest ono kluczem do InPost Pay i pozostaje bez zmian.</div>
    <div class="diag-actions" style="margin-top:.8rem"><a class="btn" href="https://inpost.pl/inpostpay" target="_blank" rel="noopener">Rozpocznij wdrożenie InPost Pay ↗</a><a class="btn ghost" href="/dostawa/" target="_blank" rel="noopener">Publiczna strona płatności</a></div>
  </div>`;
}
