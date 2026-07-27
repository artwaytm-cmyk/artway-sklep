import crypto from 'node:crypto';
import { isValidAccountEmail, normalizeAccountEmail } from '../core/account-validation.mjs';

export function createStoreDataInputSanitizers(text) {
  const customerProfile = (raw = {}, email = '') => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const cleanEmail = normalizeAccountEmail(text(email || source.email, 200));
    if (!isValidAccountEmail(cleanEmail)) return null;
    return {
      email: cleanEmail,
      imie: text(source.imie, 160).trim(),
      telefon: text(source.telefon, 40).trim(),
      ulica: text(source.ulica, 160).trim(),
      nrDomu: text(source.nrDomu, 30).trim(),
      nrLokalu: text(source.nrLokalu, 30).trim(),
      kod: text(source.kod, 20).trim(),
      miasto: text(source.miasto, 120).trim(),
      firma: text(source.firma, 200).trim(),
      nip: text(source.nip, 20).replace(/\D/g, '').slice(0, 10),
    };
  };
  const safeReview = (raw = {}) => {
    const productId = text(raw.produktId || raw.productId || raw.idProduktu, 100).trim();
    const tresc = text(raw.tresc || raw.tekst || raw.opis, 3000).trim();
    const ocena = Math.max(1, Math.min(5, Math.round(Number(raw.ocena || raw.rating) || 0)));
    if (!productId || !tresc || !ocena) return null;
    return {
      id: crypto.randomUUID(),
      produktId: productId,
      imie: text(raw.imie || raw.autor || 'Klient', 100).trim() || 'Klient',
      tytul: text(raw.tytul, 160).trim(),
      tresc,
      ocena,
      data: new Date().toISOString(),
      status: 'oczekuje',
      serwer: true,
    };
  };
  return { customerProfile, safeReview };
}
