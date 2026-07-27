import { SETTINGS_DOMAIN_CONFIGS } from './normalized-domain-repository.mjs';

// Jedno źródło prawdy dla zapisu domen ustawień. Warstwa HTTP nie utrzymuje
// własnej kopii listy, bo każda rozbieżność kończyłaby się odrzuceniem danych,
// które repozytorium PostgreSQL potrafi poprawnie zapisać.
export const ADMIN_SETTINGS_DOMAIN_KEYS = Object.freeze(Object.keys(SETTINGS_DOMAIN_CONFIGS));

export function filterKnownSettingsDomains(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const filtered = {};
  for (const key of ADMIN_SETTINGS_DOMAIN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) filtered[key] = source[key];
  }
  return filtered;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function planEntry(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

// Plan cyklu jest współdzielony przez kilka kart i proces serwerowy. Konfliktu
// nie wolno rozwiązywać nadpisaniem całego obiektu: wybieramy najświeższy wpis
// dla każdego zadania i zachowujemy zadania istniejące tylko po jednej stronie.
export function mergeAgentPlanCycle(serverValue, browserValue) {
  const server = planEntry(serverValue), browser = planEntry(browserValue), merged = {};
  for (const key of new Set([...Object.keys(server), ...Object.keys(browser)])) {
    const current = planEntry(server[key]), incoming = planEntry(browser[key]);
    if (!Object.prototype.hasOwnProperty.call(server, key)) merged[key] = incoming;
    else if (!Object.prototype.hasOwnProperty.call(browser, key)) merged[key] = current;
    else merged[key] = timestamp(incoming.updatedAt) >= timestamp(current.updatedAt) ? { ...current, ...incoming } : { ...incoming, ...current };
  }
  return merged;
}
