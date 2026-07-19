/* GENERATED ADMIN CATALOG — loaded on demand */
/* Parser plikow z linkami produktow (XLSX / CSV / TXT).
 * Modul nie renderuje interfejsu i nie zapisuje produktow. Zwraca czysta kolejke,
 * ktora importer moze przetwarzac po jednym rekordzie i zapisywac natychmiast.
 */
;(function productLinkFileImportParserModule(global){
  "use strict";

  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_ROWS = 1000;
  const MAX_ZIP_ENTRIES = 4096;
  const MAX_ZIP_ENTRY_BYTES = 32 * 1024 * 1024;
  const MAX_ZIP_TOTAL_BYTES = 96 * 1024 * 1024;
  const ALEXANDER_HOSTS = new Set(["sklep.alexander.com.pl", "www.sklep.alexander.com.pl"]);
  const TRACKING_QUERY_KEYS = new Set([
    "fbclid", "gclid", "dclid", "msclkid", "srsltid", "query_id", "queryid",
    "tracking", "tracking_id", "campaign", "campaign_id", "source", "ref", "referrer"
  ]);

  function parserError(message, code){
    const error = new Error(message);
    error.code = code || "PRODUCT_LINK_FILE_ERROR";
    return error;
  }

  function safeFileName(value){
    return String(value || "import-produktow").split(/[\\/]/).pop().trim() || "import-produktow";
  }

  function normalizeHeader(value){
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[łŁ]/g, "l")
      .toLowerCase()
      .replace(/[_/\\|]+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function linkHeaderScore(value){
    const header = normalizeHeader(value);
    if(!header) return 0;
    if(["link do produktu", "adres do produktu", "adres produktu", "url produktu", "product url", "source url"].includes(header)) return 100;
    if(["url", "link", "adres url", "adres"].includes(header)) return 85;
    if((header.includes("link") || header.includes("url") || header.includes("adres")) && header.includes("produkt")) return 95;
    if(header.includes("link") || header.includes("url")) return 60;
    return 0;
  }

  function nameHeaderScore(value){
    const header = normalizeHeader(value);
    if(!header) return 0;
    if(["nazwa produktu", "product name"].includes(header)) return 100;
    if(["nazwa", "produkt", "tytul", "tytul produktu"].includes(header)) return 80;
    if(header.includes("nazwa") && header.includes("produkt")) return 95;
    return 0;
  }

  function isTrackingQueryKey(key){
    const normalized = String(key || "").toLowerCase();
    return normalized.startsWith("utm_") || normalized.startsWith("mc_") || normalized.startsWith("gad_") || TRACKING_QUERY_KEYS.has(normalized);
  }

  function isPublicProductHost(value){
    const host = String(value || "").toLowerCase().replace(/\.$/, "");
    if(!host || !host.includes(".") || host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host)) return false;
    if(["localhost", "localhost.localdomain"].includes(host)) return false;
    if([".local", ".internal", ".localhost", ".test", ".invalid", ".example"].some((suffix) => host.endsWith(suffix))) return false;
    if(host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return false;
    const labels = host.split(".");
    if(labels.some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) return false;
    const tld = labels.at(-1) || "";
    return /^[a-z]{2,63}$/i.test(tld) || /^xn--[a-z0-9-]{2,59}$/i.test(tld);
  }

  function canonicalProductUrl(value){
    const raw = String(value || "").trim();
    if(!raw) return {ok:false, code:"missing_url", reason:"Brak linku do produktu."};
    let url;
    try { url = new URL(raw); }
    catch(_error){ return {ok:false, code:"invalid_url", reason:"Nieprawidlowy adres URL."}; }
    if(!["http:", "https:"].includes(url.protocol)) return {ok:false, code:"invalid_protocol", reason:"Link musi uzywac protokolu HTTP lub HTTPS."};
    if(url.username || url.password) return {ok:false, code:"credentials_in_url", reason:"Link nie moze zawierac danych logowania."};
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if(!isPublicProductHost(host)) return {ok:false, code:"unsupported_host", reason:"Link musi prowadzić do publicznej strony produktu producenta lub dostawcy."};
    if(url.port && !["80", "443"].includes(url.port)) return {ok:false, code:"unsupported_port", reason:"Link używa niedozwolonego portu."};
    const queryLooksLikeProduct = [...url.searchParams.keys()].some((key) => /^(?:p|id|sku|product|produkt|item|offer)(?:[_-]?id)?$/i.test(key));
    if((!url.pathname || url.pathname === "/") && !queryLooksLikeProduct) return {ok:false, code:"missing_product_path", reason:"Link nie wskazuje konkretnego produktu."};

    // Aliasy Alexander oznaczają ten sam katalog. Pozostałe domeny zachowujemy,
    // dzięki czemu jeden plik może mieszać wielu producentów i dostawców.
    if(ALEXANDER_HOSTS.has(host)) url.hostname = "www.sklep.alexander.com.pl";
    else url.hostname = host;
    url.protocol = "https:";
    url.port = "";
    url.hash = "";
    const keptParams = [];
    for(const [key, val] of url.searchParams.entries()){
      if(!isTrackingQueryKey(key)) keptParams.push([key, val]);
    }
    keptParams.sort((left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]));
    url.search = "";
    for(const [key, val] of keptParams) url.searchParams.append(key, val);
    return {ok:true, url:url.href, canonicalUrl:url.href};
  }

  function decodeXmlEntities(value){
    return String(value || "")
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_m, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function parseXmlDocument(text, label){
    if(typeof global.DOMParser !== "function") return {__rawXml:String(text || "")};
    const doc = new global.DOMParser().parseFromString(String(text || ""), "application/xml");
    const parserErrors = doc.getElementsByTagName("parsererror");
    if(parserErrors && parserErrors.length) throw parserError(`Nie mozna odczytac XML (${label}).`, "INVALID_XLSX_XML");
    return doc;
  }

  function xmlElements(source, localName){
    if(!source) return [];
    if(!source.__rawXml && typeof source.getElementsByTagNameNS === "function"){
      const namespaced = Array.from(source.getElementsByTagNameNS("*", localName) || []);
      if(namespaced.length) return namespaced;
      return Array.from(source.getElementsByTagName(localName) || []);
    }
    const xml = source.__rawXml !== undefined ? source.__rawXml : String(source.__innerXml || "");
    const escapedName = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`<((?:[A-Za-z_][\\w.-]*:)?${escapedName})\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/\\1\\s*>)`, "gi");
    const found = [];
    let match;
    while((match = pattern.exec(xml))){
      found.push({__attrsXml:match[2] || "", __innerXml:match[3] || "", __rawXml:match[0]});
    }
    return found;
  }

  function xmlAttribute(node, name){
    if(!node) return "";
    if(!node.__rawXml && typeof node.getAttribute === "function"){
      const direct = node.getAttribute(name);
      if(direct !== null) return direct;
      const localName = name.includes(":") ? name.split(":").pop() : name;
      for(const attr of Array.from(node.attributes || [])){
        if(attr.localName === localName) return attr.value;
      }
      return "";
    }
    const attrs = String(node.__attrsXml || "");
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exact = attrs.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
    if(exact) return decodeXmlEntities(exact[2]);
    if(name.includes(":")) return "";
    const local = attrs.match(new RegExp(`(?:^|\\s)(?:[A-Za-z_][\\w.-]*:)?${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
    return local ? decodeXmlEntities(local[2]) : "";
  }

  function xmlText(node){
    if(!node) return "";
    if(!node.__rawXml && "textContent" in node) return String(node.textContent || "");
    return decodeXmlEntities(String(node.__innerXml || "").replace(/<[^>]+>/g, ""));
  }

  function firstXmlText(source, localName){
    const node = xmlElements(source, localName)[0];
    return node ? xmlText(node) : "";
  }

  function uint16(view, offset){ return view.getUint16(offset, true); }
  function uint32(view, offset){ return view.getUint32(offset, true); }

  function locateEndOfCentralDirectory(view){
    const minimum = Math.max(0, view.byteLength - 65557);
    for(let offset = view.byteLength - 22; offset >= minimum; offset--){
      if(uint32(view, offset) === 0x06054b50) return offset;
    }
    return -1;
  }

  async function inflateRaw(bytes, expectedSize){
    if(typeof global.DecompressionStream !== "function") throw parserError("Ta przegladarka nie obsluguje dekompresji XLSX.", "XLSX_DECOMPRESSION_UNSUPPORTED");
    const stream = new Blob([bytes]).stream().pipeThrough(new global.DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const chunks = [];
    let actualSize = 0;
    try{
      while(true){
        const result = await reader.read();
        if(result.done) break;
        const chunk = result.value instanceof Uint8Array ? result.value : new Uint8Array(result.value || 0);
        actualSize += chunk.byteLength;
        if(actualSize > MAX_ZIP_ENTRY_BYTES){
          try{ await reader.cancel("XLSX entry size limit exceeded"); }catch(_cancelError){}
          throw parserError("Jeden z elementow XLSX jest zbyt duzy.", "XLSX_ENTRY_TOO_LARGE");
        }
        chunks.push(chunk);
      }
    }finally{
      try{ reader.releaseLock(); }catch(_releaseError){}
    }
    const output = new Uint8Array(actualSize);
    let outputOffset = 0;
    for(const chunk of chunks){ output.set(chunk, outputOffset); outputOffset += chunk.byteLength; }
    if(expectedSize >= 0 && output.byteLength !== expectedSize) throw parserError("Uszkodzony wpis w pliku XLSX.", "INVALID_XLSX_ENTRY_SIZE");
    return output;
  }

  async function openZip(arrayBuffer){
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocd = locateEndOfCentralDirectory(view);
    if(eocd < 0) throw parserError("Plik nie jest prawidlowym archiwum XLSX.", "INVALID_XLSX_ZIP");
    const entryCount = uint16(view, eocd + 10);
    const centralSize = uint32(view, eocd + 12);
    const centralOffset = uint32(view, eocd + 16);
    if(entryCount > MAX_ZIP_ENTRIES || centralOffset + centralSize > bytes.byteLength) throw parserError("Plik XLSX jest zbyt duzy lub uszkodzony.", "INVALID_XLSX_DIRECTORY");

    const decoder = new TextDecoder("utf-8");
    const entries = new Map();
    let offset = centralOffset;
    let totalUncompressed = 0;
    for(let index = 0; index < entryCount; index++){
      if(offset + 46 > bytes.byteLength || uint32(view, offset) !== 0x02014b50) throw parserError("Uszkodzony katalog pliku XLSX.", "INVALID_XLSX_DIRECTORY");
      const flags = uint16(view, offset + 8);
      const method = uint16(view, offset + 10);
      const compressedSize = uint32(view, offset + 20);
      const uncompressedSize = uint32(view, offset + 24);
      const nameLength = uint16(view, offset + 28);
      const extraLength = uint16(view, offset + 30);
      const commentLength = uint16(view, offset + 32);
      const localOffset = uint32(view, offset + 42);
      if([compressedSize, uncompressedSize, localOffset].includes(0xffffffff)) throw parserError("Format ZIP64 nie jest obslugiwany.", "XLSX_ZIP64_UNSUPPORTED");
      if(uncompressedSize > MAX_ZIP_ENTRY_BYTES) throw parserError("Jeden z elementow XLSX jest zbyt duzy.", "XLSX_ENTRY_TOO_LARGE");
      totalUncompressed += uncompressedSize;
      if(totalUncompressed > MAX_ZIP_TOTAL_BYTES) throw parserError("Rozpakowany plik XLSX jest zbyt duzy.", "XLSX_TOO_LARGE");
      const nameStart = offset + 46;
      const nameEnd = nameStart + nameLength;
      if(nameEnd > bytes.byteLength) throw parserError("Uszkodzona nazwa wpisu XLSX.", "INVALID_XLSX_DIRECTORY");
      const name = decoder.decode(bytes.subarray(nameStart, nameEnd)).replace(/^\/+/, "");
      if(!name.includes("..") && !entries.has(name)) entries.set(name, {flags, method, compressedSize, uncompressedSize, localOffset});
      offset = nameEnd + extraLength + commentLength;
    }

    async function readEntry(name){
      const normalizedName = String(name || "").replace(/^\/+/, "");
      const entry = entries.get(normalizedName);
      if(!entry) return null;
      if(entry.flags & 1) throw parserError("Zaszyfrowany plik XLSX nie jest obslugiwany.", "ENCRYPTED_XLSX");
      if(entry.localOffset + 30 > bytes.byteLength || uint32(view, entry.localOffset) !== 0x04034b50) throw parserError("Uszkodzony wpis XLSX.", "INVALID_XLSX_ENTRY");
      const localNameLength = uint16(view, entry.localOffset + 26);
      const localExtraLength = uint16(view, entry.localOffset + 28);
      const dataOffset = entry.localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataOffset + entry.compressedSize;
      if(dataEnd > bytes.byteLength) throw parserError("Niepelny wpis XLSX.", "INVALID_XLSX_ENTRY");
      const compressed = bytes.subarray(dataOffset, dataEnd);
      if(entry.method === 0) return compressed.slice();
      if(entry.method === 8) return inflateRaw(compressed, entry.uncompressedSize);
      throw parserError(`Nieobslugiwana metoda kompresji XLSX (${entry.method}).`, "XLSX_COMPRESSION_UNSUPPORTED");
    }

    async function readText(name){
      const content = await readEntry(name);
      return content === null ? null : decoder.decode(content);
    }
    return {entries, readText};
  }

  function normalizeZipPath(basePath, target){
    const rawTarget = String(target || "").replace(/\\/g, "/");
    const parts = rawTarget.startsWith("/") ? [] : String(basePath || "").split("/").slice(0, -1);
    for(const part of rawTarget.replace(/^\/+/, "").split("/")){
      if(!part || part === ".") continue;
      if(part === "..") parts.pop();
      else parts.push(part);
    }
    return parts.join("/");
  }

  function relationshipMap(xmlText, basePath){
    const map = new Map();
    if(!xmlText) return map;
    const doc = parseXmlDocument(xmlText, "relacje");
    for(const node of xmlElements(doc, "Relationship")){
      const id = xmlAttribute(node, "Id");
      const target = xmlAttribute(node, "Target");
      if(id && target) map.set(id, xmlAttribute(node, "TargetMode").toLowerCase() === "external" ? target : normalizeZipPath(basePath, target));
    }
    return map;
  }

  function sharedStringsFromXml(xmlValue){
    if(!xmlValue) return [];
    const doc = parseXmlDocument(xmlValue, "sharedStrings");
    return xmlElements(doc, "si").map((item) => {
      const richParts = xmlElements(item, "t");
      return richParts.length ? richParts.map(xmlText).join("") : xmlText(item);
    });
  }

  function cellColumnIndex(reference, fallbackIndex){
    const match = String(reference || "").match(/^([A-Za-z]+)/);
    if(!match) return fallbackIndex;
    let value = 0;
    for(const char of match[1].toUpperCase()) value = value * 26 + char.charCodeAt(0) - 64;
    return Math.max(0, value - 1);
  }

  function worksheetRows(xmlTextValue, sharedStrings, hyperlinks){
    const doc = parseXmlDocument(xmlTextValue, "arkusz");
    const output = [];
    let fallbackRowNumber = 0;
    for(const rowNode of xmlElements(doc, "row")){
      fallbackRowNumber++;
      const rowNumber = Number(xmlAttribute(rowNode, "r")) || fallbackRowNumber;
      const cells = [];
      const links = Object.create(null);
      let fallbackColumn = 0;
      for(const cellNode of xmlElements(rowNode, "c")){
        const reference = xmlAttribute(cellNode, "r");
        const column = cellColumnIndex(reference, fallbackColumn);
        fallbackColumn = column + 1;
        const type = xmlAttribute(cellNode, "t");
        let value = "";
        if(type === "inlineStr"){
          const parts = xmlElements(cellNode, "t");
          value = parts.length ? parts.map(xmlText).join("") : firstXmlText(cellNode, "is");
        }else{
          value = firstXmlText(cellNode, "v");
          if(type === "s") value = sharedStrings[Number(value)] ?? "";
        }
        cells[column] = String(value ?? "");
        const linked = hyperlinks.get(String(reference || "").toUpperCase());
        if(linked) links[column] = linked;
      }
      output.push({rowNumber, cells, hyperlinks:links});
    }
    return output;
  }

  async function parseXlsx(arrayBuffer, fileName){
    const zip = await openZip(arrayBuffer);
    const workbookText = await zip.readText("xl/workbook.xml");
    if(!workbookText) throw parserError("Plik XLSX nie zawiera skoroszytu.", "INVALID_XLSX_WORKBOOK");
    const workbookDoc = parseXmlDocument(workbookText, "workbook");
    const workbookRelations = relationshipMap(await zip.readText("xl/_rels/workbook.xml.rels"), "xl/workbook.xml");
    const sheets = xmlElements(workbookDoc, "sheet");
    let sheetName = "Arkusz 1";
    let sheetPath = "";
    for(const sheet of sheets){
      const relationId = xmlAttribute(sheet, "r:id") || xmlAttribute(sheet, "id");
      const candidate = workbookRelations.get(relationId);
      if(candidate && zip.entries.has(candidate)){
        sheetName = xmlAttribute(sheet, "name") || sheetName;
        sheetPath = candidate;
        break;
      }
    }
    if(!sheetPath) sheetPath = Array.from(zip.entries.keys()).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) || "";
    if(!sheetPath) throw parserError("Plik XLSX nie zawiera arkusza z danymi.", "MISSING_XLSX_SHEET");

    const sheetText = await zip.readText(sheetPath);
    const sharedStrings = sharedStringsFromXml(await zip.readText("xl/sharedStrings.xml"));
    const sheetRelationsPath = `${sheetPath.slice(0, sheetPath.lastIndexOf("/") + 1)}_rels/${sheetPath.split("/").pop()}.rels`;
    const sheetRelations = relationshipMap(await zip.readText(sheetRelationsPath), sheetPath);
    const hyperlinks = new Map();
    const sheetDoc = parseXmlDocument(sheetText, "arkusz");
    for(const hyperlink of xmlElements(sheetDoc, "hyperlink")){
      const ref = String(xmlAttribute(hyperlink, "ref") || "").split(":")[0].toUpperCase();
      const relationId = xmlAttribute(hyperlink, "r:id") || xmlAttribute(hyperlink, "id");
      const target = sheetRelations.get(relationId) || xmlAttribute(hyperlink, "location");
      if(ref && target) hyperlinks.set(ref, target);
    }
    return {sheetName, tableRows:worksheetRows(sheetText, sharedStrings, hyperlinks), fileName};
  }

  function countDelimiter(line, delimiter){
    let count = 0;
    let quoted = false;
    for(let index = 0; index < line.length; index++){
      const char = line[index];
      if(char === '"'){
        if(quoted && line[index + 1] === '"') index++;
        else quoted = !quoted;
      }else if(!quoted && char === delimiter) count++;
    }
    return count;
  }

  function detectDelimiter(text){
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).slice(0, 30);
    const candidates = ["\t", ";", ",", "|"];
    let best = {delimiter:"\t", score:-1};
    for(const delimiter of candidates){
      const counts = lines.map((line) => countDelimiter(line, delimiter));
      const positive = counts.filter((count) => count > 0);
      if(!positive.length) continue;
      const common = positive.sort((a, b) => a - b)[Math.floor(positive.length / 2)];
      const consistent = counts.filter((count) => count === common).length;
      const score = consistent * 100 + common * 5 + positive.length;
      if(score > best.score) best = {delimiter, score};
    }
    return best.score < 0 ? "\t" : best.delimiter;
  }

  function parseDelimited(text, delimiter){
    const input = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for(let index = 0; index < input.length; index++){
      const char = input[index];
      if(quoted){
        if(char === '"' && input[index + 1] === '"'){
          value += '"';
          index++;
        }else if(char === '"') quoted = false;
        else value += char;
      }else if(char === '"' && value === "") quoted = true;
      else if(char === delimiter){ row.push(value); value = ""; }
      else if(char === "\n" || char === "\r"){
        if(char === "\r" && input[index + 1] === "\n") index++;
        row.push(value);
        if(row.some((cell) => String(cell).trim())) rows.push(row);
        row = [];
        value = "";
      }else value += char;
    }
    row.push(value);
    if(row.some((cell) => String(cell).trim())) rows.push(row);
    return rows.map((cells, index) => ({rowNumber:index + 1, cells, hyperlinks:Object.create(null)}));
  }

  function decodeTextFile(arrayBuffer){
    const bytes = new Uint8Array(arrayBuffer);
    try { return new TextDecoder("utf-8", {fatal:true}).decode(bytes); }
    catch(_error){
      try { return new TextDecoder("windows-1250").decode(bytes); }
      catch(_fallbackError){ return new TextDecoder("utf-8").decode(bytes); }
    }
  }

  function chooseColumns(tableRows){
    const candidates = tableRows.slice(0, 30);
    let best = null;
    for(let index = 0; index < candidates.length; index++){
      const cells = candidates[index].cells || [];
      let linkColumn = -1;
      let linkScore = 0;
      let nameColumn = -1;
      let nameScore = 0;
      cells.forEach((cell, column) => {
        const candidateLinkScore = linkHeaderScore(cell);
        if(candidateLinkScore > linkScore){ linkScore = candidateLinkScore; linkColumn = column; }
        const candidateNameScore = nameHeaderScore(cell);
        if(candidateNameScore > nameScore){ nameScore = candidateNameScore; nameColumn = column; }
      });
      if(linkColumn >= 0){
        const score = linkScore + nameScore + Math.max(0, 30 - index);
        if(!best || score > best.score) best = {headerIndex:index, linkColumn, nameColumn, score};
      }
    }
    if(best) return best;

    // TXT bez nagłówka: wybierz kolumnę z publicznymi adresami stron produktów.
    const maxColumns = Math.max(0, ...candidates.map((row) => (row.cells || []).length));
    let detectedColumn = -1;
    let detectedCount = 0;
    for(let column = 0; column < maxColumns; column++){
      const count = candidates.filter((row) => canonicalProductUrl(row.hyperlinks?.[column] || row.cells?.[column]).ok).length;
      if(count > detectedCount){ detectedCount = count; detectedColumn = column; }
    }
    if(detectedColumn >= 0 && detectedCount > 0) return {headerIndex:-1, linkColumn:detectedColumn, nameColumn:-1, score:detectedCount};
    throw parserError("Nie znaleziono kolumny 'Link do produktu', 'URL' ani 'Adres'.", "MISSING_URL_COLUMN");
  }

  function rowsFromTable(tableRows){
    const columns = chooseColumns(tableRows);
    const candidates = [];
    for(let index = columns.headerIndex + 1; index < tableRows.length; index++){
      const row = tableRows[index];
      const rawUrl = String(row.hyperlinks?.[columns.linkColumn] || row.cells?.[columns.linkColumn] || "").trim();
      const name = columns.nameColumn >= 0 ? String(row.cells?.[columns.nameColumn] || "").trim() : "";
      if(!rawUrl && !name) continue;
      candidates.push({rowNumber:row.rowNumber || index + 1, name, rawUrl});
      if(candidates.length > MAX_ROWS) throw parserError(`Plik moze zawierac maksymalnie ${MAX_ROWS} wierszy produktow.`, "TOO_MANY_PRODUCT_ROWS");
    }

    const rows = [];
    const duplicates = [];
    const invalid = [];
    const firstByUrl = new Map();
    for(const candidate of candidates){
      const checked = canonicalProductUrl(candidate.rawUrl);
      if(!checked.ok){
        invalid.push({rowNumber:candidate.rowNumber, name:candidate.name, value:candidate.rawUrl, code:checked.code, reason:checked.reason});
        continue;
      }
      const first = firstByUrl.get(checked.canonicalUrl);
      if(first){
        duplicates.push({rowNumber:candidate.rowNumber, name:candidate.name, value:candidate.rawUrl, url:checked.url, canonicalUrl:checked.canonicalUrl, duplicateOfRow:first.rowNumber, code:"duplicate_url"});
        continue;
      }
      const item = {
        index:rows.length + 1,
        rowNumber:candidate.rowNumber,
        name:candidate.name,
        url:checked.url,
        canonicalUrl:checked.canonicalUrl,
        originalUrl:candidate.rawUrl
      };
      firstByUrl.set(checked.canonicalUrl, item);
      rows.push(item);
    }
    return {rows, duplicates, invalid, total:candidates.length};
  }

  async function inputToArrayBuffer(fileOrArrayBuffer){
    if(fileOrArrayBuffer instanceof ArrayBuffer) return fileOrArrayBuffer.slice(0);
    if(ArrayBuffer.isView(fileOrArrayBuffer)) return fileOrArrayBuffer.buffer.slice(fileOrArrayBuffer.byteOffset, fileOrArrayBuffer.byteOffset + fileOrArrayBuffer.byteLength);
    if(fileOrArrayBuffer && typeof fileOrArrayBuffer.arrayBuffer === "function") return fileOrArrayBuffer.arrayBuffer();
    throw parserError("Wybierz prawidlowy plik XLSX, CSV lub TXT.", "INVALID_FILE_INPUT");
  }

  async function parseProductLinksFile(fileOrArrayBuffer, options = {}){
    const fileName = safeFileName(options.fileName || fileOrArrayBuffer?.name || "import-produktow");
    const arrayBuffer = await inputToArrayBuffer(fileOrArrayBuffer);
    if(!arrayBuffer.byteLength) throw parserError("Wybrany plik jest pusty.", "EMPTY_FILE");
    if(arrayBuffer.byteLength > MAX_FILE_BYTES) throw parserError("Plik jest zbyt duzy (maksymalnie 25 MB).", "FILE_TOO_LARGE");
    const extension = (fileName.match(/\.([^.]+)$/)?.[1] || "").toLowerCase();
    const signature = new Uint8Array(arrayBuffer, 0, Math.min(4, arrayBuffer.byteLength));
    const isZip = signature[0] === 0x50 && signature[1] === 0x4b;
    let parsed;
    if(extension === "xlsx" || isZip){
      parsed = await parseXlsx(arrayBuffer, fileName);
    }else if(["csv", "txt", "tsv"].includes(extension) || !extension){
      const text = decodeTextFile(arrayBuffer);
      parsed = {fileName, sheetName:fileName, tableRows:parseDelimited(text, extension === "tsv" ? "\t" : detectDelimiter(text))};
    }else{
      throw parserError("Obslugiwane sa pliki XLSX, CSV, TSV i TXT.", "UNSUPPORTED_FILE_TYPE");
    }
    const result = rowsFromTable(parsed.tableRows);
    return {fileName, sheetName:parsed.sheetName || "Arkusz 1", ...result};
  }

  global.parseProductLinksFile = parseProductLinksFile;
  // Niewielki, tylko-do-odczytu interfejs pomocniczy ulatwia testy bez laczenia z UI.
  global.productLinkFileImportParser = Object.freeze({
    parseProductLinksFile,
    canonicalProductUrl,
    detectDelimiter,
    parseDelimited,
    maxRows:MAX_ROWS
  });
})(typeof window !== "undefined" ? window : globalThis);

/* ═══════════ IMPORT PRODUKTÓW Z PLIKU LINKÓW ═══════════
   Ekran administracyjny steruje trwałym zadaniem serwerowym. Każde wywołanie
   process-next pobiera, kontroluje i zapisuje dokładnie jeden produkt. */
const PRODUCT_LINK_IMPORT_STORAGE_KEY="artway_product_link_import_job";
const PRODUCT_LINK_IMPORT_PAGE_SIZES=[25,50,100];
const PRODUCT_LINK_IMPORT_TERMINAL_STATES=new Set(["completed","cancelled"]);
let productLinkImportStan={
  initialized:false,jobId:"",job:null,summary:null,items:[],analysisItems:[],parsedRows:[],fileName:"",
  parsing:false,creating:false,statusLoading:false,loopActive:false,pauseRequested:false,cancelRequested:false,
  filter:"all",query:"",page:1,pageSize:50,error:"",notice:"",startedLocallyAt:0,lastStepAt:0,statusLoadedFor:"",
  reviewSelected:new Set(),reviewBusy:false
};

function productLinkImportWczytajPamiec(){
  if(productLinkImportStan.initialized)return;
  productLinkImportStan.initialized=true;
  try{
    const saved=JSON.parse(localStorage.getItem(PRODUCT_LINK_IMPORT_STORAGE_KEY)||"null");
    if(saved?.jobId){productLinkImportStan.jobId=String(saved.jobId);productLinkImportStan.fileName=String(saved.fileName||"");}
  }catch(_error){}
}
function productLinkImportZapiszPamiec(){
  try{
    if(!productLinkImportStan.jobId)localStorage.removeItem(PRODUCT_LINK_IMPORT_STORAGE_KEY);
    else localStorage.setItem(PRODUCT_LINK_IMPORT_STORAGE_KEY,JSON.stringify({jobId:productLinkImportStan.jobId,fileName:productLinkImportStan.fileName,savedAt:new Date().toISOString()}));
  }catch(_error){}
}
function productLinkImportBrakZadania(error){return Number(error?.status)===404||String(error?.code||"")==="product_link_import_not_found";}
function productLinkImportWyczyscStareZadanie(error){
  if(!productLinkImportBrakZadania(error))return false;
  productLinkImportStan.jobId="";productLinkImportStan.job=null;productLinkImportStan.summary=null;productLinkImportStan.items=[];productLinkImportStan.analysisItems=[];productLinkImportStan.parsedRows=[];productLinkImportStan.fileName="";productLinkImportStan.statusLoadedFor="";productLinkImportStan.pauseRequested=false;productLinkImportStan.cancelRequested=false;productLinkImportStan.reviewSelected.clear();productLinkImportStan.reviewBusy=false;productLinkImportStan.error="";productLinkImportStan.notice="Poprzednie zadanie nie jest już dostępne. Możesz wybrać nowy plik i rozpocząć nowy import.";
  productLinkImportZapiszPamiec();return true;
}
function productLinkImportCzekaj(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));}
function productLinkImportLiczba(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function productLinkImportStatus(status){
  const value=String(status||"queued").toLowerCase().replace(/[ -]+/g,"_");
  const aliases={pending:"queued",waiting:"queued",in_progress:"processing",running:"processing",success:"added",saved:"added",duplicate:"skipped_existing",skipped:"skipped_existing",review:"needs_review",error:"failed",canceled:"cancelled"};
  return aliases[value]||value;
}
function productLinkImportStanZadania(state){
  const value=String(state||"running").toLowerCase().replace(/[ -]+/g,"_");
  const aliases={queued:"running",ready:"running",processing:"running",done:"completed",finished:"completed",canceled:"cancelled"};
  return aliases[value]||value;
}
function productLinkImportKluczElementu(item){return String(item?.id||item?.itemId||item?.rowNumber||item?.url||"");}
function productLinkImportNormalizujElement(raw,index=0){
  const item=raw||{};
  return {
    ...item,
    id:String(item.id||item.itemId||`row-${productLinkImportLiczba(item.rowNumber,index+1)}`),
    rowNumber:productLinkImportLiczba(item.rowNumber||item.row||item.line,index+1),
    name:String(item.name||item.productName||item.nazwa||""),
    url:String(item.url||item.link||item.sourceUrl||""),
    status:productLinkImportStatus(item.status),
    attempts:productLinkImportLiczba(item.attempts||item.proby,0),
    productId:item.productId??item.addedProductId??null,
    duplicateProductId:item.duplicateProductId??item.existingProductId??null,
    reason:String(item.reason||item.message||""),error:String(item.error||"")
  };
}
function productLinkImportScalElementy(incoming,replace=false){
  const list=Array.isArray(incoming)?incoming:[];
  if(replace){productLinkImportStan.items=list.map(productLinkImportNormalizujElement);return;}
  const merged=new Map(productLinkImportStan.items.map((item,index)=>[productLinkImportKluczElementu(item)||`old-${index}`,item]));
  list.forEach((raw,index)=>{const item=productLinkImportNormalizujElement(raw,index),key=productLinkImportKluczElementu(item)||`new-${index}`;merged.set(key,{...(merged.get(key)||{}),...item});});
  productLinkImportStan.items=[...merged.values()].sort((a,b)=>a.rowNumber-b.rowNumber);
}
function productLinkImportScalOdpowiedz(data={}){
  const job=data.job||data.importJob||{},id=job.id||job.jobId||data.jobId||productLinkImportStan.jobId;
  if(id){productLinkImportStan.jobId=String(id);productLinkImportStan.statusLoadedFor=String(id);}
  productLinkImportStan.job={...(productLinkImportStan.job||{}),...job,id:String(id||""),state:productLinkImportStanZadania(job.state||job.status||data.state||productLinkImportStan.job?.state)};
  productLinkImportStan.fileName=String(job.fileName||data.fileName||productLinkImportStan.fileName||"");
  if(Array.isArray(data.items))productLinkImportScalElementy(data.items,true);
  else if(Array.isArray(job.items))productLinkImportScalElementy(job.items,true);
  if(data.processedItem)productLinkImportScalElementy([data.processedItem]);
  productLinkImportStan.summary={...(productLinkImportStan.summary||{}),...(job.summary||{}),...(data.summary||{})};
  if(data.processedItem)productLinkImportStan.lastStepAt=Date.now();
  for(const id of [...productLinkImportStan.reviewSelected]){const current=productLinkImportStan.items.find(item=>String(item.id)===String(id));if(!current||productLinkImportStatus(current.status)!=="needs_review")productLinkImportStan.reviewSelected.delete(id);}
  productLinkImportStan.error="";productLinkImportZapiszPamiec();
  return productLinkImportStan.job;
}
function productLinkImportPodsumowanie(){
  const source=productLinkImportStan.summary||{},items=productLinkImportStan.items;
  const count=status=>items.filter(item=>productLinkImportStatus(item.status)===status).length;
  const total=productLinkImportLiczba(source.total,productLinkImportLiczba(productLinkImportStan.job?.total,items.length||productLinkImportStan.parsedRows.length));
  const invalid=productLinkImportStan.analysisItems.filter(item=>item.status==="invalid_file").length,duplicates=productLinkImportStan.analysisItems.filter(item=>item.status==="duplicate_file").length,result={
    total,queued:productLinkImportLiczba(source.queued,count("queued")),processing:productLinkImportLiczba(source.processing,count("processing")),
    added:productLinkImportLiczba(source.added,count("added")),skipped_existing:productLinkImportLiczba(source.skipped_existing,count("skipped_existing")),
    needs_review:productLinkImportLiczba(source.needs_review,count("needs_review")),failed:productLinkImportLiczba(source.failed,count("failed")),
    cancelled:productLinkImportLiczba(source.cancelled,count("cancelled")),invalid_file:invalid,duplicate_file:duplicates
  };
  result.processed=productLinkImportLiczba(source.processed,result.added+result.skipped_existing+result.needs_review+result.failed+result.cancelled);
  result.percent=Math.max(0,Math.min(100,productLinkImportLiczba(source.percent,total?Math.round(result.processed/total*100):0)));
  result.fileTotal=total+invalid+duplicates;result.fileRejected=invalid+duplicates;
  return result;
}
function productLinkImportAktywne(){return !!productLinkImportStan.jobId&&!PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||"");}
function productLinkImportEtykietaStatusu(status){
  return ({queued:"Oczekuje",processing:"Pobieranie",added:"Dodano",skipped_existing:"Pominięto — istnieje",needs_review:"Do decyzji",failed:"Błąd",cancelled:"Anulowano",invalid_file:"Błędny wiersz pliku",duplicate_file:"Duplikat w pliku"})[productLinkImportStatus(status)]||String(status||"Oczekuje");
}
function productLinkImportIkonaStatusu(status){return ({queued:"○",processing:"↻",added:"✓",skipped_existing:"↪",needs_review:"!",failed:"×",cancelled:"−",invalid_file:"×",duplicate_file:"↪"})[productLinkImportStatus(status)]||"○";}
function productLinkImportRozpoznajWiersze(parsed){
  const source=Array.isArray(parsed)?parsed:(parsed?.rows||parsed?.links||parsed?.items||[]);
  return source.map((raw,index)=>{
    if(typeof raw==="string")return {rowNumber:index+1,name:"",url:raw.trim()};
    return {rowNumber:productLinkImportLiczba(raw?.rowNumber||raw?.row||raw?.line,index+1),name:String(raw?.name||raw?.nazwa||raw?.productName||"").trim(),url:String(raw?.url||raw?.link||raw?.sourceUrl||"").trim()};
  }).filter(row=>/^https?:\/\//i.test(row.url));
}
function productLinkImportRozpoznajOdrzucone(parsed){
  const invalid=(Array.isArray(parsed?.invalid)?parsed.invalid:[]).map((raw,index)=>productLinkImportNormalizujElement({id:`analysis-invalid-${raw?.rowNumber||index+1}-${index}`,rowNumber:raw?.rowNumber||index+1,name:raw?.name||"",url:raw?.value||raw?.url||"",status:"invalid_file",reason:raw?.reason||raw?.code||"Nieprawidłowy link — nie wysłano do kolejki."},index));
  const duplicates=(Array.isArray(parsed?.duplicates)?parsed.duplicates:[]).map((raw,index)=>productLinkImportNormalizujElement({id:`analysis-duplicate-${raw?.rowNumber||index+1}-${index}`,rowNumber:raw?.rowNumber||index+1,name:raw?.name||"",url:raw?.url||raw?.value||"",status:"duplicate_file",reason:raw?.duplicateOfRow?`Ten sam link występuje już w wierszu ${raw.duplicateOfRow} — nie wysłano ponownie.`:"Powtórzony link w pliku — nie wysłano ponownie."},index));
  return [...invalid,...duplicates].sort((a,b)=>a.rowNumber-b.rowNumber);
}
function productLinkImportWszystkieElementy(){return [...productLinkImportStan.items,...productLinkImportStan.analysisItems].sort((a,b)=>a.rowNumber-b.rowNumber);}

async function productLinkImportWczytajPlik(file){
  if(!file||productLinkImportAktywne())return;
  productLinkImportStan.parsing=true;productLinkImportStan.error="";productLinkImportStan.notice="Analizuję kolumny i linki…";productLinkImportStan.fileName=String(file.name||"plik-linkow");
  productLinkImportOdswiezDOM();
  try{
    const parsed=await parseProductLinksFile(file,{fileName:productLinkImportStan.fileName}),rows=productLinkImportRozpoznajWiersze(parsed),analysisItems=productLinkImportRozpoznajOdrzucone(parsed);
    if(!rows.length&&!analysisItems.length)throw new Error("Nie znaleziono adresów produktów w pliku.");
    productLinkImportStan.jobId="";productLinkImportStan.job=null;productLinkImportStan.summary=null;productLinkImportStan.parsedRows=rows;
    productLinkImportStan.items=rows.map((row,index)=>productLinkImportNormalizujElement({...row,id:`preview-${index+1}`,status:"queued"},index));
    productLinkImportStan.analysisItems=analysisItems;productLinkImportStan.page=1;productLinkImportStan.notice=rows.length?`Gotowe: ${rows.length} ${rows.length===1?"poprawny link":"poprawnych linków"}${analysisItems.length?` • ${analysisItems.length} pozycji odrzuconych pokazano w raporcie`:""}. Import zapisze każdy produkt bezpośrednio po jego sprawdzeniu.`:`Nie znaleziono poprawnych linków. ${analysisItems.length} odrzuconych pozycji pokazano poniżej — popraw plik przed uruchomieniem importu.`;
    productLinkImportZapiszPamiec();
  }catch(error){productLinkImportStan.error=error?.message||String(error);productLinkImportStan.notice="";productLinkImportStan.parsedRows=[];productLinkImportStan.items=[];productLinkImportStan.analysisItems=[];}
  finally{productLinkImportStan.parsing=false;productLinkImportOdswiezDOM();}
}
function productLinkImportWybranoPlik(input){const file=input?.files?.[0];if(file)void productLinkImportWczytajPlik(file);}
function productLinkImportPrzeciagnij(event){event.preventDefault();event.currentTarget?.classList.add("is-dragging");}
function productLinkImportOpusc(event){event.preventDefault();event.currentTarget?.classList.remove("is-dragging");}
function productLinkImportUpusc(event){event.preventDefault();event.currentTarget?.classList.remove("is-dragging");const file=event.dataTransfer?.files?.[0];if(file)void productLinkImportWczytajPlik(file);}

async function productLinkImportUtworz(){
  if(productLinkImportStan.creating||productLinkImportStan.loopActive||!productLinkImportStan.parsedRows.length)return;
  productLinkImportStan.creating=true;productLinkImportStan.error="";productLinkImportStan.notice="Tworzę bezpieczną kolejkę na serwerze…";productLinkImportOdswiezDOM();
  try{
    const response=await chmura("product-link-import-create",{method:"POST",body:{fileName:productLinkImportStan.fileName,rows:productLinkImportStan.parsedRows},timeout:60000});
    productLinkImportScalOdpowiedz(response);productLinkImportStan.startedLocallyAt=Date.now();productLinkImportStan.notice="Kolejka uruchomiona. Produkty są dodawane pojedynczo i od razu zapisywane.";
    void productLinkImportPetla();
  }catch(error){productLinkImportStan.error=error?.message||String(error);productLinkImportStan.notice="Nie uruchomiono importu — żaden produkt nie został zmieniony.";}
  finally{productLinkImportStan.creating=false;productLinkImportOdswiezDOM();}
}
async function productLinkImportPetla(){
  if(productLinkImportStan.loopActive||!productLinkImportStan.jobId)return;
  productLinkImportStan.loopActive=true;productLinkImportStan.pauseRequested=false;productLinkImportStan.cancelRequested=false;productLinkImportOdswiezDOM();
  let busyDelay=1200;
  try{
    while(productLinkImportStan.loopActive&&!productLinkImportStan.pauseRequested&&!productLinkImportStan.cancelRequested){
      if(PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||""))break;
      const response=await chmura("product-link-import-process-next",{method:"POST",body:{jobId:productLinkImportStan.jobId},timeout:120000});
      productLinkImportScalOdpowiedz(response);productLinkImportOdswiezDOM();
      if(response.done||PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||""))break;
      if(response.busy){productLinkImportStan.notice="Bieżący link jest jeszcze kończony przez serwer. Kolejka wznowi się automatycznie.";productLinkImportOdswiezDOM();await productLinkImportCzekaj(busyDelay);busyDelay=Math.min(5000,Math.round(busyDelay*1.6));continue;}
      busyDelay=1200;if(!response.processedItem)break;
    }
  }catch(error){if(!productLinkImportWyczyscStareZadanie(error)){productLinkImportStan.error=error?.message||String(error);productLinkImportStan.notice="Import zatrzymano bez cofania zapisanych produktów. Możesz bezpiecznie wznowić kolejkę.";}}
  finally{
    productLinkImportStan.loopActive=false;productLinkImportOdswiezDOM();
    if(PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||"")){
      await chmuraWczytajStan().catch(()=>false);
      zbudujProdukty();
    }
    if(!PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||"")){
      if(productLinkImportStan.cancelRequested)void productLinkImportSteruj("cancel");
      else if(productLinkImportStan.pauseRequested)void productLinkImportSteruj("pause");
    }
  }
}
async function productLinkImportSteruj(command){
  if(!productLinkImportStan.jobId)return;
  if(command==="pause"){productLinkImportStan.pauseRequested=true;productLinkImportStan.notice="Pauza nastąpi po zakończeniu obecnie przetwarzanego linku.";}
  if(command==="cancel"){productLinkImportStan.cancelRequested=true;productLinkImportStan.notice="Anulowanie nastąpi po zakończeniu obecnego linku. Dodane produkty pozostaną zapisane.";}
  productLinkImportOdswiezDOM();
  try{
    const response=await chmura("product-link-import-control",{method:"POST",body:{jobId:productLinkImportStan.jobId,command},timeout:30000});
    productLinkImportScalOdpowiedz(response);
    if(command==="resume"){productLinkImportStan.pauseRequested=false;productLinkImportStan.cancelRequested=false;productLinkImportStan.notice="Wznowiono od pierwszego nieprzetworzonego linku.";void productLinkImportPetla();}
    else if(command==="retry_failures"){productLinkImportStan.notice="Błędne pozycje wróciły do kolejki.";void productLinkImportPetla();}
  }catch(error){if(!productLinkImportWyczyscStareZadanie(error))productLinkImportStan.error=error?.message||String(error);if(command==="pause")productLinkImportStan.pauseRequested=false;if(command==="cancel")productLinkImportStan.cancelRequested=false;}
  finally{productLinkImportOdswiezDOM();}
}
function productLinkImportPauza(){
  productLinkImportStan.pauseRequested=true;productLinkImportStan.notice="Pauza nastąpi po zakończeniu obecnie przetwarzanego linku.";productLinkImportOdswiezDOM();
  if(!productLinkImportStan.loopActive)void productLinkImportSteruj("pause");
}
function productLinkImportWznow(){void productLinkImportSteruj("resume");}
function productLinkImportAnuluj(){
  productLinkImportStan.cancelRequested=true;productLinkImportStan.notice="Anulowanie nastąpi po zakończeniu obecnego linku. Dodane produkty pozostaną zapisane.";productLinkImportOdswiezDOM();
  if(!productLinkImportStan.loopActive)void productLinkImportSteruj("cancel");
}
function productLinkImportPonowBledy(){void productLinkImportSteruj("retry_failures");}
async function productLinkImportPobierzStatus(autoResume=false){
  if(!productLinkImportStan.jobId||productLinkImportStan.statusLoading)return;
  productLinkImportStan.statusLoading=true;productLinkImportOdswiezDOM();
  try{
    const response=await chmura("product-link-import-status",{params:{jobId:productLinkImportStan.jobId},timeout:30000});
    productLinkImportScalOdpowiedz(response);
    if(autoResume&&productLinkImportStan.job?.state==="running")void productLinkImportPetla();
  }catch(error){if(!productLinkImportWyczyscStareZadanie(error))productLinkImportStan.error=error?.message||String(error);}
  finally{productLinkImportStan.statusLoading=false;productLinkImportOdswiezDOM();}
}

function productLinkImportElementyPoFiltrze(){
  const q=String(productLinkImportStan.query||"").trim().toLowerCase(),filter=productLinkImportStan.filter;
  return productLinkImportWszystkieElementy().filter(item=>{const status=productLinkImportStatus(item.status),statusMatch=filter==="all"||status===filter||(filter==="file_rejected"&&["invalid_file","duplicate_file"].includes(status));return statusMatch&&(!q||[item.rowNumber,item.name,item.url,item.productId,item.duplicateProductId,item.reason,item.error].join(" ").toLowerCase().includes(q));});
}
function productLinkImportUstawFiltr(value){productLinkImportStan.filter=String(value||"all");productLinkImportStan.page=1;productLinkImportOdswiezDOM();}
function productLinkImportSzukaj(input){productLinkImportStan.query=String(input?.value||"");productLinkImportStan.page=1;productLinkImportOdswiezTabele();}
function productLinkImportUstawStrone(page){productLinkImportStan.page=Math.max(1,Number(page)||1);productLinkImportOdswiezTabele();document.querySelector("[data-product-link-results]")?.scrollIntoView({behavior:"smooth",block:"start"});}
function productLinkImportUstawRozmiar(value){const size=Number(value);productLinkImportStan.pageSize=PRODUCT_LINK_IMPORT_PAGE_SIZES.includes(size)?size:50;productLinkImportStan.page=1;productLinkImportOdswiezTabele();}
function productLinkImportCSVBezpieczne(value){const text=String(value??"");return /^[\s]*[=+\-@]/.test(text)?`'${text}`:text;}
function productLinkImportEksportujRaport(){
  const rows=productLinkImportWszystkieElementy().map(item=>[item.rowNumber,item.name,item.url,productLinkImportEtykietaStatusu(item.status),item.productId||item.duplicateProductId||"",item.attempts,item.error||item.reason||""].map(productLinkImportCSVBezpieczne));
  if(typeof adminEksportujCSV==="function")adminEksportujCSV(`import-linkow-${new Date().toISOString().slice(0,10)}.csv`,["Wiersz","Nazwa","Link","Status","ID produktu","Próby","Informacja"],rows);
}
function productLinkImportCzasPozostaly(summary){
  const completed=summary.processed,remaining=Math.max(0,summary.total-completed),elapsed=(Date.now()-(productLinkImportStan.startedLocallyAt||Date.now()))/1000;
  if(!completed||elapsed<1||!remaining)return remaining?"czas pojawi się po pierwszych produktach":"zakończono";
  const seconds=Math.round(elapsed/completed*remaining);if(seconds<60)return `około ${seconds} s`;if(seconds<3600)return `około ${Math.ceil(seconds/60)} min`;return `około ${Math.ceil(seconds/3600)} godz.`;
}
function productLinkImportReviewDraft(item={}){
  const draft=item.reviewDraft&&typeof item.reviewDraft==="object"?item.reviewDraft:{};
  const rawName=String(draft.nazwa||item.name||"").trim(),placeholderName=/^\(?\s*brak nazwy\s*\)?$/i.test(rawName)?"":rawName;
  return {...draft,nazwa:placeholderName,sourceUrl:draft.sourceUrl||item.url||"",producentUrl:draft.producentUrl||item.url||""};
}
function productLinkImportReviewBraki(item={}){
  const stored=Array.isArray(item.missingFields)?item.missingFields.filter(Boolean):[];
  if(stored.length)return stored;
  const d=productLinkImportReviewDraft(item),reason=String(item.reason||item.error||"").toLowerCase(),out=[];
  if(!String(d.nazwa||"").trim()||/nazw/.test(reason))out.push("nazwa");
  if(!(Number(d.cena)>0)||/cen/.test(reason))out.push("cena sprzedaży");
  if(/producent|mark/.test(reason))out.push("producent lub marka");
  if(/kategori/.test(reason))out.push("kategoria sklepu");
  if(!reason){if(!String(d.producent||d.marka||"").trim())out.push("producent lub marka");if(!String(d.kategoria||"").trim())out.push("kategoria sklepu");}
  return [...new Set(out)];
}
function productLinkImportReviewFormHTML(item={}){
  const d=productLinkImportReviewDraft(item),missing=productLinkImportReviewBraki(item),brak=field=>missing.some(value=>String(value).toLowerCase().includes(field)),wymagane=field=>brak(field)?" required":"",gwiazdka=field=>brak(field)?" *":"";
  return `<details class="product-link-review-editor"><summary><span>✏️ Uzupełnij dane produktu</span><em>${missing.length?`Brakuje: ${esc(missing.join(", "))}`:"Szkic gotowy do zatwierdzenia"}</em></summary><form onsubmit="return productLinkImportZapiszDecyzje(event,${jsArg(item.id)})"><div class="product-link-review-primary"><label class="${brak("cena")?"is-required":""}"><span>Cena sprzedaży brutto${gwiazdka("cena")}</span><input name="cena" inputmode="decimal" value="${esc(Number(d.cena)>0?d.cena:"")}" placeholder="np. 29,90"${wymagane("cena")}></label><label class="${brak("nazwa")?"is-required":""}"><span>Nazwa produktu${gwiazdka("nazwa")}</span><input name="nazwa" value="${esc(d.nazwa||"")}"${wymagane("nazwa")}></label><label class="${brak("producent")?"is-required":""}"><span>Producent / marka${gwiazdka("producent")}</span><input name="producent" value="${esc(d.producent||d.marka||"")}"${wymagane("producent")}></label><label class="${brak("kategoria")?"is-required":""}"><span>Kategoria sklepu${gwiazdka("kategoria")}</span><input name="kategoria" value="${esc(d.kategoria||"")}"${wymagane("kategoria")}></label></div><details class="product-link-review-more"><summary>Więcej danych do poprawy</summary><div><label><span>EAN / GTIN</span><input name="ean" value="${esc(d.ean||d.gtin||"")}"></label><label><span>EXTERNAL_ID / SKU</span><input name="externalId" value="${esc(d.externalId||d.sku||"")}"></label><label><span>Kod producenta</span><input name="kodProducenta" value="${esc(d.kodProducenta||d.mpn||"")}"></label><label><span>Główne zdjęcie</span><input name="zdjecie" value="${esc(d.zdjecie||"")}" placeholder="https://…"></label><label><span>Emoji</span><input name="ikona" value="${esc(d.ikona||"🎲")}" maxlength="20"></label><label><span>Kolor karty</span><input name="kolor" type="color" value="${/^#[0-9a-f]{6}$/i.test(String(d.kolor||""))?esc(d.kolor):"#dbeafe"}"></label><label class="wide"><span>Krótki opis</span><textarea name="opisKrotki" rows="2">${esc(d.opisKrotki||"")}</textarea></label><label class="wide"><span>Pełny opis</span><textarea name="opis" rows="5">${esc(d.opis||"")}</textarea></label></div></details><footer><small>System ponownie sprawdzi link, połączy pobrane dane z Twoimi zmianami i doda produkt tylko wtedy, gdy wszystkie wymagane pola będą kompletne.</small><button class="btn" type="submit" ${productLinkImportStan.reviewBusy?"disabled":""}>✅ Zapisz decyzję i dodaj produkt</button></footer></form></details>`;
}
function productLinkImportPatchZFormularza(form){
  const data=new FormData(form),patch={};for(const field of ["cena","nazwa","producent","marka","kategoria","ean","externalId","kodProducenta","zdjecie","ikona","kolor","opisKrotki","opis"]){const value=String(data.get(field)||"").trim();if(data.has(field)&&value)patch[field]=value;}return patch;
}
async function productLinkImportRozstrzygnij(items,commonPatch={},message="Zapisuję decyzję…"){
  if(productLinkImportStan.reviewBusy||!productLinkImportStan.jobId||!items.length)return false;
  productLinkImportStan.reviewBusy=true;productLinkImportStan.error="";productLinkImportStan.notice=message;productLinkImportOdswiezDOM();
  let completed=0,resolved=0,stillNeedsReview=0;
  try{
    const chunks=[];for(let index=0;index<items.length;index+=10)chunks.push(items.slice(index,index+10));
    for(const chunk of chunks){productLinkImportStan.notice=`${message} ${completed}/${items.length}`;productLinkImportOdswiezDOM();const response=await chmura("product-link-import-review-resolve",{method:"POST",body:{jobId:productLinkImportStan.jobId,items:chunk,commonPatch},timeout:180000});productLinkImportScalOdpowiedz(response);completed+=chunk.length;resolved+=Number(response.resolved)||0;stillNeedsReview+=Number(response.stillNeedsReview)||0;}
    await chmuraWczytajStan().catch(()=>false);zbudujProdukty();
    productLinkImportStan.notice=`Decyzje zapisane: dodano lub połączono ${resolved}${stillNeedsReview?` • nadal wymaga danych ${stillNeedsReview}`:""}.`;
    toast(`✅ Uzupełniono ${resolved} produktów${stillNeedsReview?` • ${stillNeedsReview} nadal do decyzji`:""}`);return true;
  }catch(error){await productLinkImportPobierzStatus(false).catch(()=>false);productLinkImportStan.error=completed?`Zapisano ${completed} z ${items.length} pozycji. Pozostałe nie zostały zmienione: ${error?.message||String(error)}`:error?.message||String(error);productLinkImportStan.notice=completed?"Operację można bezpiecznie ponowić dla pozostałych zaznaczonych produktów.":"Nie zapisano decyzji.";return false;}
  finally{productLinkImportStan.reviewBusy=false;productLinkImportOdswiezDOM();}
}
function productLinkImportZapiszDecyzje(event,itemId){event.preventDefault();const form=event.currentTarget,patch=productLinkImportPatchZFormularza(form);void productLinkImportRozstrzygnij([{itemId:String(itemId),patch}],{},"Sprawdzam link i zapisuję decyzję dla produktu…");return false;}
function productLinkImportZaznaczReview(itemId,checked){const id=String(itemId);if(checked)productLinkImportStan.reviewSelected.add(id);else productLinkImportStan.reviewSelected.delete(id);productLinkImportOdswiezReviewToolbar();}
function productLinkImportWidoczneReview(){return productLinkImportElementyPoFiltrze().filter(item=>productLinkImportStatus(item.status)==="needs_review");}
function productLinkImportZaznaczWidoczneReview(checked=true){const review=productLinkImportWidoczneReview();if(checked&&review.length>200)toast("Zaznaczono pierwsze 200 produktów — to bezpieczny limit jednej operacji");review.slice(0,200).forEach(item=>checked?productLinkImportStan.reviewSelected.add(String(item.id)):productLinkImportStan.reviewSelected.delete(String(item.id)));if(!checked)review.forEach(item=>productLinkImportStan.reviewSelected.delete(String(item.id)));productLinkImportOdswiezTabele();productLinkImportOdswiezReviewToolbar();}
function productLinkImportOdswiezReviewToolbar(){const root=document.querySelector("[data-product-link-review-bulk]");if(!root)return;const count=[...productLinkImportStan.reviewSelected].filter(id=>productLinkImportStan.items.some(item=>String(item.id)===id&&productLinkImportStatus(item.status)==="needs_review")).length;root.querySelector("[data-review-selected]")?.replaceChildren(document.createTextNode(String(count)));const submit=root.querySelector('button[type="submit"]');if(submit)submit.disabled=!count||productLinkImportStan.reviewBusy;}
function productLinkImportMasowaDecyzja(event){event.preventDefault();const form=event.currentTarget,patch=productLinkImportPatchZFormularza(form),hasValue=Object.entries(patch).some(([field,value])=>field==="cena"?Number(String(value).replace(",","."))>0:String(value).trim());if(!hasValue){toast("Wpisz co najmniej jedną wspólną wartość");return false;}const items=[...productLinkImportStan.reviewSelected].map(itemId=>({itemId,patch:{}}));void productLinkImportRozstrzygnij(items,patch,"Stosuję wspólne dane i sprawdzam zaznaczone produkty…");return false;}
function productLinkImportMasowaDecyzjaHTML(summary){
  const selected=productLinkImportStan.reviewSelected.size;
  return `<section class="product-link-review-bulk" data-product-link-review-bulk ${summary.needs_review?"":"hidden"}><header><div><span class="order-pro-label">Operacja masowa</span><h3>🧩 Uzupełnij zaznaczone produkty</h3><small>Wypełnij tylko pola, które mają otrzymać wspólną wartość. Pozostałe dane każdego produktu zostaną zachowane. Jedna operacja obsługuje do 200 pozycji.</small></div><div><button class="btn ghost" type="button" onclick="productLinkImportZaznaczWidoczneReview(true)">Zaznacz wszystkie w filtrze</button><button class="btn ghost" type="button" onclick="productLinkImportZaznaczWidoczneReview(false)">Odznacz</button><b><span data-review-selected>${selected}</span> zaznaczonych</b></div></header><form onsubmit="return productLinkImportMasowaDecyzja(event)"><label><span>Wspólna cena brutto</span><input name="cena" inputmode="decimal" placeholder="np. 29,90"></label><label><span>Wspólny producent</span><input name="producent" placeholder="np. Alexander"></label><label><span>Wspólna kategoria</span><input name="kategoria" placeholder="np. Gry edukacyjne"></label><label><span>Wspólne emoji</span><input name="ikona" placeholder="🎈"></label><label><span>Wspólny kolor</span><input name="kolor" placeholder="#dbeafe"></label><button class="btn" type="submit" ${!selected||productLinkImportStan.reviewBusy?"disabled":""}>Zastosuj i dodaj gotowe</button></form></section>`;
}
function productLinkImportWierszeHTML(){
  const filtered=productLinkImportElementyPoFiltrze(),pages=Math.max(1,Math.ceil(filtered.length/productLinkImportStan.pageSize));
  productLinkImportStan.page=Math.min(productLinkImportStan.page,pages);const start=(productLinkImportStan.page-1)*productLinkImportStan.pageSize,rows=filtered.slice(start,start+productLinkImportStan.pageSize);
  return `${rows.map(item=>{const status=productLinkImportStatus(item.status),productId=item.productId||item.duplicateProductId,link=/^https?:\/\//i.test(item.url)?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a>`:`<span class="product-link-import-raw-value">${esc(item.url||"brak adresu")}</span>`,review=status==="needs_review";return `<tr data-import-row="${esc(item.id)}" class="status-${esc(status)}"><td>${review?`<label class="product-link-review-check"><input type="checkbox" ${productLinkImportStan.reviewSelected.has(String(item.id))?"checked":""} onchange="productLinkImportZaznaczReview(${jsArg(item.id)},this.checked)"><span>${esc(item.rowNumber)}</span></label>`:`<b>${esc(item.rowNumber)}</b>`}</td><td><div class="product-link-import-name"><b>${esc(productLinkImportReviewDraft(item).nazwa||"Nazwa zostanie pobrana ze źródła")}</b>${link}</div></td><td><span class="product-link-import-status ${esc(status)}">${productLinkImportIkonaStatusu(status)} ${esc(productLinkImportEtykietaStatusu(status))}</span>${item.attempts?`<small>${esc(item.attempts)} ${item.attempts===1?"próba":"próby"}</small>`:""}</td><td>${productId?`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(productId)}">Produkt #${esc(productId)}</a>`:review?`<span class="lvl lvl-ostrzezenie">czeka na dane</span>`:"—"}</td><td><small>${esc(item.error||item.reason||"")}</small></td></tr>${review?`<tr class="product-link-review-row"><td colspan="5">${productLinkImportReviewFormHTML(item)}</td></tr>`:""}`;}).join("")||`<tr><td colspan="5"><div class="product-link-import-empty">Brak pozycji w wybranym filtrze.</div></td></tr>`}<tr class="product-link-import-pagination-row"><td colspan="5"><div class="product-link-import-pagination"><span>Wyniki ${filtered.length?start+1:0}–${Math.min(start+productLinkImportStan.pageSize,filtered.length)} z ${filtered.length}</span><div><button class="btn ghost" type="button" onclick="productLinkImportUstawStrone(${productLinkImportStan.page-1})" ${productLinkImportStan.page<=1?"disabled":""}>←</button><b>Strona ${productLinkImportStan.page} / ${pages}</b><button class="btn ghost" type="button" onclick="productLinkImportUstawStrone(${productLinkImportStan.page+1})" ${productLinkImportStan.page>=pages?"disabled":""}>→</button></div></div></td></tr>`;
}
function productLinkImportOdswiezTabele(){
  const body=document.querySelector("[data-product-link-table-body]");if(body)body.innerHTML=productLinkImportWierszeHTML();
  const count=document.querySelector("[data-product-link-visible]");if(count)count.textContent=String(productLinkImportElementyPoFiltrze().length);
  productLinkImportOdswiezReviewToolbar();
}
function productLinkImportOdswiezDOM(){
  const root=document.querySelector("[data-product-link-import-page]");if(!root)return;
  const summary=productLinkImportPodsumowanie(),jobState=productLinkImportStan.job?.state||"",active=productLinkImportAktywne(),paused=jobState==="paused"||productLinkImportStan.pauseRequested,done=jobState==="completed",cancelled=jobState==="cancelled";
  [["total",summary.fileTotal],["added",summary.added],["skipped",summary.skipped_existing],["review",summary.needs_review],["failed",summary.failed],["rejected",summary.fileRejected]].forEach(([key,value])=>{const el=root.querySelector(`[data-import-count="${key}"]`);if(el)el.textContent=String(value);});
  const bar=root.querySelector("[data-product-link-progress-bar]");if(bar){bar.style.width=`${summary.percent}%`;bar.parentElement?.setAttribute("aria-valuenow",String(summary.percent));}
  const progress=root.querySelector("[data-product-link-progress-text]");if(progress)progress.textContent=`${summary.processed} z ${summary.total} • ${summary.percent}%`;
  const eta=root.querySelector("[data-product-link-eta]");if(eta)eta.textContent=productLinkImportCzasPozostaly(summary);
  const current=productLinkImportStan.items.find(item=>item.status==="processing")||productLinkImportStan.items.find(item=>item.id===productLinkImportStan.job?.currentItemId);
  const currentBox=root.querySelector("[data-product-link-current]");if(currentBox)currentBox.innerHTML=current?`<span>Teraz przetwarzam wiersz ${esc(current.rowNumber)}</span><b>${esc(current.name||"Produkt ze wskazanego linku")}</b><small>${esc(current.url)}</small>`:`<span>${done?"Import zakończony":cancelled?"Import anulowany":paused?"Kolejka wstrzymana":"Gotowy do pracy"}</span><b>${done?`${summary.added} produktów dodano i zapisano`:cancelled?"Dodane wcześniej produkty pozostały w katalogu":paused?"Wznów, aby przejść do kolejnego linku":"Każdy produkt zapisuję od razu po sprawdzeniu"}</b>`;
  const notice=root.querySelector("[data-product-link-notice]");if(notice){notice.hidden=!(productLinkImportStan.notice||productLinkImportStan.error);notice.classList.toggle("is-error",!!productLinkImportStan.error);notice.setAttribute("role",productLinkImportStan.error?"alert":"status");notice.setAttribute("aria-live",productLinkImportStan.error?"assertive":"polite");notice.innerHTML=productLinkImportStan.error?`<b>Nie udało się wykonać operacji</b><span>${esc(productLinkImportStan.error)}</span>`:`<b>${done?"Import zakończony":"Stan kolejki"}</b><span>${esc(productLinkImportStan.notice)}</span>`;}
  const upload=root.querySelector("[data-product-link-dropzone]");if(upload)upload.classList.toggle("is-disabled",active||productLinkImportStan.parsing);
  const fileInput=root.querySelector("[data-product-link-file]");if(fileInput)fileInput.disabled=active||productLinkImportStan.parsing;
  const start=root.querySelector("[data-product-link-start]");if(start){start.disabled=!productLinkImportStan.parsedRows.length||!!productLinkImportStan.jobId||active||productLinkImportStan.creating;start.textContent=productLinkImportStan.creating?"Tworzę kolejkę…":done?"✓ Import zakończony":cancelled?"Import anulowany":"▶ Rozpocznij import";}
  const pause=root.querySelector("[data-product-link-pause]");if(pause){pause.hidden=!active||paused;pause.disabled=productLinkImportStan.pauseRequested;}
  const resume=root.querySelector("[data-product-link-resume]");if(resume){const canContinue=active&&!productLinkImportStan.loopActive&&!productLinkImportStan.statusLoading;resume.hidden=!(paused||canContinue);resume.textContent=paused?"▶ Wznów":"▶ Kontynuuj";}
  const cancel=root.querySelector("[data-product-link-cancel]");if(cancel){cancel.hidden=!active;cancel.disabled=productLinkImportStan.cancelRequested;}
  const retry=root.querySelector("[data-product-link-retry]");if(retry){retry.hidden=!summary.failed||active;retry.disabled=active;}
  const report=root.querySelector("[data-product-link-report]");if(report)report.disabled=!productLinkImportWszystkieElementy().length;
  const reviewBulk=root.querySelector("[data-product-link-review-bulk]");if(reviewBulk)reviewBulk.hidden=!summary.needs_review;
  root.querySelectorAll("[data-import-filter]").forEach(button=>{const activeFilter=button.dataset.importFilter===productLinkImportStan.filter;button.classList.toggle("active",activeFilter);button.setAttribute("aria-pressed",String(activeFilter));});
  const statusFilter=root.querySelector("[data-product-link-status-filter]");if(statusFilter)statusFilter.value=productLinkImportStan.filter;
  const fileMeta=root.querySelector("[data-product-link-file-meta]");if(fileMeta)fileMeta.innerHTML=productLinkImportStan.fileName?`<b>${esc(productLinkImportStan.fileName)}</b><span>${esc(summary.fileTotal||productLinkImportStan.parsedRows.length)} przeanalizowanych wierszy • ${esc(summary.total)} poprawnych do kolejki${summary.fileRejected?` • ${esc(summary.fileRejected)} odrzuconych`:""}</span>`:`<b>Wybierz arkusz lub plik tekstowy</b><span>Obsługiwane: XLSX, CSV i TXT</span>`;
  productLinkImportOdswiezTabele();
}
function productLinkImportPoRenderze(){
  productLinkImportOdswiezDOM();
  if(productLinkImportStan.jobId&&productLinkImportStan.statusLoadedFor!==productLinkImportStan.jobId)void productLinkImportPobierzStatus(true);
}

function widokAdminProduktyZPliku(){
  productLinkImportWczytajPamiec();setTimeout(productLinkImportPoRenderze,0);
  const summary=productLinkImportPodsumowanie();
  return asortymentSzkielet("produkty",`<section class="product-link-file-import-page" data-product-link-import-page>
    <div class="panel product-link-import-hero">
      <div class="crumb"><a href="#/admin/asortyment/produkty">Produkty</a> › Dodawanie › Z pliku linków</div>
      <div class="product-link-import-hero-row"><div><span class="order-pro-label">Automatyczne dodawanie pojedynczo</span><h1>📄 Produkty z pliku linków</h1><p>Wczytaj jeden plik z linkami różnych producentów i dostawców. System rozpozna źródło osobno dla każdego wiersza, pobierze pełne dane, sprawdzi duplikat i natychmiast zapisze gotowy produkt przed przejściem do kolejnego.</p></div><span class="product-link-import-safety">🛡️ jeden link = jedno rozpoznane źródło</span></div>
      <nav class="product-link-import-local-nav" aria-label="Sposób dodawania produktu"><a href="#/admin/produkty/dodaj">✍️ Ręcznie lub z jednego linku</a><a class="active" href="#/admin/produkty/z-pliku" aria-current="page">📄 Z pliku linków</a></nav>
    </div>
    <div class="panel product-link-import-upload-panel">
      <div class="order-section-head"><div><span class="order-pro-label">Krok 1</span><h2>Wybierz plik z linkami</h2><p>Kolumna „Link do produktu” zostanie rozpoznana automatycznie. Pozostałe kolumny, np. nazwa i numer wiersza, posłużą do czytelnego raportu.</p></div></div>
      <label class="product-link-import-dropzone" data-product-link-dropzone ondragover="productLinkImportPrzeciagnij(event)" ondragleave="productLinkImportOpusc(event)" ondrop="productLinkImportUpusc(event)">
        <input data-product-link-file type="file" accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain" aria-label="Wybierz plik XLSX, CSV lub TXT z linkami produktów" aria-describedby="productLinkImportFileMeta" onchange="productLinkImportWybranoPlik(this)">
        <span class="product-link-import-drop-icon" aria-hidden="true">⇧</span><span id="productLinkImportFileMeta" data-product-link-file-meta><b>Wybierz arkusz lub przeciągnij go tutaj</b><span>Obsługiwane: XLSX, CSV, TSV i TXT • linki mogą pochodzić z różnych źródeł</span></span><em>Wybierz plik</em>
      </label>
      <div class="product-link-import-notice" data-product-link-notice role="status" aria-live="polite" aria-atomic="true" hidden></div>
    </div>
    <div class="panel product-link-import-control-panel">
      <div class="order-section-head"><div><span class="order-pro-label">Krok 2</span><h2>Import sukcesywny</h2><p>Nie czekamy na koniec pliku. Każdy poprawny produkt jest zapisany natychmiast; pauza lub anulowanie nie cofa wcześniejszych pozycji.</p></div><div class="diag-actions"><button class="btn" data-product-link-start type="button" onclick="productLinkImportUtworz()" ${productLinkImportStan.parsedRows.length?"":"disabled"}>▶ Rozpocznij import</button><button class="btn ghost" data-product-link-pause type="button" onclick="productLinkImportPauza()" hidden>Ⅱ Pauza po bieżącym</button><button class="btn" data-product-link-resume type="button" onclick="productLinkImportWznow()" hidden>▶ Wznów</button><button class="btn danger" data-product-link-cancel type="button" onclick="productLinkImportAnuluj()" hidden>■ Anuluj po bieżącym</button></div></div>
      <div class="product-link-import-progress-layout"><div class="product-link-import-progress-card"><div><b data-product-link-progress-text>${summary.processed} z ${summary.total} • ${summary.percent}%</b><small>Szacowany pozostały czas: <span data-product-link-eta>czas pojawi się po pierwszych produktach</span></small></div><div class="product-link-import-progress" role="progressbar" aria-label="Postęp importu" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${summary.percent}"><span data-product-link-progress-bar style="width:${summary.percent}%"></span></div></div><div class="product-link-import-current" data-product-link-current role="status" aria-live="polite" aria-atomic="true"><span>Gotowy do pracy</span><b>Każdy produkt zapisuję od razu po sprawdzeniu</b></div></div>
      <div class="orders-stat-grid product-link-import-stats">
        <button type="button" data-import-filter="all" aria-pressed="${productLinkImportStan.filter==="all"}" class="order-stat-card ${productLinkImportStan.filter==="all"?"active":""}" onclick="productLinkImportUstawFiltr('all')"><span>📚</span><b data-import-count="total">${summary.fileTotal}</b><small>wierszy pliku</small></button>
        <button type="button" data-import-filter="added" class="order-stat-card money ${productLinkImportStan.filter==="added"?"active":""}" onclick="productLinkImportUstawFiltr('added')"><span>✅</span><b data-import-count="added">${summary.added}</b><small>dodanych i zapisanych</small></button>
        <button type="button" data-import-filter="skipped_existing" class="order-stat-card ${productLinkImportStan.filter==="skipped_existing"?"active":""}" onclick="productLinkImportUstawFiltr('skipped_existing')"><span>↪️</span><b data-import-count="skipped">${summary.skipped_existing}</b><small>pominiętych duplikatów</small></button>
        <button type="button" data-import-filter="needs_review" class="order-stat-card ${productLinkImportStan.filter==="needs_review"?"active":""}" onclick="productLinkImportUstawFiltr('needs_review')"><span>🧐</span><b data-import-count="review">${summary.needs_review}</b><small>wymaga decyzji</small></button>
        <button type="button" data-import-filter="failed" class="order-stat-card hot ${productLinkImportStan.filter==="failed"?"active":""}" onclick="productLinkImportUstawFiltr('failed')"><span>⚠️</span><b data-import-count="failed">${summary.failed}</b><small>błędów do ponowienia</small></button>
        <button type="button" data-import-filter="file_rejected" class="order-stat-card hot ${productLinkImportStan.filter==="file_rejected"?"active":""}" onclick="productLinkImportUstawFiltr('file_rejected')"><span>🧾</span><b data-import-count="rejected">${summary.fileRejected}</b><small>odrzuconych przed kolejką</small></button>
      </div>
    </div>
    <div class="panel product-link-import-results" data-product-link-results>
      <div class="order-section-head"><div><span class="order-pro-label">Krok 3</span><h2>Wyniki i raport</h2><p>Pełna historia każdego wiersza. Duplikat nie tworzy nowej kartoteki i prowadzi bezpośrednio do istniejącego produktu.</p></div><div class="diag-actions"><button class="btn ghost" data-product-link-retry type="button" onclick="productLinkImportPonowBledy()" ${summary.failed?"":"hidden"}>↻ Ponów błędy</button><button class="btn ghost" data-product-link-report type="button" onclick="productLinkImportEksportujRaport()" ${productLinkImportWszystkieElementy().length?"":"disabled"}>⇩ Raport CSV</button></div></div>
      ${productLinkImportMasowaDecyzjaHTML(summary)}
      <div class="product-link-import-filters"><label><span>Szukaj</span><input type="search" placeholder="Nazwa, link, wiersz, ID lub błąd…" value="${esc(productLinkImportStan.query)}" oninput="productLinkImportSzukaj(this)"></label><label><span>Status</span><select data-product-link-status-filter onchange="productLinkImportUstawFiltr(this.value)">${[["all","Wszystkie statusy"],["queued","Oczekujące"],["processing","W trakcie"],["added","Dodane"],["skipped_existing","Duplikaty katalogu — pominięte"],["needs_review","Do decyzji"],["failed","Błędy pobierania"],["cancelled","Anulowane"],["file_rejected","Wszystkie odrzucone z pliku"],["invalid_file","Błędne wiersze pliku"],["duplicate_file","Duplikaty wewnątrz pliku"]].map(([value,label])=>`<option value="${value}" ${productLinkImportStan.filter===value?"selected":""}>${label}</option>`).join("")}</select></label><label><span>Na stronie</span><select onchange="productLinkImportUstawRozmiar(this.value)">${PRODUCT_LINK_IMPORT_PAGE_SIZES.map(value=>`<option value="${value}" ${productLinkImportStan.pageSize===value?"selected":""}>${value}</option>`).join("")}</select></label><div><span>Wyniki</span><b><span data-product-link-visible>${productLinkImportElementyPoFiltrze().length}</span> pozycji</b></div></div>
      <div class="product-link-import-table-wrap"><table class="log-table product-link-import-table"><thead><tr><th>Wiersz</th><th>Produkt i źródło</th><th>Status</th><th>Kartoteka</th><th>Informacja</th></tr></thead><tbody data-product-link-table-body>${productLinkImportWierszeHTML()}</tbody></table></div>
    </div>
  </section>`);
}

/* ── Edycja ceny bezpośrednio w tabeli ── */
let katalogJakoscStan={loading:false,error:"",report:null,filter:"all",query:"",lastAction:null};
function katalogJakoscStatusLabel(status){return status==="critical"?"Wymaga naprawy":status==="warning"?"Do uzupełnienia":"Gotowy";}
function katalogJakoscStatusIcon(status){return status==="critical"?"⛔":status==="warning"?"⚠️":"✅";}
function katalogJakoscPasuje(row){
  if(katalogJakoscStan.filter!=="all"&&row.severity!==katalogJakoscStan.filter)return false;
  const q=normalizujSzukanyTekst(katalogJakoscStan.query||"");if(!q)return true;
  return normalizujSzukanyTekst([row.id,row.name,row.externalId,row.ean,row.manufacturer,row.category,...(row.issues||[]).map(x=>x.label)].join(" ")).includes(q);
}
function katalogJakoscUstawFiltr(filter){katalogJakoscStan.filter=filter||"all";renderuj();}
function katalogJakoscSzukaj(input){
  katalogJakoscStan.query=input?.value||"";
  const q=normalizujSzukanyTekst(katalogJakoscStan.query),filter=katalogJakoscStan.filter;
  document.querySelectorAll("[data-quality-row]").forEach(row=>{const matches=(!q||normalizujSzukanyTekst(row.dataset.search||"").includes(q))&&(filter==="all"||row.dataset.status===filter);row.hidden=!matches;});
  const visible=[...document.querySelectorAll("[data-quality-row]")].filter(row=>!row.hidden).length;
  const counter=document.querySelector("[data-quality-visible]");if(counter)counter.textContent=String(visible);
}
async function katalogJakoscPobierz(fixSafe=false){
  if(katalogJakoscStan.loading)return;
  katalogJakoscStan.loading=true;katalogJakoscStan.error="";renderuj();
  try{
    const result=await chmura("catalog-quality-audit",{method:"POST",body:{fixSafe,quarantineOrphans:fixSafe,source:fixSafe?"manual-safe-fix":"manual-audit"},timeout:120000});
    katalogJakoscStan.report=result.report||null;
    katalogJakoscStan.lastAction={fixed:!!fixSafe,changes:(result.changes||[]).length,quarantined:(result.quarantined||[]).length,at:result.updated_at};
    if(fixSafe&&result.saved){
      const pull=await chmura("pull",{timeout:30000});
      if(pull.settings){nalozWspolneUstawienia(pull.settings);zapiszLS("artway_chmura_rev",pull.rev||0);zbudujProdukty();odswiezMenu();}
      toast(`✅ Poprawiono ${result.changes?.length||0} kart; uporządkowano ${result.quarantined?.length||0} osieroconych zapisów`);
    }else toast("Audyt jakości katalogu zakończony ✅");
  }catch(error){katalogJakoscStan.error=error.message||String(error);loguj("blad","Audyt jakości katalogu: "+katalogJakoscStan.error);}
  finally{katalogJakoscStan.loading=false;renderuj();}
}
function katalogJakoscEksportCSV(){
  const report=katalogJakoscStan.report;if(!report?.rows?.length){toast("Najpierw uruchom audyt");return;}
  const rows=[["ID","Nazwa","Ocena","Status","Problemy","EAN","Kod","Producent","Kategoria","Źródło"],...report.rows.map(row=>[row.id,row.name,row.score,katalogJakoscStatusLabel(row.severity),(row.issues||[]).map(x=>x.label).join(" | "),row.ean,row.externalId,row.manufacturer,row.category,row.sourceUrl])];
  pobierzPlik(`audyt-katalogu-${new Date().toISOString().slice(0,10)}.csv`,"\uFEFF"+rows.map(row=>row.map(csvPole).join(";")).join("\n"),"text/csv");
}
function widokAdminJakoscKatalogu(){
  const report=katalogJakoscStan.report,summary=report?.summary||{total:0,ready:0,warning:0,critical:0,averageScore:0,duplicateGroups:0,orphanEdits:0,safeFixes:0};
  if(!report&&!katalogJakoscStan.loading&&!katalogJakoscStan.error)setTimeout(()=>katalogJakoscPobierz(false),0);
  const rows=(report?.rows||[]).filter(katalogJakoscPasuje),action=katalogJakoscStan.lastAction;
  return asortymentSzkielet("jakosc",`<div class="panel catalog-quality-page">
    <header class="catalog-quality-hero"><div><span class="order-pro-label">Stała kontrola danych sprzedażowych</span><h1>🧪 Jakość katalogu</h1><p>Jedna kontrola dla sklepu, Allegro, Google, SEO i Agenta AI. System wykrywa braki, nieprawidłowe identyfikatory, duplikaty, powtarzające się opisy oraz osierocone dane synchronizacji.</p><small>Automatyczny audyt działa codziennie. Bezpieczna korekta porządkuje wyłącznie dane wynikające z istniejących pól — nigdy nie wymyśla ceny, EAN-u ani informacji o produkcie.</small></div><div class="catalog-quality-actions"><button class="btn ghost" onclick="katalogJakoscPobierz(false)" ${katalogJakoscStan.loading?"disabled":""}>↻ Uruchom audyt</button><button class="btn" onclick="katalogJakoscPobierz(true)" ${katalogJakoscStan.loading||!report?"disabled":""}>✨ Zastosuj bezpieczne poprawki</button><button class="btn ghost" onclick="katalogJakoscEksportCSV()" ${report?"":"disabled"}>⇩ Raport CSV</button></div></header>
    ${katalogJakoscStan.loading?`<div class="catalog-quality-progress" role="status"><span class="spinner"></span><div><b>${report?"Aktualizuję kontrolę katalogu…":"Analizuję wszystkie aktywne produkty…"}</b><small>Sprawdzam dane identyfikacyjne, opisy, zdjęcia, źródła, SEO i powiązania.</small></div></div>`:""}
    ${katalogJakoscStan.error?`<div class="form-err" role="alert"><b>Audyt nie został wykonany.</b><br>${esc(katalogJakoscStan.error)} <button class="btn ghost" onclick="katalogJakoscPobierz(false)">Spróbuj ponownie</button></div>`:""}
    ${action?`<div class="catalog-quality-last ${action.fixed?"fixed":""}"><b>${action.fixed?"✅ Zakończono bezpieczne porządkowanie":"✅ Audyt zakończony"}</b><span>${action.fixed?`Zmieniono ${action.changes} kart i odseparowano ${action.quarantined} osieroconych zapisów.`:`Wynik zapisano ${new Date(action.at||Date.now()).toLocaleString("pl-PL")}.`}</span></div>`:""}
    <div class="orders-stat-grid catalog-quality-stats">
      <button class="order-stat-card stat-filter ${katalogJakoscStan.filter==="all"?"active":""}" onclick="katalogJakoscUstawFiltr('all')"><span>📚</span><b>${summary.total}</b><small>aktywnych produktów</small></button>
      <button class="order-stat-card stat-filter ${summary.critical?"hot":""} ${katalogJakoscStan.filter==="critical"?"active":""}" onclick="katalogJakoscUstawFiltr('critical')"><span>⛔</span><b>${summary.critical}</b><small>wymaga naprawy</small></button>
      <button class="order-stat-card stat-filter ${katalogJakoscStan.filter==="warning"?"active":""}" onclick="katalogJakoscUstawFiltr('warning')"><span>⚠️</span><b>${summary.warning}</b><small>do uzupełnienia</small></button>
      <button class="order-stat-card stat-filter money ${katalogJakoscStan.filter==="ready"?"active":""}" onclick="katalogJakoscUstawFiltr('ready')"><span>✅</span><b>${summary.ready}</b><small>gotowych kart</small></button>
      <div class="order-stat-card"><span>🎯</span><b>${summary.averageScore}%</b><small>średnia jakość</small></div>
    </div>
    ${summary.orphanEdits?`<div class="catalog-quality-warning"><div><b>🧹 ${summary.orphanEdits} osierocone ${summary.orphanEdits===1?"dane edycji":"zapisy edycji"}</b><span>Nie są produktami i nie trafią już do sitemap, Google, SEO, monitoringu ani zadań Agenta. „Bezpieczne poprawki” przeniosą ich kopię do prywatnego archiwum audytu i usuną z katalogu roboczego.</span></div></div>`:""}
    ${summary.duplicateGroups?`<div class="catalog-quality-warning"><div><b>🧬 ${summary.duplicateGroups} grup potencjalnych duplikatów</b><span>System niczego nie usuwa automatycznie. Otwórz kartę produktu i zdecyduj, która pozycja ma pozostać.</span></div><a class="btn ghost" href="#/admin/asortyment/produkty" onclick="filtrStatusuProduktow='duplikaty'">Sprawdź duplikaty</a></div>`:""}
    ${report?`<section class="catalog-quality-toolbar"><label><span>Szukaj w raporcie</span><input placeholder="Nazwa, ID, EAN, kod, producent, kategoria lub problem…" value="${esc(katalogJakoscStan.query)}" oninput="katalogJakoscSzukaj(this)" autocomplete="off"></label><span>Widoczne: <b data-quality-visible>${rows.length}</b> z ${summary.total}</span><span>Możliwe bezpieczne poprawki: <b>${summary.safeFixes}</b></span></section>
    <div class="catalog-quality-table-wrap"><table class="log-table catalog-quality-table"><thead><tr><th>Produkt</th><th>Identyfikatory</th><th>Jakość</th><th>Wykryte problemy</th><th>Źródło</th><th>Akcje</th></tr></thead><tbody>${rows.map(row=>`<tr data-quality-row data-status="${esc(row.severity)}" data-search="${esc([row.id,row.name,row.externalId,row.ean,row.manufacturer,row.category,...(row.issues||[]).map(x=>x.label)].join(" "))}"><td><div class="catalog-quality-product">${row.image?`<img src="${esc(row.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'📦'}))">`:`<span>📦</span>`}<div><b>${esc(row.name)}</b><small>ID ${esc(row.id)} • ${esc(row.category||"bez kategorii")}</small><em>${esc(row.manufacturer||"producent nieuzupełniony")}</em></div></div></td><td><small>EAN/GTIN</small><b>${esc(row.ean||"—")}</b><small>Kod / EXTERNAL_ID</small><b>${esc(row.externalId||"—")}</b></td><td><div class="catalog-quality-score ${esc(row.severity)}"><b>${row.score}%</b><span>${katalogJakoscStatusIcon(row.severity)} ${katalogJakoscStatusLabel(row.severity)}</span></div></td><td><div class="catalog-quality-issues">${(row.issues||[]).map(issue=>`<span class="${esc(issue.severity)}">${esc(issue.label)}</span>`).join("")||`<span class="ready">Komplet podstawowych danych</span>`}${Object.keys(row.safePatch||{}).length?`<small>✨ Bezpieczna korekta: ${Object.keys(row.safePatch).map(field=>esc(field)).join(", ")}</small>`:""}</div></td><td>${row.sourceUrl?`<a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">Otwórz źródło ↗</a>`:"<span class='muted'>Brak linku</span>"}${row.allegroOfferId?`<a href="https://allegro.pl/oferta/${encodeURIComponent(row.allegroOfferId)}" target="_blank" rel="noopener">Oferta Allegro ↗</a>`:""}</td><td><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(row.id)}">✏️ Uzupełnij</a></td></tr>`).join("")||`<tr><td colspan="6">Brak produktów w wybranym filtrze.</td></tr>`}</tbody></table></div>`:`<div class="backend-note">Raport pojawi się po zakończeniu analizy.</div>`}
    <div class="catalog-quality-rules"><h2>Co system poprawia sam, a czego nie zgaduje</h2><div><article><b>✅ Automatycznie i bezpiecznie</b><p>Porządkuje spacje i linki, uzupełnia zgodne pola EAN/GTIN, usuwa identyczne powtórzenia akapitów, tworzy krótki opis z istniejącego opisu, uzupełnia SEO oraz producenta tylko z jednoznacznego źródła.</p></article><article><b>🔒 Zawsze wymaga faktów</b><p>Cena, kod EAN, zdjęcia, kategoria, parametry, dostępność i brakujący pełny opis nie są wymyślane. Trafiają do raportu oraz zadań Agenta do sprawdzenia w źródle producenta.</p></article></div></div>
  </div>`);
}

function ustawCene(id, wartosc){
  const cena = parseFloat(String(wartosc).replace(",","."));
  if(!(cena>0)){ toast("⚠️ Nieprawidłowa cena"); renderuj(); return; }
  const nowa = +cena.toFixed(2);
  const i = produktyDodane.findIndex(x=>x.id===id);
  if(i>=0){
    produktyDodane[i].cena = nowa;
    if(produktyDodane[i].staraCena && produktyDodane[i].staraCena<=nowa) delete produktyDodane[i].staraCena;
    zapiszLS("artway_produkty_dodane", produktyDodane);
  }else{
    const baza = pobierzProduktAdmin(id) || {};
    const edycja = {...(produktyEdytowane[id]||{}), cena:nowa};
    if(baza.staraCena && baza.staraCena<=nowa) edycja.staraCena = undefined;
    produktyEdytowane = {...produktyEdytowane, [id]:edycja};
    zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  }
  zbudujProdukty();
  loguj("info",`Zmieniono cenę produktu ${id} → ${zl(nowa)}`);
  toast("Cena zapisana ✅"); renderuj();
}
/* ── Akcje masowe na produktach ── */
let zaznaczoneProdukty = new Set();
let asortymentWynikiIds=[],asortymentStronaIds=[];
function przelaczZaznProd(id){ zaznaczoneProdukty.has(id) ? zaznaczoneProdukty.delete(id) : zaznaczoneProdukty.add(id); asortymentOdswiezStanZaznaczenia(); }
function zaznaczWidoczneProd(chk, ids){
  ids.forEach(id => chk.checked ? zaznaczoneProdukty.add(id) : zaznaczoneProdukty.delete(id));
  asortymentOdswiezStanZaznaczenia();
}
function ustawZaznaczenieProduktow(ids,zaznacz=true){
  for(const raw of Array.isArray(ids)?ids:[]){const id=Number(raw);if(!Number.isFinite(id))continue;zaznacz?zaznaczoneProdukty.add(id):zaznaczoneProdukty.delete(id);}
  asortymentOdswiezStanZaznaczenia();
}
function wyczyscZaznaczenieProduktow(){zaznaczoneProdukty.clear();asortymentOdswiezStanZaznaczenia();}
function asortymentZaznaczZakres(zakres){ustawZaznaczenieProduktow(zakres==="strona"?asortymentStronaIds:asortymentWynikiIds,true);}
function asortymentEksportuj(zakres){
  if(zakres==="zaznaczone")return eksportujProduktyPoIdCSV([...zaznaczoneProdukty],"produkty-zaznaczone.csv");
  eksportujProduktyPoIdCSV(asortymentWynikiIds,"produkty-filtrowane.csv");
}
function usunZaznaczoneProd(){
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!confirm(`Usunąć ${zaznaczoneProdukty.size} zaznaczonych produktów?`)) return;
  for(const id of [...zaznaczoneProdukty]){
    const p = produktyDodane.find(x=>x.id===id);
    if(p){
      if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
      produktyDodane = produktyDodane.filter(x=>x.id!==id);
      oznaczProduktWKoszu(id,"wlasny");
    }else if(!produktyDefinitywne.includes(id)){
      if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
      oznaczProduktWKoszu(id,"bazowy");
    }
  }
  zapiszLS("artway_kosz_dodane", koszDodanych);
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  loguj("info",`Masowo usunięto ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); odswiezMenu(); toast("Usunięto zaznaczone 🗑️"); renderuj();
}
function zmienCenyZaznaczonych(){
  const wartosc = parseFloat(String($("procentCen")?.value||"").replace(",","."));
  const tryb=String($("trybCenProduktow")?.value||"percent");
  const kanal=String($("kanalCenProduktow")?.value||"sklep");
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!Number.isFinite(wartosc)||wartosc===0){ toast("⚠️ Podaj wartość zmiany, np. 10 lub -5"); return; }
  if(tryb==="percent"&&wartosc<=-100){ toast("⚠️ Obniżka procentowa musi być większa niż -100%"); return; }
  if(tryb==="fixed"&&wartosc<=0){ toast("⚠️ Cena docelowa musi być większa od zera"); return; }
  for(const id of [...zaznaczoneProdukty]){
    const p = pobierzProduktAdmin(id); if(!p) continue;
    const wylicz=base=>Math.max(0.01, +(tryb==="percent"?kwotaNum(base)*(1+wartosc/100):tryb==="amount"?kwotaNum(base)+wartosc:wartosc).toFixed(2)),patch={};
    if(kanal==="sklep"||kanal==="oba")patch.cena=wylicz(p.cena);
    if(kanal==="allegro"||kanal==="oba")patch.cenaAllegro=wylicz(p.cenaAllegro||p.cena);
    const i = produktyDodane.findIndex(x=>x.id===id);
    if(i>=0){ Object.assign(produktyDodane[i],patch);if(patch.cena&&produktyDodane[i].staraCena&&produktyDodane[i].staraCena<=patch.cena)delete produktyDodane[i].staraCena; }
    else produktyEdytowane = {...produktyEdytowane, [id]:{...(produktyEdytowane[id]||{}),...patch}};
  }
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  const opis=tryb==="percent"?`${wartosc>0?"+":""}${wartosc}%`:tryb==="amount"?`${wartosc>0?"+":""}${zl(wartosc)}`:`na ${zl(wartosc)}`;
  const kanalLabel=kanal==="oba"?"sklepu i Allegro":kanal==="allegro"?"Allegro":"sklepu";
  loguj("info",`Masowa zmiana cen ${kanalLabel} ${opis} dla ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); toast(`Ceny ${kanalLabel} zmienione ${opis} ✅`); renderuj();
}
function usunProduktAdmin(id){
  if(produktyDodane.some(p=>p.id===id)){
    usunProdukt(id);
    return;
  }
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  oznaczProduktWKoszu(id,"bazowy");
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Przeniesiono do kosza na 30 dni produkt bazowy id="+id);
  toast("Produkt w koszu przez 30 dni 🗑️");
  renderuj();
}
function przywrocProdukt(id){
  if(produktyDefinitywne.includes(id)){ toast("Ten produkt został już usunięty definitywnie"); return; }
  produktyUkryte = produktyUkryte.filter(x=>x!==id);
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony ↩️"); renderuj();
}
function resetujEdycjeProduktu(id){
  delete produktyEdytowane[id];
  zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  zbudujProdukty(); odswiezMenu();
  toast("Przywrócono dane z products.json");
  location.hash="#/admin/produkty";
}
function przelaczWidocznosc(id){
  produktyUkryte = produktyUkryte.includes(id) ? produktyUkryte.filter(x=>x!==id) : [...produktyUkryte, id];
  zapiszLS("artway_produkty_ukryte", produktyUkryte); zbudujProdukty();
  toast(produktyUkryte.includes(id)?"Produkt ukryty 🙈":"Produkt widoczny 👁️"); renderuj();
}

/* ── Eksporty (CSV dla Excela, JSON dla hostingu) ── */
function pobierzPlik(nazwa, tresc, typ){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([tresc], {type:(typ||"text/plain")+";charset=utf-8"}));
  a.download = nazwa; a.click(); URL.revokeObjectURL(a.href);
}
function osadzUstawieniaWIndexie(html){
  const bezpieczne=JSON.stringify(ustawienia,null,2).replace(/</g,"\\u003c");
  const blok=`/* PUBLIC_SETTINGS_START */\nconst USTAWIENIA_PUBLICZNE = ${bezpieczne};\n/* PUBLIC_SETTINGS_END */`;
  const wzor=/\/\* PUBLIC_SETTINGS_START \*\/[\s\S]*?\/\* PUBLIC_SETTINGS_END \*\//;
  if(!wzor.test(html))throw new Error("Nie znaleziono znacznika ustawień w index.html");
  return html.replace(wzor,blok);
}
async function eksportujIndexHTML(){
  try{
    const r=await fetch("/index.html",{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);
    const html=osadzUstawieniaWIndexie(await r.text());
    pobierzPlik("index.html",html,"text/html");
    localStorage.setItem("artway_ustawienia_export_hash",prostyHash(JSON.stringify(ustawienia)));
    loguj("info","Wyeksportowano index.html z publicznymi ustawieniami panelu");
    toast("Pobrano index.html — wgraj go na hosting ✅");
  }catch(e){loguj("blad","Eksport index.html: "+e.message);toast("⚠️ Nie udało się przygotować index.html");}
}
const csvPole = v => '"' + String(v??"").replace(/"/g,'""') + '"';
function eksportujZamowienia(wybrane=null,nazwa="zamowienia.csv"){
  const z = Array.isArray(wybrane)?wybrane:pobierzZamowienia();
  const csv = [["nr","data","status","klient","produkty_zl","rabat_zl","dostawa_zl","paczka_weekend_zl","platnosc_oplata_zl","razem_zl","dostawa","platnosc","adres","pozycje"].join(";"),
    ...z.map(x=>{const k=kosztyZamowienia(x); return [x.nr,x.data,x.status,x.email||"gość",k.produkty,k.rabat,k.dostawa,k.paczkaWeekend,k.platnosc,k.razem,x.dostawa||"",x.platnosc||"",x.adres||"",(x.pozycje||[]).join(" | ")].map(v=>typeof v==="number"?String(v.toFixed(2)).replace(".",","):v).map(csvPole).join(";");})].join("\n");
  pobierzPlik(nazwa,"﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano zamówienia ("+z.length+")");
}
function eksportujKlientow(wybrani=null,nazwa="klienci.csv"){
  const k = Array.isArray(wybrani)?wybrani:pobierzUzytkownikow();
  const csv = [["imie_nazwisko","email","rola","data_rejestracji"].join(";"),
    ...k.map(x=>[x.imie,x.email,kontoMaRoleAdmin(x.email)?"administrator":"klient",new Date(x.data).toLocaleDateString("pl-PL")].map(csvPole).join(";"))].join("\n");
  pobierzPlik(nazwa,"﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano klientów ("+k.length+")");
}
// InPost „nadanie z pliku": eksport zamówień do CSV/TXT do wgrania w InPost Managerze
// (manager.paczkomaty.pl → Wyślij przesyłki → IMPORT Z PLIKU). Działa dla paczkomatu i kuriera —
// obejście/awaryjne nadawanie do czasu umowy kurierskiej. Format zgodny ze wzorem InPost.
let zaznaczoneNadania = new Set();
function przelaczZaznaczenieNadania(nr){ nr=String(nr); if(zaznaczoneNadania.has(nr)) zaznaczoneNadania.delete(nr); else zaznaczoneNadania.add(nr); renderuj(); }
function zaznaczWszystkieNadania(zazn){ listaWysylekPoFiltrze().forEach(z=>zazn?zaznaczoneNadania.add(String(z.nr)):zaznaczoneNadania.delete(String(z.nr))); renderuj(); }
// czy zamówienie idzie do paczkomatu (InPost)
function paczkomatoweInpost(z){ const id=String(z?.dostawaId||"").toLowerCase(); if(id==="kurier"||id==="kurier_inpost") return false; if(id==="paczkomat") return true; return !!(z?.paczkomat||z?.wysylka?.punktKod); }
// czy zlecenie ma komplet danych do nadania w InPost (żeby import z pliku nie odrzucił)
function gotoweDoNadaniaInpost(z){
  const k=z.klient||{}, a=z.adresDostawy||{};
  if(String(z?.dostawaId||"").toLowerCase()==="odbior") return {ok:false, powod:"odbiór osobisty"};
  const tel=String(k.telefon||z.telefon||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"");
  if(!/@/.test(String(z.email||k.email||""))) return {ok:false, powod:"brak e-mail"};
  if(tel.length<9) return {ok:false, powod:"brak/zły telefon"};
  if(paczkomatoweInpost(z)){ if(!(z.paczkomat||z.wysylka?.punktKod)) return {ok:false, powod:"brak paczkomatu"}; }
  else { if(!a.ulica||!a.nrDomu) return {ok:false, powod:"brak adresu"}; if(!/^\d{2}-\d{3}$/.test(String(a.kod||""))) return {ok:false, powod:"zły kod pocztowy"}; if(!a.miasto) return {ok:false, powod:"brak miasta"}; }
  return {ok:true, paczk:paczkomatoweInpost(z)};
}
function zaznaczGotoweNadania(){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(gotoweDoNadaniaInpost(z).ok){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(n?`Zaznaczono ${n} gotowych do nadania`:"Brak gotowych zleceń w tym filtrze"); renderuj(); }
function zaznaczTypNadania(typ){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(String(z?.dostawaId||"").toLowerCase()==="odbior") return; const p=paczkomatoweInpost(z); if((typ==="paczkomat"&&p)||(typ==="kurier"&&!p)){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(`Zaznaczono ${n} (${typ})`); renderuj(); }
// nry (opcjonalnie) = tablica numerów zamówień do eksportu (pojedyncze zlecenie / zaznaczone). Bez nry: zaznaczone albo cały filtr.
function eksportNadaniaInpostCSV(nry, format="txt"){
  const tryb=String(format||"txt").toLowerCase();
  const rozszerzony=tryb==="extended"||tryb==="rozszerzony";
  const kolumnowy=tryb==="csv"||tryb==="kolumny"||tryb==="columns";
  const tabulator=tryb==="tab"||tryb==="tsv"||tryb==="inpost";
  const sep=tabulator ? "\t" : (kolumnowy ? "," : ";");
  const ext=kolumnowy||rozszerzony ? "csv" : "txt";
  const mime=ext==="csv" ? "text/csv" : "text/plain";
  const czysc = v => String(v==null?"":v).replace(/[\t;\r\n]+/g," ").replace(/\s+/g," ").trim();
  const telCyfry = t => String(t||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"").slice(-9);
  const telInpost = t => { const d=telCyfry(t); return d.length===9 ? "+48"+d : ""; };
  const kwota = v => { const n=Number(String(v??"").replace(",",".").replace(/[^0-9.]/g,"")); return Number.isFinite(n)&&n>0 ? n.toFixed(2) : ""; };
  const rozmiarInpost = z => { const g=String(z?.wysylka?.gabaryt||"").toLowerCase(); return g==="large"?"C":g==="medium"?"B":"A"; };
  const pole = v => {
    const s=czysc(v);
    return kolumnowy ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const jawne = Array.isArray(nry) && nry.length;
  let bazaZ;
  if(jawne){ const zb=new Set(nry.map(String)); bazaZ = pobierzZamowienia().filter(z=>zb.has(String(z.nr))); }
  else if(zaznaczoneNadania.size){ bazaZ = pobierzZamowienia().filter(z=>zaznaczoneNadania.has(String(z.nr))); }
  else { bazaZ = listaWysylekPoFiltrze(); }
  const lista = bazaZ.filter(z=>{
    if(String(z?.dostawaId||"").toLowerCase()==="odbior") return false;
    if(!jawne && ["dostarczona","anulowana","zwrot"].includes(etapWysylki(z))) return false;
    return true;
  }).slice(0,100);
  if(!lista.length){ toast("Brak zamówień do nadania (sprawdź zaznaczenie lub filtr)"); return; }
  const polaPodstawowe=["e-mail","telefon","rozmiar","paczkomat","numer_referencyjny","dodatkowa_ochrona","za_pobraniem","imie_i_nazwisko","nazwa_firmy","ulica","kod_pocztowy","miasto","typ_przesylki","sposob_nadania","punkt_nadania","paczka_w_weekend"];
  const polaRozszerzone=["uwagi","produkty","kwota_zamowienia","metoda_platnosci","sposob_dostawy","gabaryt_sklepu","waga_kg","dlugosc_cm","szerokosc_cm","wysokosc_cm","telefon_9_cyfr"];
  const pola=rozszerzony?[...polaPodstawowe,...polaRozszerzone]:polaPodstawowe;
  const wiersze=lista.map(z=>{
    const k=z.klient||{}, a=z.adresDostawy||{}, w=z.wysylka||{};
    const paczk=paczkomatoweInpost(z);
    const ulica = czysc(`${a.ulica||""} ${a.nrDomu||""}${a.nrLokalu?"/"+a.nrLokalu:""}`.trim());
    const pobranie = kwota(kwotaPobraniaZamowienia(z,w));
    const ochrona = kwota(w.ochrona || "");
    const sposob=inpostSposobNadania(z,w);
    const punktNadania=String(w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
    const produktyTxt = Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
      ? z.pozycjeDane.map(p=>`${p.nazwa||""}${p.sku?` SKU:${p.sku}`:""} x${p.ilosc||1}`).join(" | ")
      : (Array.isArray(z.pozycje)?z.pozycje.join(" | "):"");
    const podstawowe=[
      z.email||k.email,
      telInpost(k.telefon||z.telefon),
      rozmiarInpost(z),
      paczk ? String(z.paczkomat||w.punktKod||"").toUpperCase() : "",
      z.nr,
      ochrona,
      pobranie,
      [k.imie,k.nazwisko].filter(Boolean).join(" "),
      k.firma,
      ulica,
      a.kod,
      a.miasto,
      paczk ? "paczkomat" : "kurier",
      inpostSposobNadaniaLabel(sposob),
      punktNadania,
      (w.paczkaWeekend || z.paczkaWeekend) ? "TAK" : "NIE"
    ];
    const extra=[
      z.uwagi,
      produktyTxt,
      kwota(z.razem),
      z.platnosc,
      z.dostawa,
      w.gabaryt||"small",
      w.waga,
      w.dlugosc,
      w.szerokosc,
      w.wysokosc,
      telCyfry(k.telefon||z.telefon)
    ];
    return (rozszerzony?[...podstawowe,...extra]:podstawowe).map(pole).join(sep);
  });
  const tresc=[pola.map(pole).join(sep),...wiersze].join("\r\n");
  const nazwaTrybu=rozszerzony?"rozszerzony":(tabulator?"naglowki-tabulator":(kolumnowy?"naglowki":tryb));
  pobierzPlik(`inpost-nadania-${nazwaTrybu}-${new Date().toISOString().slice(0,10)}.${ext}`, tresc, mime);
  const npaczk=lista.filter(z=>paczkomatoweInpost(z)).length, nbrak=lista.filter(z=>!gotoweDoNadaniaInpost(z).ok).length;
  loguj("info",`Eksport nadań InPost ${nazwaTrybu}: ${lista.length} przesyłek (${npaczk} paczkomat, ${lista.length-npaczk} kurier)`);
  toast(tabulator
    ? `📄 TXT InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK, separator Tabulator${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
    : (kolumnowy
      ? `📄 CSV InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK i separator przecinek${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
      : `📄 Plik InPost ${nazwaTrybu.toUpperCase()}: ${lista.length} przesyłek — dla TXT ustaw w InPost separator średnik${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`));
}
let podgladImportuProduktow=null, ostatniRaportImportu=null;
const POLA_CSV_PRODUKTU=["id","nazwa","kategoria","cena","cena_allegro","cena_zakupu","prowizja_allegro","prowizja_allegro_procent","oplaty_allegro_cykliczne","koszt_pakowania","koszt_dodatkowy_sklepu","platnosc_sklepu_procent","koszt_dodatkowy_allegro","doplata_wysylki_allegro","reklama_allegro_procent","vat","stara_cena","stan","sku","gtin","external_id","mpn","marka","producent","opis_krotki","opis","badge","ikona","zdjecie","zdjecie2","zdjecie3","zdjecie4","zdjecie5","zdjecie6","zdjecie7","zdjecie8","zdjecie9","zdjecie10","zdjecie11","zdjecie12","zdjecie13","zdjecie14","zdjecie15","zdjecie16","warianty","kolor","kolor_produktu","rozmiar","material"];
const POLA_OVF_PRODUKTU=["GTIN","EXTERNAL_ID","NAME","STOCK","PRICE","MPN","DESCRIPTION","IMAGE1","IMAGE2","IMAGE3","IMAGE4","IMAGE5","IMAGE6","IMAGE7","IMAGE8","IMAGE9","IMAGE10","IMAGE11","IMAGE12","IMAGE13","IMAGE14","IMAGE15","IMAGE16","CATEGORY","BRAND","MANUFACTURER","COLOR","SIZE","MATERIAL"];
function normalizujNaglowekCSV(v){
  return normalizujSzukanyTekst(v).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}
function kanonicznePoleProduktu(naglowek){
  const h=normalizujNaglowekCSV(naglowek);
  const aliasy={
    id:["id","product_id","produkt_id","item_id","id_produktu"],
    nazwa:["nazwa","name","product_name","nazwa_produktu","tytul","title","product_title"],
    kategoria:["kategoria","category","katalog","catalog","category_path","categorypath","breadcrumb","category_tree","category_name","categories","sciezka_kategorii"],
    cena:["cena","price","cena_zl","sale_price","gross_price","net_price","price_gross","price_net","retail_price"],
    cenaAllegro:["cena_allegro","allegro_price","price_allegro"],
    cenaZakupu:["cena_zakupu","purchase_price","cost_price","buy_price"],
    allegroCommissionAmount:["prowizja_allegro","allegro_commission","commission_amount"],
    allegroCommissionRate:["prowizja_allegro_procent","allegro_commission_rate","commission_rate"],
    allegroRecurringFees:["oplaty_allegro_cykliczne","allegro_recurring_fees","listing_fees"],
    kosztPakowania:["koszt_pakowania","packaging_cost"],
    sklepAdditionalCost:["koszt_dodatkowy_sklepu","store_additional_cost"],
    sklepPaymentPercent:["platnosc_sklepu_procent","store_payment_percent"],
    allegroAdditionalCost:["koszt_dodatkowy_allegro","allegro_additional_cost"],
    allegroShippingSubsidy:["doplata_wysylki_allegro","allegro_shipping_subsidy"],
    allegroAdsPercent:["reklama_allegro_procent","allegro_ads_percent"],
    vatRate:["vat","vat_rate","stawka_vat"],
    staraCena:["stara_cena","old_price","regular_price","cena_regularna","oldprice","rrp","msrp"],
    stan:["stan","stock","quantity","ilosc","stan_magazynowy","available","availability","qty"],
    sku:["sku","kod","kod_produktu","symbol","seller_sku","item_sku","offer_sku","symbol_produktu"],
    gtin:["gtin","ean","ean13","barcode","kod_ean"],
    externalId:["external_id","externalid","kod_zewnetrzny","supplier_id","vendor_id","ext_id","supplier_sku"],
    mpn:["mpn","manufacturer_part_number","kod_producenta"],
    marka:["brand","marka","brand_name"],
    producent:["producent","manufacturer","manufacturer_name","producer","producer_name"],
    opisKrotki:["opis_krotki","krotki_opis","krótki_opis","short_description","short_desc","description_short","summary","lead"],
    opis:["opis","description","desc","long_description","description_html","full_description"],
    badge:["badge","etykieta","label"],
    ikona:["ikona","icon","emoji"],
    zdjecie:["zdjecie","image","image1","image_1","image_url","url_zdjecia","main_image","image_url_1","photo","photo1","picture","picture1"],
    warianty:["warianty","variants","options"],
    kolor:["kolor","kolor_tla","background","background_color","card_color"],
    kolorProduktu:["color","kolor_produktu","product_color","barwa"],
    rozmiar:["size","rozmiar","wymiar","wymiary","dimensions"],
    material:["material","material_produktu","tworzywo"]
  };
  for(let i=2;i<=16;i++) aliasy["zdjecie"+i]=["zdjecie"+i,"image"+i,"image_"+i,"image"+String(i).padStart(2,"0"),String("image_"+String(i).padStart(2,"0")),"image_url_"+i,"photo"+i,"picture"+i,"url_zdjecia"+i];
  return Object.keys(aliasy).find(k=>aliasy[k].includes(h))||null;
}
function liczbaImportu(v){
  let s=String(v??"").trim().replace(/\s/g,"").replace(/[^\d,.\-]/g,"");
  if(!s)return null;
  if(s.includes(",")&&s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else s=s.replace(",",".");
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function wykryjSeparatorCSV(tekst){
  const probka=String(tekst||"").split(/\r?\n/).slice(0,5).join("\n");
  const liczniki={";":0,",":0,"\t":0};let cytat=false;
  for(let i=0;i<probka.length;i++){
    if(probka[i]==='"'&&probka[i+1]==='"'){i++;continue;}
    if(probka[i]==='"'){cytat=!cytat;continue;}
    if(!cytat&&Object.prototype.hasOwnProperty.call(liczniki,probka[i]))liczniki[probka[i]]++;
  }
  return Object.entries(liczniki).sort((a,b)=>b[1]-a[1])[0][0];
}
function parsujCSVProduktow(tekst){
  tekst=String(tekst||"").replace(/^\uFEFF/,"");
  const sep=wykryjSeparatorCSV(tekst),wiersze=[];let wiersz=[],pole="",cytat=false;
  for(let i=0;i<tekst.length;i++){
    const c=tekst[i];
    if(c==='"'&&cytat&&tekst[i+1]==='"'){pole+='"';i++;continue;}
    if(c==='"'){cytat=!cytat;continue;}
    if(c===sep&&!cytat){wiersz.push(pole);pole="";continue;}
    if((c==="\n"||c==="\r")&&!cytat){
      if(c==="\r"&&tekst[i+1]==="\n")i++;
      wiersz.push(pole);pole="";
      if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
      wiersz=[];continue;
    }
    pole+=c;
  }
  wiersz.push(pole);if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
  if(wiersze.length<2)throw new Error("CSV nie zawiera wierszy produktów");
  const naglowki=wiersze.shift().map(kanonicznePoleProduktu);
  if(!naglowki.includes("nazwa")||!naglowki.includes("cena"))throw new Error("CSV musi zawierać co najmniej kolumny: nazwa i cena");
  return wiersze.map(r=>{const o={};naglowki.forEach((k,i)=>{if(k)o[k]=r[i]??"";});return o;});
}
function tablicaWartosci(v){
  if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);
  return String(v||"").split(/\s*[|,]\s*/).map(x=>x.trim()).filter(Boolean);
}
function czyKolorKarty(v){
  const s=String(v||"").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)||/^rgba?\(/i.test(s)||/^hsla?\(/i.test(s);
}
function rozbijSciezkeKategoriiImportu(v){
  const tekst=String(v||"").trim();
  if(!tekst)return {pelna:"",grupa:"",kategoria:"",poziomy:[]};
  const czesci=tekst.split(/\s*(?:\/|\\|>|»|›|\||::)\s*/).map(x=>x.trim()).filter(Boolean);
  if(czesci.length<=1)return {pelna:tekst,grupa:"",kategoria:tekst,poziomy:[tekst]};
  return {pelna:tekst,grupa:czesci.slice(0,-1).join(" / "),kategoria:czesci.at(-1),poziomy:czesci};
}
function normalizujProduktImportu(r,nr){
  const pobierz=(...nazwy)=>{for(const n of nazwy)if(r?.[n]!==undefined&&r[n]!==null)return r[n];return "";};
  const bledy=[],ostrzezenia=[];
  const nazwa=String(pobierz("nazwa","name","product_name")).trim();
  const kategoriaInfo=rozbijSciezkeKategoriiImportu(pobierz("kategoria","category","katalog"));
  const kategoria=kategoriaInfo.kategoria;
  const cena=liczbaImportu(pobierz("cena","price","sale_price"));
  const idRaw=pobierz("id","product_id"),id=idRaw===""||idRaw===null?null:Number(idRaw);
  if(!nazwa)bledy.push("brak nazwy");
  if(!kategoria)bledy.push("brak kategorii");
  if(cena===null||cena<0)bledy.push("cena musi być liczbą 0 lub większą");
  if(cena===0)ostrzezenia.push("cena 0,00 — produkt zostanie zaimportowany, ale będzie zablokowany do sprzedaży do czasu uzupełnienia ceny");
  if(id!==null&&(!Number.isInteger(id)||id<=0))bledy.push("ID musi być dodatnią liczbą całkowitą");
  const stanRaw=pobierz("stan","stock","quantity","ilosc"),stan=stanRaw===""||stanRaw===null?null:liczbaImportu(stanRaw);
  if(stan!==null&&(!Number.isInteger(stan)||stan<0))bledy.push("stan musi być liczbą całkowitą 0 lub większą");
  const stara=liczbaImportu(pobierz("staraCena","stara_cena","old_price","regular_price"));
  if(stara!==null&&cena!==null&&stara<=cena)ostrzezenia.push("stara cena pominięta, bo nie jest wyższa od ceny");
  const galeria=Array.isArray(r?.zdjecia)?r.zdjecia:Array.isArray(r?.images)?r.images:null;
  const zdjecia=galeria?galeria.map(String).filter(Boolean):Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(k=>String(pobierz(k)).trim()).filter(Boolean);
  const p={id,nazwa,kategoria,cena:cena===null?0:+cena.toFixed(2)};
  for(const pole of ["cenaAllegro","cenaZakupu","allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent","vatRate"]){const value=liczbaImportu(pobierz(pole));if(value!==null&&value>=0)p[pole]=+value.toFixed(pole.includes("Rate")||pole.includes("Percent")?4:2);}
  if(p.cenaZakupu!==undefined)p.cenaZakupuPrywatna=true;
  if(p.allegroShippingSubsidy===undefined)p.allegroShippingSubsidy=ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI;
  if(kategoriaInfo.poziomy.length>1){
    p.sciezkaKategorii=kategoriaInfo.poziomy;
    p.grupaKategorii=kategoriaInfo.grupa;
    p.kategoriaPelna=kategoriaInfo.pelna;
  }
  if(cena===0)p.wymagaCeny=true;else delete p.wymagaCeny;
  const opisKrotki=String(pobierz("opisKrotki","opis_krotki","short_description","summary")).trim();if(opisKrotki)p.opisKrotki=opisKrotki;
  const opis=String(pobierz("opis","description")).trim();if(opis)p.opis=opis;
  const ikona=String(pobierz("ikona","icon","emoji")).trim();if(ikona)p.ikona=ikona;
  const kolor=String(pobierz("kolor")).trim();if(kolor&&czyKolorKarty(kolor))p.kolor=kolor;
  const kolorProduktu=String(pobierz("kolorProduktu")).trim();if(kolorProduktu)p.kolorProduktu=kolorProduktu;
  if(stara!==null&&stara>cena)p.staraCena=+stara.toFixed(2);
  if(stan!==null)p.stan=stan;
  const gtin=String(pobierz("gtin")).trim();if(gtin)p.gtin=gtin;
  const externalId=String(pobierz("externalId")).trim();if(externalId)p.externalId=externalId;
  const mpn=String(pobierz("mpn")).trim();if(mpn)p.mpn=mpn;
  const marka=String(pobierz("marka")).trim();if(marka)p.marka=marka;
  const producent=String(pobierz("producent")).trim()||marka;if(producent)p.producent=producent;
  const rozmiar=String(pobierz("rozmiar")).trim();if(rozmiar)p.rozmiar=rozmiar;
  const material=String(pobierz("material")).trim();if(material)p.material=material;
  const sku=String(pobierz("sku","kod","kod_produktu")).trim()||externalId||mpn||gtin;if(sku)p.sku=sku;
  const badge=String(pobierz("badge","etykieta","label")).trim();if(badge)p.badge=badge;
  const zdjecie=String(pobierz("zdjecie","image","image_url")).trim();if(zdjecie)p.zdjecie=zdjecie;
  if(zdjecia.length)p.zdjecia=zdjecia.slice(0,15);
  const warianty=tablicaWartosci(pobierz("warianty","variants","options"));if(warianty.length)p.warianty=warianty.slice(0,30);
  return {nr,produkt:agentAIPoprawOpisyDanychProduktu(p),bledy,ostrzezenia};
}
function analizujTekstImportu(tekst,nazwa="wklejone dane"){
  try{
    const t=String(tekst||"").trim();if(!t)throw new Error("Brak danych do analizy");
    let surowe,format;
    if(t.startsWith("[")||t.startsWith("{")){
      const j=JSON.parse(t);surowe=Array.isArray(j)?j:(Array.isArray(j.products)?j.products:Array.isArray(j.produkty)?j.produkty:null);format="JSON";
      if(!surowe)throw new Error('JSON musi być tablicą produktów albo obiektem z polem "products"');
    }else{surowe=parsujCSVProduktow(t);format="CSV";}
    if(!surowe.length)throw new Error("Plik nie zawiera produktów");
    if(surowe.length>100000)throw new Error("Jednorazowo można zaimportować maksymalnie 100 000 produktów");
    const wyniki=surowe.map((r,i)=>normalizujProduktImportu(r,i+2));
    const idy=new Map(),sku=new Map(),external=new Map();
    for(const w of wyniki){
      const p=w.produkt;
      if(p.id!==null){if(idy.has(p.id))w.bledy.push(`powtórzone ID ${p.id} (także w wierszu ${idy.get(p.id)})`);else idy.set(p.id,w.nr);}
      if(p.sku){const s=p.sku.toLowerCase();if(sku.has(s))w.bledy.push(`powtórzone SKU ${p.sku} (także w wierszu ${sku.get(s)})`);else sku.set(s,w.nr);}
      if(p.externalId){const s=p.externalId.toLowerCase();if(external.has(s))w.bledy.push(`powtórzone EXTERNAL_ID ${p.externalId} (także w wierszu ${external.get(s)})`);else external.set(s,w.nr);}
    }
    podgladImportuProduktow={
      nazwa,format,wszystkich:wyniki.length,
      produkty:wyniki.filter(w=>!w.bledy.length).map(w=>w.produkt),
      bledy:wyniki.filter(w=>w.bledy.length).map(w=>`Wiersz ${w.nr}: ${w.bledy.join(", ")}`),
      ostrzezenia:wyniki.filter(w=>w.ostrzezenia.length).map(w=>`Wiersz ${w.nr}: ${w.ostrzezenia.join(", ")}`)
    };
    ostatniRaportImportu=null;renderuj();
  }catch(e){
    podgladImportuProduktow={nazwa,format:"—",wszystkich:0,produkty:[],bledy:[e.message],ostrzezenia:[]};
    renderuj();
  }
}
function analizujWklejonyImport(){
  analizujTekstImportu($("importTekstProduktow")?.value||"","wklejone dane");
}
function wczytajPlikImportuProduktow(input){
  const plik=input.files?.[0];if(!plik)return;
  if(plik.size>20*1024*1024){toast("⚠️ Maksymalny rozmiar pliku to 20 MB");input.value="";return;}
  const r=new FileReader();
  r.onload=()=>analizujTekstImportu(r.result,plik.name);
  r.onerror=()=>toast("⚠️ Nie udało się odczytać pliku");
  r.readAsText(plik,"UTF-8");
}
function zapiszStanProduktowPoOperacji(){
  zapiszLS("artway_produkty_dodane",produktyDodane);
  zapiszLS("artway_produkty_ukryte",produktyUkryte);
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_kosz_dodane",koszDodanych);
  zapiszLS("artway_kosz_meta",koszMeta);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zapiszLS("artway_ustawienia",ustawienia);
}
function dodajSciezkiKategoriiZImportuDoMenu(lista){
  const importowane=(Array.isArray(lista)?lista:[]).filter(p=>p?.grupaKategorii&&p?.kategoria);
  if(!importowane.length)return 0;
  const grupy=grupyMenuKategorii();let dodane=0;
  const klucz=v=>normalizujSzukanyTekst(v);
  for(const p of importowane){
    const nazwa=String(p.grupaKategorii||"").trim(),kat=String(p.kategoria||"").trim();
    if(!nazwa||!kat)continue;
    let g=grupy.find(x=>klucz(x.nazwa)===klucz(nazwa));
    if(!g){
      g={id:"menu_import_"+prostyHash(nazwa),nazwa,ikona:ikonaKategorii(nazwa),aktywna:true,kategorie:[]};
      grupy.push(g);
    }
    if(!g.kategorie.some(x=>klucz(x)===klucz(kat))){g.kategorie.push(kat);dodane++;}
  }
  if(dodane){
    ustawienia.menuKategorii=grupy.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz||"",ikonaAssetId:g.ikonaAssetId||"",aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
    ustawienia.menuPokazNieprzypisane=true;
  }
  return dodane;
}
function wykonajImportProduktow(){
  const d=podgladImportuProduktow;if(!d?.produkty?.length){toast("Najpierw przeanalizuj poprawne dane");return;}
  const tryb=$("trybImportuProduktow")?.value||"scal";
  if(tryb==="zastap"&&!confirm(`Zastąpić obecny katalog ${d.produkty.length} produktami? Przed zmianą zostanie utworzona kopia do cofnięcia.`))return;
  const kopia={data:new Date().toISOString(),produktyDodane,produktyUkryte,produktyEdytowane,produktyDefinitywne,koszDodanych,koszMeta,stanyProduktow,dostepnoscProduktow,ustawienia};
  try{localStorage.setItem("artway_ostatnia_kopia_importu",JSON.stringify(kopia));}catch(e){toast("⚠️ Nie udało się utworzyć kopii przed importem");return;}
  let dodane=0,zaktualizowane=0;const wejscie=d.produkty.map(p=>JSON.parse(JSON.stringify(p)));
  if(tryb==="zastap"){
    const zajete=new Set();let nastepne=Math.max(0,...wejscie.map(p=>Number(p.id)||0),...prodBazowe.map(p=>Number(p.id)||0))+1;
    for(const p of wejscie){if(!p.id||zajete.has(p.id)){while(zajete.has(nastepne))nastepne++;p.id=nastepne++;}zajete.add(p.id);if(!p.ikona)p.ikona="📦";if(!p.kolor)p.kolor="#dbeafe";if(p.opis===undefined)p.opis="";}
    produktyDodane=wejscie;
    produktyUkryte=[...new Set(prodBazowe.map(p=>p.id))];
    produktyEdytowane={};produktyDefinitywne=[...produktyUkryte];koszDodanych=[];koszMeta={};stanyProduktow={};
    wejscie.forEach(p=>{if(Number.isInteger(p.stan)&&p.stan>=0)stanyProduktow[p.id]=p.stan;});
    ustawienia={...ustawienia,mapaProduktow:{}};
    dodane=wejscie.length;
  }else{
    const kluczKodu=v=>String(v||"").trim().toLowerCase();
    const aktywne=produktyDoAdministracji(),poSku=new Map(aktywne.filter(p=>p.sku).map(p=>[kluczKodu(p.sku),p])),poExternal=new Map(aktywne.filter(p=>p.externalId).map(p=>[kluczKodu(p.externalId),p]));
    const zajete=new Set([...aktywne.map(p=>Number(p.id)),...koszDodanych.map(p=>Number(p.id))].filter(id=>Number.isInteger(id)&&id>0));let nastepne=Math.max(0,...prodBazowe.map(p=>Number(p.id)||0),...zajete,...wejscie.map(p=>Number(p.id)||0))+1;
    for(const p0 of wejscie){
      const poExternalId=p0.externalId?poExternal.get(kluczKodu(p0.externalId)):null,poKodzie=p0.sku?poSku.get(kluczKodu(p0.sku)):null,poId=(!p0.externalId&&!p0.sku&&p0.id)?aktywne.find(x=>x.id===p0.id):null,istniejacy=poExternalId||poKodzie||poId;
      if(istniejacy){
        const p={...istniejacy,...p0,id:istniejacy.id};
        const i=produktyDodane.findIndex(x=>x.id===p.id);
        if(i>=0)produktyDodane[i]=p;else produktyEdytowane={...produktyEdytowane,[p.id]:p};
        produktyUkryte=produktyUkryte.filter(id=>id!==p.id);produktyDefinitywne=produktyDefinitywne.filter(id=>id!==p.id);
        koszDodanych=koszDodanych.filter(x=>x.id!==p.id);delete koszMeta[p.id];
        if(Number.isInteger(p0.stan)&&p0.stan>=0)stanyProduktow[p.id]=p0.stan;
        if(p.sku)poSku.set(kluczKodu(p.sku),p);
        if(p.externalId)poExternal.set(kluczKodu(p.externalId),p);
        zaktualizowane++;
      }else{
        if(!p0.id||zajete.has(p0.id)){while(zajete.has(nastepne))nastepne++;p0.id=nastepne++;}
        if(!p0.ikona)p0.ikona="📦";if(!p0.kolor)p0.kolor="#dbeafe";if(p0.opis===undefined)p0.opis="";
        zajete.add(p0.id);produktyDodane.push(p0);
        koszDodanych=koszDodanych.filter(x=>x.id!==p0.id);delete koszMeta[p0.id];
        if(Number.isInteger(p0.stan)&&p0.stan>=0)stanyProduktow[p0.id]=p0.stan;
        if(p0.sku)poSku.set(kluczKodu(p0.sku),p0);
        if(p0.externalId)poExternal.set(kluczKodu(p0.externalId),p0);
        aktywne.push(p0);dodane++;
      }
    }
  }
  const menuZImportu=dodajSciezkiKategoriiZImportuDoMenu(wejscie);
  zaznaczoneProdukty.clear();zapiszStanProduktowPoOperacji();zbudujProdukty();odswiezMenu();
  ostatniRaportImportu={dodane,zaktualizowane,pominiete:d.bledy.length,tryb,plik:d.nazwa,menuZImportu};
  podgladImportuProduktow=null;
  loguj("info",`Import produktów: ${dodane} dodanych, ${zaktualizowane} zaktualizowanych, ${d.bledy.length} pominiętych, ${menuZImportu} dopisań do menu`);
  toast(`Import zakończony: +${dodane}, aktualizacje ${zaktualizowane}${menuZImportu?`, menu +${menuZImportu}`:""} ✅`);renderuj();
}
function cofnijOstatniImportProduktow(){
  const k=wczytajLS("artway_ostatnia_kopia_importu",null);
  if(!k){toast("Brak kopii ostatniego importu");return;}
  if(!confirm(`Cofnąć import i przywrócić stan z ${new Date(k.data).toLocaleString("pl-PL")}?`))return;
  produktyDodane=k.produktyDodane||[];produktyUkryte=k.produktyUkryte||[];produktyEdytowane=k.produktyEdytowane||{};
  produktyDefinitywne=k.produktyDefinitywne||[];koszDodanych=k.koszDodanych||[];koszMeta=k.koszMeta||{};stanyProduktow=k.stanyProduktow||{};dostepnoscProduktow=k.dostepnoscProduktow||{};ustawienia=k.ustawienia||ustawienia;
  zapiszStanProduktowPoOperacji();localStorage.removeItem("artway_ostatnia_kopia_importu");
  podgladImportuProduktow=null;ostatniRaportImportu=null;zbudujProdukty();odswiezMenu();
  loguj("info","Cofnięto ostatni import produktów");toast("Przywrócono stan sprzed importu ↩️");renderuj();
}
function produktDoEksportu(p,administracyjny=false){
  const o={id:p.id,nazwa:p.nazwa,kategoria:p.kategoria,cena:+Number(p.cena).toFixed(2)};
  if(p.staraCena>p.cena)o.staraCena=+Number(p.staraCena).toFixed(2);
  const stan=stanProduktu(p);if(stan!==null)o.stan=stan;
  const polaPubliczne=["cenaAllegro","vatRate","sku","gtin","externalId","mpn","marka","producent","opisKrotki","opis","badge","ikona","kolor","kolorProduktu","rozmiar","material","zdjecie"];
  const polaPrywatne=["cenaZakupu","cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuZrodlo","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu","cenaZakupuDopasowanie","cenaZakupuZaktualizowanoAt","cenaZakupuHistoria","allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","allegroFeePrice","allegroFeeCalculatedAt","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent"];
  for(const k of administracyjny?[...polaPubliczne,...polaPrywatne]:polaPubliczne)if(p[k]!==undefined&&p[k]!=="")o[k]=p[k];
  if(p.wymagaCeny)o.wymagaCeny=true;
  if(Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length)o.sciezkaKategorii=p.sciezkaKategorii;
  if(p.grupaKategorii)o.grupaKategorii=p.grupaKategorii;
  if(p.kategoriaPelna)o.kategoriaPelna=p.kategoriaPelna;
  if(p.zdjecia?.length)o.zdjecia=p.zdjecia.slice(0,15);
  if(p.warianty?.length)o.warianty=p.warianty;
  return o;
}
function zakresEksportuProduktow(zakres,administracyjny=false){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  let lista=[...produkty];
  if(zakres==="zaznaczone")lista=lista.filter(p=>zaznaczoneProdukty.has(p.id));
  if(zakres==="kategoria"){const k=$("kategoriaEksportuProduktow")?.value||"";lista=lista.filter(p=>p.kategoria===k);}
  return lista.map(p=>produktDoEksportu(p,administracyjny));
}
function nazwaZakresuEksportu(zakres){
  if(zakres==="zaznaczone")return "zaznaczone";
  if(zakres==="kategoria")return normalizujNaglowekCSV($("kategoriaEksportuProduktow")?.value||"kategoria");
  return "widoczne";
}
function eksportujProduktyJSON(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const nazwa=zakres==="widoczne"?"products.json":`products-${nazwaZakresuEksportu(zakres)}.json`;
  pobierzPlik(nazwa,JSON.stringify(lista,null,2),"application/json");
  if(zakres==="widoczne")localStorage.setItem("artway_produkty_export_hash",prostyHash(JSON.stringify(lista)));
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(zakres==="widoczne"?"Pobrano products.json — wgraj go na hosting ✅":`Wyeksportowano ${lista.length} produktów`);
}
function eksportujProduktyCSV(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres,true);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_CSV_PRODUKTU.join(";"),...lista.map(p=>POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty.csv":`produkty-${nazwaZakresuEksportu(zakres)}.csv`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);toast(`Wyeksportowano ${lista.length} produktów do CSV`);
}
function eksportujProduktyPoIdCSV(ids,nazwa="produkty-filtrowane.csv"){
  const wybrane=new Set((Array.isArray(ids)?ids:[]).map(String));
  const lista=produktyDoAdministracji().filter(p=>wybrane.has(String(p.id))).map(p=>produktDoEksportu(p,true));
  if(!lista.length){toast("Brak produktów do eksportu");return;}
  const csv=[POLA_CSV_PRODUKTU.join(";"),...lista.map(p=>POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"))].join("\n");
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");loguj("info",`Wyeksportowano ${lista.length} produktów z aktualnego wyboru`);toast(`Wyeksportowano ${lista.length} produktów ✅`);
}
function wartoscPolaCSVProduktu(p,pole){
  if(pole==="stara_cena")return p.staraCena?String(p.staraCena.toFixed(2)).replace(".",","):"";
  if(pole==="cena")return String(Number(p.cena||0).toFixed(2)).replace(".",",");
  if(pole==="external_id")return p.externalId||"";
  const financial={cena_allegro:"cenaAllegro",cena_zakupu:"cenaZakupu",prowizja_allegro:"allegroCommissionAmount",prowizja_allegro_procent:"allegroCommissionRate",oplaty_allegro_cykliczne:"allegroRecurringFees",koszt_pakowania:"kosztPakowania",koszt_dodatkowy_sklepu:"sklepAdditionalCost",platnosc_sklepu_procent:"sklepPaymentPercent",koszt_dodatkowy_allegro:"allegroAdditionalCost",doplata_wysylki_allegro:"allegroShippingSubsidy",reklama_allegro_procent:"allegroAdsPercent",vat:"vatRate"};
  if(financial[pole])return p[financial[pole]]??"";
  if(pole==="opis_krotki")return p.opisKrotki||opisKrotkiProduktu(p)||"";
  if(pole==="kolor_produktu")return p.kolorProduktu||"";
  if(pole==="warianty")return (p.warianty||[]).join(" | ");
  if(pole==="stan")return p.stan??"";
  if(pole==="zdjecie")return p.zdjecie||"";
  const m=String(pole).match(/^zdjecie(\d+)$/);
  if(m)return (p.zdjecia||[])[Number(m[1])-2]||"";
  return p[pole]??"";
}
function wartoscPolaOVF(p,pole){
  const zdj=[p.zdjecie||"",...(p.zdjecia||[])];
  const kategoriaPelna=Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length?p.sciezkaKategorii.join("/"):p.kategoriaPelna||p.kategoria||"";
  const mapa={
    GTIN:p.gtin||"",
    EXTERNAL_ID:p.externalId||p.sku||String(p.id||""),
    NAME:p.nazwa||"",
    STOCK:p.stan??"",
    PRICE:p.cena!==undefined?String(Number(p.cena||0).toFixed(2)).replace(".",","):"",
    MPN:p.mpn||p.sku||"",
    DESCRIPTION:p.opis||"",
    CATEGORY:kategoriaPelna,
    BRAND:p.marka||"",
    MANUFACTURER:p.producent||p.marka||"",
    COLOR:p.kolorProduktu||"",
    SIZE:p.rozmiar||(p.warianty||[]).join(" | "),
    MATERIAL:p.material||""
  };
  const img=String(pole).match(/^IMAGE(\d+)$/);
  return img ? (zdj[Number(img[1])-1]||"") : (mapa[pole]??"");
}
function eksportujProduktyOVF(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_OVF_PRODUKTU.join(","),...lista.map(p=>POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(","))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty-ovf.xls":`produkty-ovf-${nazwaZakresuEksportu(zakres)}.xls`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(`Wyeksportowano ${lista.length} produktów w formacie OVF`);
}
function pobierzSzablonProduktowCSV(){
  const p={id:1,nazwa:"Przykładowa gra",kategoria:"Gry edukacyjne",cena:99.90,cenaAllegro:109.90,cenaZakupu:55,allegroCommissionAmount:11,allegroCommissionRate:10,allegroRecurringFees:0,kosztPakowania:1.5,sklepAdditionalCost:0,sklepPaymentPercent:1.5,allegroAdditionalCost:0,allegroShippingSubsidy:3,allegroAdsPercent:0,vatRate:23,staraCena:129.90,stan:25,sku:"SKU-001",gtin:"5901234567891",externalId:"EXT-001",mpn:"MPN-001",marka:"Marka",producent:"Producent",opisKrotki:"Krótki opis produktu do karty sklepu.",opis:"Pełny opis produktu z najważniejszymi cechami.",badge:"Nowość",ikona:"🎲",zdjecie:"https://adres.pl/zdjecie.jpg",warianty:["S","M","L"],kolor:"#dbeafe",kolorProduktu:"Kolorowy",rozmiar:"XL",material:"Karton"};
  pobierzPlik("szablon-importu-produktow.csv","\uFEFF"+POLA_CSV_PRODUKTU.join(";")+"\n"+POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"),"text/csv");
}
function pobierzSzablonProduktowOVF(){
  const p={id:1,nazwa:"Przykładowa gra edukacyjna",kategoria:"Gry edukacyjne",cena:99.90,stan:25,sku:"GRA-001",externalId:"GRA-001",gtin:"5901234567891",mpn:"GRA-001",opisKrotki:"Krótki opis produktu do karty sklepu.",opis:"Pełny opis będzie widoczny na stronie produktu, a na listach pojawi się skrót.",zdjecie:"https://adres.pl/zdjecie1.jpg",zdjecia:["https://adres.pl/zdjecie2.jpg"],marka:"Artway",producent:"Artway",kolorProduktu:"Kolorowy",rozmiar:"30x20x5 cm",material:"Karton"};
  const csv=POLA_OVF_PRODUKTU.join(",")+"\n"+POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(",");
  pobierzPlik("ovf-template-dla-rozszerzonego-pliku-csv-dane.xls","\uFEFF"+csv,"text/csv");
}

/* ── Katalogi produktów (kategorie) ── */
function widokAdminKategorie(){
  const wszystkie = produktyDoAdministracji();
  const zmiany = ustawienia.kategorie || {};
  const mapa = ustawienia.mapaProduktow || {};
  const zProduktow = [...new Set(wszystkie.map(p=>{ let k=mapa[p.id]||p.kategoria; for(let i=0;i<3&&zmiany[k];i++) k=zmiany[k]; return k; }))];
  const wlasne = ustawienia.wlasneKategorie || [];
  const nazwy = [...new Set([...zProduktow, ...wlasne])];
  const ukryte = ustawienia.ukryteKategorie || [];
  const grupy = grupyMenuKategorii();
  const pokazNieprzypisane = ustawienia.menuPokazNieprzypisane!==false;
  const przypisane = new Set(grupy.flatMap(g=>g.kategorie).filter(k=>nazwy.includes(k)));
  const bezGrup = nazwy.filter(k=>!przypisane.has(k));
  return asortymentSzkielet("kategorie", `
  <div class="panel">
    <div class="order-section-head"><div><h1>➕ Utwórz nowy katalog</h1><p class="order-detail-lead">Katalogi możesz dodawać ręcznie albo przygotować bezpieczny szablon pod przyszły asortyment imprezowy.</p></div><button class="btn ghost" type="button" onclick="przygotujKatalogImprezowyGoDan()">🎈 Przygotuj GoDan i imprezy</button></div>
    <form onsubmit="dodajKatalog(event)" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin:.6rem 0">
      <div class="f-group" style="margin:0;flex:1;min-width:200px"><label>Nazwa katalogu</label><input required name="nazwa" placeholder="np. Zabawki, AGD, Ogród…" maxlength="40"></div>
      <button class="btn" type="submit">➕ Utwórz</button>
    </form>
    <p style="font-size:.8rem;color:var(--muted2)">Nowy katalog od razu pojawi się w górnym menu sklepu i na stronie głównej. Produkty przypiszesz do niego w <a href="#/admin/mapowanie">🧩 Mapowaniu produktów</a> lub przy dodawaniu produktu.</p>
  </div>
  <div class="panel">
    <div class="results-bar" style="padding:0;margin:0 0 .8rem">
      <div><h1 style="margin:0">🧭 Wyższy poziom kategorii w menu</h1><p style="font-size:.85rem;color:var(--muted2);margin:.25rem 0 0">Poziom 1: grupa w górnym menu • Poziom 2: wybrane katalogi • Poziom 3: produkty. To porządkuje sklep przy dużej liczbie produktów.</p></div>
      <label style="font-size:.82rem;font-weight:700;color:var(--muted2)"><input type="checkbox" ${pokazNieprzypisane?"checked":""} onchange="przelaczNieprzypisaneMenu(this.checked)"> Pokaż katalogi bez grupy w menu</label>
    </div>
    <form onsubmit="dodajGrupeMenuKategorii(event)" class="f-row" style="grid-template-columns:1fr 130px auto;align-items:end;margin-bottom:1rem">
      <div class="f-group"><label>Nazwa grupy nadrzędnej</label><input required name="nazwa" placeholder="np. Gry i zabawki, Edukacja, Ogród…"></div>
      <div class="f-group"><label>Ikona</label>${emojiPoleHTML("ikona","🗂️","🗂️")}</div>
      <div class="f-group"><button class="btn" type="submit">➕ Dodaj grupę</button></div>
    </form>
    ${grupy.length?grupy.map((g,i)=>{
      const dzieci=g.kategorie.filter(k=>nazwy.includes(k));
      const martwe=g.kategorie.filter(k=>!nazwy.includes(k));
      return `<div class="menu-group-box" style="${g.aktywna?"":"opacity:.6"}">
        <form onsubmit="zapiszGrupeMenuKategorii(event,${jsArg(g.id)})">
          <div class="f-row" style="grid-template-columns:minmax(210px,280px) 1fr auto auto auto;align-items:end">
            <div class="f-group"><label>Ikona</label>${emojiPoleHTML("ikona",g.ikona||"🗂️","🗂️")}</div>
            <div class="f-group"><label>Nazwa grupy</label><input name="nazwa" value="${esc(g.nazwa)}" required></div>
            <label class="chk-row" style="margin:.2rem 0 .55rem"><input type="checkbox" name="aktywna" ${g.aktywna?"checked":""}> <span>Widoczna</span></label>
            <div class="diag-actions" style="margin:0">
              <button class="btn ghost" type="button" onclick="przesunGrupeMenuKategorii(${jsArg(g.id)},-1)" ${i===0?"disabled":""}>↑</button>
              <button class="btn ghost" type="button" onclick="przesunGrupeMenuKategorii(${jsArg(g.id)},1)" ${i===grupy.length-1?"disabled":""}>↓</button>
            </div>
            <div class="diag-actions" style="margin:0"><button class="btn" type="submit">💾 Zapisz</button><button class="btn danger" type="button" onclick="if(confirm('Usunąć grupę menu? Produkty i katalogi zostaną.')) usunGrupeMenuKategorii(${jsArg(g.id)})">🗑️</button></div>
          </div>
        </form>
        <p style="font-size:.82rem;color:var(--muted2);margin:.35rem 0">W grupie: <b>${dzieci.length}</b> katalogów${martwe.length?` • ${martwe.length} nieistniejących odwołań do wyczyszczenia przy zapisie`:""}</p>
        <div class="diag-actions" style="margin:.4rem 0"><button class="btn ghost" onclick="ustawKategorieWGrupie(${jsArg(g.id)},'wszystkie')">☑ Zaznacz wszystkie</button><button class="btn ghost" onclick="ustawKategorieWGrupie(${jsArg(g.id)},'puste')">☐ Wyczyść grupę</button></div>
        <div class="menu-cat-grid">
          ${nazwy.map(k=>`<label><input type="checkbox" ${g.kategorie.includes(k)?"checked":""} onchange="przelaczKategorieWGrupie(${jsArg(g.id)},${jsArg(k)},this.checked)"> <span><b>${esc(k)}</b><br><small>${liczbaProduktowWKategorii(k)} produktów${przypisane.has(k)&&!g.kategorie.includes(k)?" • w innej grupie":""}</small></span></label>`).join("")}
        </div>
      </div>`;
    }).join(""):`<div class="backend-note">Nie ma jeszcze grup nadrzędnych. Dodaj np. „Gry i zabawki”, a potem zaznacz katalogi, które mają się pod nią pojawić w górnym menu.</div>`}
    ${bezGrup.length?`<p style="font-size:.82rem;color:var(--muted2);margin-top:.75rem">Katalogi bez grupy: ${bezGrup.map(esc).join(", ")}</p>`:""}
  </div>
  <div class="panel">
    <h1>🗂️ Katalogi (${nazwy.length})</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin-bottom:.8rem">Zmiana nazwy przenosi wszystkie produkty do nowej nazwy. Ukrycie chowa katalog i jego produkty w sklepie (nic nie jest kasowane). Każdy katalog ma własną podstronę w menu sklepu.</p>
    <table class="log-table">
      <tr><th>Katalog</th><th>Produktów</th><th>Nowa nazwa</th><th>Akcje</th></tr>
      ${nazwy.map(k=>{
        const n = wszystkie.filter(p=>{let x=(ustawienia.mapaProduktow||{})[p.id]||p.kategoria;for(let i=0;i<3&&zmiany[x];i++)x=zmiany[x];return x===k;}).length;
        const uk = ukryte.includes(k);
        const wlasny = wlasne.includes(k);
        const idKat = btoa(encodeURIComponent(k)).replace(/[^a-zA-Z0-9]/g,"");
        return `<tr style="${uk?'opacity:.5':''}">
        <td><b>${esc(k)}</b>${uk?' <span class="lvl lvl-ostrzezenie">ukryty</span>':""}${wlasny&&!n?' <span class="lvl lvl-info">nowy</span>':""}</td>
        <td>${n} ${n?`— <a href="#/kategoria/${encodeURIComponent(k)}">podgląd</a>`:""}</td>
        <td><div style="display:flex;gap:.4rem"><input value="${esc(k)}" id="kat_${idKat}" style="padding:.3rem .6rem;border:1.5px solid var(--line);border-radius:8px;max-width:170px">
          <button class="btn ghost" style="padding:.3rem .7rem" onclick="zmienKategorie('${esc(k)}', document.getElementById('kat_${idKat}').value)">Zmień</button></div></td>
        <td style="white-space:nowrap">
          <button class="btn ghost" style="padding:.3rem .55rem" onclick="otworzDodawanieProduktu(${jsArg(k)})" title="Dodaj produkt do katalogu">➕</button>
          <a class="btn ghost" style="padding:.3rem .55rem" href="#/admin/mapowanie" onclick="filtrMapowania=${jsArg(k)}" title="Mapuj produkty">🧩</a>
          <button class="ci-remove" style="color:var(--muted2)" onclick="przelaczKategorie(${jsArg(k)})" title="${uk?'Pokaż':'Ukryj'}">${uk?"👁️":"🙈"}</button>
          ${wlasny&&!n?`<button class="ci-remove" onclick="usunKatalog('${esc(k)}')" title="Usuń pusty katalog">🗑️</button>`:""}</td>
      </tr>`;}).join("")}
    </table>
  </div>`);
}
function dodajKatalog(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const k = String(f.get("nazwa")).trim();
  if(k.length<2){ toast("⚠️ Nazwa musi mieć min. 2 znaki"); return; }
  if(wszystkieKategorie().includes(k) || (ustawienia.wlasneKategorie||[]).includes(k)){ toast("Taki katalog już istnieje"); return; }
  ustawienia.wlasneKategorie = [...(ustawienia.wlasneKategorie||[]), k];
  loguj("info","Utworzono katalog: "+k);
  zapiszCzescUstawien({wlasneKategorie: ustawienia.wlasneKategorie});
}
function przygotujKatalogImprezowyGoDan(){
  const plan=[
    {grupa:"Balony",ikona:"🎈",kategorie:["Balony foliowe","Balony lateksowe","Bukiety i zestawy balonów"]},
    {grupa:"Przyjęcia i dekoracje",ikona:"🎉",kategorie:["Dekoracje imprezowe","Naczynia i akcesoria imprezowe","Świeczki i dekoracje tortu","Stroje i gadżety imprezowe"]}
  ];
  const dotychczas=grupyMenuKategorii(),wlasne=[...(ustawienia.wlasneKategorie||[])];let noweKategorie=0,noweGrupy=0;
  for(const sekcja of plan){
    for(const kat of sekcja.kategorie)if(!wlasne.some(x=>normalizujSzukanyTekst(x)===normalizujSzukanyTekst(kat))&&!wszystkieKategorie().some(x=>normalizujSzukanyTekst(x)===normalizujSzukanyTekst(kat))){wlasne.push(kat);noweKategorie++;}
    let grupa=dotychczas.find(x=>normalizujSzukanyTekst(x.nazwa)===normalizujSzukanyTekst(sekcja.grupa));
    if(!grupa){grupa={id:`grp_godan_${prostyHash(sekcja.grupa)}`,nazwa:sekcja.grupa,ikona:sekcja.ikona,aktywna:true,kategorie:[]};dotychczas.push(grupa);noweGrupy++;}
    grupa.kategorie=[...new Set([...(grupa.kategorie||[]),...sekcja.kategorie])];
  }
  zapiszGrupyMenuKategorii(dotychczas,{wlasneKategorie:wlasne,menuPokazNieprzypisane:true});
  loguj("info",`Przygotowano katalog imprezowy GoDan: ${noweGrupy} grup i ${noweKategorie} katalogów — bez zmiany produktów`);
  toast(noweGrupy||noweKategorie?`🎈 Dodano ${noweKategorie} katalogów; produkty pozostały bez zmian`:"Katalog GoDan i imprezy jest już przygotowany");
}
function usunKatalog(k){
  ustawienia.wlasneKategorie = (ustawienia.wlasneKategorie||[]).filter(x=>x!==k);
  ustawienia.menuKategorii = grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.filter(x=>x!==k)}));
  loguj("info","Usunięto pusty katalog: "+k);
  zapiszCzescUstawien({wlasneKategorie: ustawienia.wlasneKategorie, menuKategorii: ustawienia.menuKategorii});
}
function dodajGrupeMenuKategorii(e){
  e.preventDefault();
  const f=new FormData(e.target), nazwa=String(f.get("nazwa")||"").trim(), ikona=String(f.get("ikona")||"🗂️").trim()||"🗂️";
  if(nazwa.length<2){ toast("Podaj nazwę grupy"); return; }
  const grupy=grupyMenuKategorii();
  if(grupy.some(g=>g.nazwa.toLowerCase()===nazwa.toLowerCase())){ toast("Taka grupa już istnieje"); return; }
  grupy.push({id:"grp_"+Date.now().toString(36),nazwa,ikona,aktywna:true,kategorie:[]});
  loguj("info","Dodano grupę menu kategorii: "+nazwa);
  zapiszGrupyMenuKategorii(grupy);
}
function zapiszGrupeMenuKategorii(e,id){
  e.preventDefault();
  const f=new FormData(e.target), grupy=grupyMenuKategorii(), dozwolone=new Set(wszystkieKategorie());
  const i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i]={...grupy[i],nazwa:String(f.get("nazwa")||"").trim()||grupy[i].nazwa,ikona:String(f.get("ikona")||"🗂️").trim()||"🗂️",aktywna:!!f.get("aktywna"),kategorie:grupy[i].kategorie.filter(k=>dozwolone.has(k))};
  loguj("info","Zapisano grupę menu kategorii: "+grupy[i].nazwa);
  zapiszGrupyMenuKategorii(grupy);
}
function przelaczKategorieWGrupie(id,kat,wl){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i].kategorie = wl ? [...new Set([...grupy[i].kategorie,kat])] : grupy[i].kategorie.filter(k=>k!==kat);
  zapiszGrupyMenuKategorii(grupy);
}
function ustawKategorieWGrupie(id,tryb){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i].kategorie = tryb==="wszystkie" ? wszystkieKategorie() : [];
  zapiszGrupyMenuKategorii(grupy);
}
function przesunGrupeMenuKategorii(id,kierunek){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id), j=i+kierunek;
  if(i<0||j<0||j>=grupy.length) return;
  [grupy[i],grupy[j]]=[grupy[j],grupy[i]];
  zapiszGrupyMenuKategorii(grupy);
}
function usunGrupeMenuKategorii(id){
  zapiszGrupyMenuKategorii(grupyMenuKategorii().filter(g=>g.id!==id));
}
function przelaczNieprzypisaneMenu(wl){
  ustawienia.menuPokazNieprzypisane=!!wl;
  zapiszCzescUstawien({menuPokazNieprzypisane:ustawienia.menuPokazNieprzypisane});
}
function otworzDodawanieProduktu(kategoria){
  const category=String(kategoria||"").trim();
  location.hash=category?`#/admin/produkty/dodaj?kategoria=${encodeURIComponent(category)}`:"#/admin/produkty/dodaj";
}

/* ── Zaawansowane mapowanie produktów (produkt → katalog) ── */
let zaznaczoneMap = new Set(), filtrMapowania = "Wszystkie";
function widokAdminMapowanie(){
  const zmiany = ustawienia.kategorie || {};
  const mapa = ustawienia.mapaProduktow || {};
  const wszystkie = produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p))
    .map(p=>{ let k=mapa[p.id]||p.kategoria; for(let i=0;i<3&&zmiany[k];i++) k=zmiany[k]; return {...p, kategoria:k}; });
  const katalogi = wszystkieKategorie();
  const lista = filtrMapowania==="Wszystkie" ? wszystkie : wszystkie.filter(p=>p.kategoria===filtrMapowania);
  const opcje = katalogi.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join("");
  return asortymentSzkielet("mapowanie", `
  <div class="panel">
    <h1>🧩 Mapowanie produktów (${lista.length})</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin:.4rem 0 .8rem">Przypisuj produkty do katalogów: pojedynczo (lista w wierszu) albo masowo — zaznacz produkty, wybierz katalog docelowy i kliknij „Przenieś”. Działa też na produkty z products.json.</p>
    <div class="diag-actions" style="margin-bottom:.8rem">
      <button class="btn" onclick="otworzDodawanieProduktu(filtrMapowania==='Wszystkie'?'':filtrMapowania)">➕ Dodaj produkt</button>
      <form onsubmit="dodajKatalogZMapowania(event)" style="display:flex;gap:.5rem;flex:1;min-width:260px">
        <input required name="nazwa" placeholder="Nazwa nowego katalogu…" maxlength="40" style="flex:1;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <button class="btn ghost" type="submit">➕ Katalog</button>
      </form>
    </div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;background:var(--bg);border-radius:12px;padding:.7rem">
      <select onchange="filtrMapowania=this.value;zaznaczoneMap.clear();renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option ${filtrMapowania==="Wszystkie"?"selected":""}>Wszystkie</option>
        ${katalogi.map(k=>`<option ${k===filtrMapowania?"selected":""}>${esc(k)}</option>`).join("")}
      </select>
      <span style="font-size:.85rem;font-weight:700">Zaznaczone przenieś do:</span>
      <select id="mapCel" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">${opcje}</select>
      <button class="btn" onclick="przeniesZaznaczone()">🧩 Przenieś</button>
      <button class="btn ghost" onclick="zaznaczWszystkieMapowania()">☑ Zaznacz widoczne</button>
      <button class="btn ghost" onclick="usunMapowanieZaznaczonych()">↩️ Usuń wybrane mapowania</button>
      <button class="btn ghost" onclick="wyczyscMapowanie()">↩️ Wyczyść całe mapowanie</button>
    </div>
    <div style="overflow-x:auto"><table class="log-table">
      <tr><th></th><th>Produkt</th><th>Katalog</th><th>Przenieś do</th><th>Akcje</th></tr>
      ${lista.map(p=>`<tr>
        <td><input type="checkbox" ${zaznaczoneMap.has(p.id)?"checked":""} onchange="przelaczZaznaczenieMap(${p.id})" style="width:17px;height:17px;accent-color:var(--brand)"></td>
        <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b>${mapa[p.id]?' <span class="lvl lvl-info">zmapowany</span>':""}</td>
        <td>${esc(p.kategoria)}</td>
        <td><select onchange="mapujProdukt(${p.id}, this.value)" style="padding:.3rem .5rem;border-radius:8px;border:1.5px solid var(--line)">
          ${katalogi.map(k=>`<option ${k===p.kategoria?"selected":""}>${esc(k)}</option>`).join("")}
        </select></td>
        <td style="white-space:nowrap">
          <a class="btn ghost" href="#/admin/produkty/edytuj/${p.id}" style="padding:.3rem .55rem" title="Edytuj produkt">✏️</a>
          ${mapa[p.id]?`<button class="btn ghost" onclick="usunMapowanieProduktu(${p.id})" style="padding:.3rem .55rem" title="Usuń mapowanie">↩️</button>`:""}
        </td>
      </tr>`).join("")}
    </table></div>
  </div>`);
}
function przelaczZaznaczenieMap(id){ zaznaczoneMap.has(id) ? zaznaczoneMap.delete(id) : zaznaczoneMap.add(id); }
function zaznaczWszystkieMapowania(){
  const zmiany = ustawienia.kategorie || {}, mapa = ustawienia.mapaProduktow || {};
  let lista = produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p))
    .map(p=>{let k=mapa[p.id]||p.kategoria;for(let i=0;i<3&&zmiany[k];i++)k=zmiany[k];return {...p,kategoria:k};});
  if(filtrMapowania!=="Wszystkie") lista=lista.filter(p=>p.kategoria===filtrMapowania);
  lista.forEach(p=>zaznaczoneMap.add(p.id));
  renderuj();
}
function mapujProdukt(id, kat){
  ustawienia.mapaProduktow = {...(ustawienia.mapaProduktow||{}), [id]: kat};
  loguj("info",`Przemapowano produkt ${id} → ${kat}`);
  zapiszCzescUstawien({mapaProduktow: ustawienia.mapaProduktow});
}
function usunMapowanieProduktu(id){
  const mapa = {...(ustawienia.mapaProduktow||{})};
  delete mapa[id];
  loguj("info","Usunięto mapowanie produktu "+id);
  zapiszCzescUstawien({mapaProduktow:mapa});
}
function usunMapowanieZaznaczonych(){
  if(!zaznaczoneMap.size){ toast("Zaznacz produkty"); return; }
  const mapa = {...(ustawienia.mapaProduktow||{})};
  zaznaczoneMap.forEach(id=>delete mapa[id]);
  loguj("info",`Usunięto mapowanie ${zaznaczoneMap.size} produktów`);
  zaznaczoneMap.clear();
  zapiszCzescUstawien({mapaProduktow:mapa});
}
function przeniesZaznaczone(){
  const cel = $("mapCel")?.value;
  if(!cel || !zaznaczoneMap.size){ toast("Zaznacz produkty i wybierz katalog docelowy"); return; }
  const mapa = {...(ustawienia.mapaProduktow||{})};
  zaznaczoneMap.forEach(id=>mapa[id]=cel);
  loguj("info",`Przemapowano ${zaznaczoneMap.size} produktów → ${cel}`);
  zaznaczoneMap.clear();
  zapiszCzescUstawien({mapaProduktow: mapa});
}
function wyczyscMapowanie(){
  zaznaczoneMap.clear();
  loguj("info","Wyczyszczono mapowanie produktów");
  zapiszCzescUstawien({mapaProduktow: {}});
}
function dodajKatalogZMapowania(e){
  e.preventDefault();
  const nazwa = String(new FormData(e.target).get("nazwa")||"").trim();
  if(nazwa.length<2){ toast("Nazwa katalogu musi mieć minimum 2 znaki"); return; }
  if(wszystkieKategorie().includes(nazwa)){ toast("Taki katalog już istnieje"); return; }
  const wlasne = [...(ustawienia.wlasneKategorie||[]), nazwa];
  filtrMapowania = nazwa;
  zapiszCzescUstawien({wlasneKategorie:wlasne});
  loguj("info","Dodano katalog z mapowania: "+nazwa);
}
function zmienKategorie(stara, nowa){
  nowa = String(nowa||"").trim();
  if(!nowa || nowa===stara){ toast("Wpisz inną nazwę"); return; }
  ustawienia.kategorie = {...(ustawienia.kategorie||{}), [stara]: nowa};
  ustawienia.menuKategorii = grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.map(k=>k===stara?nowa:k)}));
  if(aktywnaKategoria===stara) aktywnaKategoria = nowa;
  zapiszCzescUstawien({kategorie: ustawienia.kategorie, menuKategorii: ustawienia.menuKategorii});
  loguj("info",`Zmieniono kategorię: ${stara} → ${nowa}`);
}
function przelaczKategorie(kat){
  const u = ustawienia.ukryteKategorie || [];
  ustawienia.ukryteKategorie = u.includes(kat) ? u.filter(x=>x!==kat) : [...u, kat];
  if(aktywnaKategoria===kat) aktywnaKategoria = "Wszystkie";
  zapiszCzescUstawien({ukryteKategorie: ustawienia.ukryteKategorie});
}

/* ── ⭐ Moderacja opinii ── */
let filtrOpinii = "oczekuje";
function widokAdminOpinie(){
  const oczekujace = opinie.filter(o=>o.status==="oczekuje").length;
  const lista = filtrOpinii==="wszystkie" ? opinie : opinie.filter(o=>o.status===filtrOpinii);
  return asortymentSzkielet("opinie", `
  <div class="panel">
    <h1>⭐ Opinie klientów (${opinie.length}) ${oczekujace?`<span class="lvl lvl-ostrzezenie">${oczekujace} do akceptacji</span>`:""}</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin:.4rem 0 .8rem">Opinie pojawiają się na stronie produktu dopiero po Twojej akceptacji. Klient wystawia je na dole strony produktu.</p>
    <div style="display:flex;gap:.6rem;margin-bottom:1rem">
      <select onchange="filtrOpinii=this.value;renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option value="oczekuje" ${filtrOpinii==="oczekuje"?"selected":""}>Oczekujące (${opinie.filter(o=>o.status==="oczekuje").length})</option>
        <option value="zatwierdzona" ${filtrOpinii==="zatwierdzona"?"selected":""}>Opublikowane (${opinie.filter(o=>o.status==="zatwierdzona").length})</option>
        <option value="wszystkie" ${filtrOpinii==="wszystkie"?"selected":""}>Wszystkie</option>
      </select>
    </div>
    ${lista.length ? lista.map(o=>{
      const p = produkty.find(x=>x.id===o.produktId) || [...produktyBazoweWspolne(),...produktyDodane].find(x=>x.id===o.produktId);
      return `<div class="order-box">
        <div class="order-head">
          <b>${esc(o.autor)}</b>
          <span style="color:var(--accent);font-weight:700">${gwiazdki(o.ocena)}</span>
          <span>${esc(o.data)}</span>
          <span class="lvl ${o.status==="zatwierdzona"?"lvl-info":"lvl-ostrzezenie"}">${o.status==="zatwierdzona"?"opublikowana":"oczekuje"}</span>
        </div>
        <div class="order-lines">
          ${p?`🏷️ <a href="#/produkt/${o.produktId}">${esc(p.nazwa)}</a><br>`:""}
          ${esc(o.tekst)}
        </div>
        <div class="diag-actions" style="margin-top:.6rem">
          ${o.status!=="zatwierdzona"?`<button class="btn" onclick="moderujOpinie('${o.id}','zatwierdz')">✅ Opublikuj</button>`:""}
          <button class="btn danger" onclick="if(confirm('Usunąć opinię?')) moderujOpinie('${o.id}','usun')">🗑️ Usuń</button>
        </div>
      </div>`;}).join("")
    : `<p style="color:var(--muted2)">Brak opinii w tym widoku.</p>`}
  </div>`);
}

/* ── 🧭 Rozmieszczenie sekcji strony głównej (wizualnie) ── */
function widokAdminRozmieszczenie(){
  const kolej = kolejnoscSekcji();
  return personalizacjaSzkielet("rozmieszczenie", `
  <div class="panel">
    <h1>🧭 Rozmieszczenie sekcji strony głównej</h1>
    <p style="font-size:.86rem;color:var(--muted2);margin:.4rem 0 1rem">Ułóż stronę dokładnie tak, jak chcesz: strzałki <b>↑ ↓</b> zmieniają kolejność, oko włącza/wyłącza sekcję. Po prawej widzisz schemat strony — klienci zobaczą ją dokładnie w tej kolejności. Zmiany zapisują się od razu.</p>
    <div class="rozm-grid">
      <div>
        ${kolej.map((id,i)=>{ const s=SEKCJE_GLOWNEJ[id]; const wid=sekcjaWidoczna(id); return `
        <div class="uklad-box ${wid?'':'wylaczona'}">
          <span class="uklad-nr">${i+1}</span>
          <span style="font-size:1.15rem">${s.ikona}</span>
          <b style="flex:1;font-size:.9rem">${s.nazwa}${wid?"":" <span class='lvl lvl-ostrzezenie'>ukryta</span>"}</b>
          <button class="btn ghost uklad-btn" ${i===0?"disabled":""} onclick="przesunSekcjeGlownej('${id}',-1)" title="Wyżej">↑</button>
          <button class="btn ghost uklad-btn" ${i===kolej.length-1?"disabled":""} onclick="przesunSekcjeGlownej('${id}',1)" title="Niżej">↓</button>
          <button class="btn ghost uklad-btn" onclick="przelaczSekcjeGlownej('${id}')" title="${wid?'Ukryj sekcję':'Pokaż sekcję'}">${wid?"👁️":"🙈"}</button>
        </div>`;}).join("")}
        <div class="diag-actions" style="margin-top:1rem">
          <a class="btn" href="#/">👁️ Zobacz stronę na żywo</a>
          <button class="btn danger" onclick="resetujRozmieszczenie()">↩️ Przywróć domyślne</button>
        </div>
      </div>
      <div class="mini-strona">
        <div class="mini-pasek">pasek info + nagłówek + menu</div>
        ${kolej.map(id=>{ const s=SEKCJE_GLOWNEJ[id]; const wid=sekcjaWidoczna(id);
          const h = id==="hero" ? 54 : id==="produkty" ? 66 : id==="kategorie" ? 44 : 28;
          return `<div class="mini-blok ${wid?'':'mini-ukryty'}" style="min-height:${h}px">${s.ikona} ${s.nazwa}</div>`;}).join("")}
        <div class="mini-pasek">stopka</div>
      </div>
    </div>
  </div>`);
}
function przesunSekcjeGlownej(id, dir){
  const k = kolejnoscSekcji();
  const i = k.indexOf(id), j = i+dir;
  if(i<0 || j<0 || j>=k.length) return;
  [k[i], k[j]] = [k[j], k[i]];
  loguj("info","Rozmieszczenie: przesunięto sekcję "+id);
  zapiszCzescUstawien({kolejnoscSekcji: k});
}
function przelaczSekcjeGlownej(id){
  const u = new Set(ustawienia.sekcjeUkryte||[]);
  u.has(id) ? u.delete(id) : u.add(id);
  loguj("info","Rozmieszczenie: przełączono widoczność sekcji "+id);
  zapiszCzescUstawien({sekcjeUkryte: [...u]});
}
function resetujRozmieszczenie(){
  loguj("info","Rozmieszczenie: przywrócono domyślne");
  zapiszCzescUstawien({kolejnoscSekcji: null, sekcjeUkryte: []});
}

/* ── Kody rabatowe ── */
function widokAdminRabaty(){
  const kody = Object.entries(KONFIG.kodyRabatowe);
  return asortymentSzkielet("rabaty", `
  <div class="panel">
    <h1>🎁 Kody rabatowe (${kody.length})</h1>
    <form onsubmit="dodajKod(event)" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin:.8rem 0 1rem">
      <div class="f-group" style="margin:0"><label>Kod</label><input required name="kod" placeholder="np. WIOSNA10" maxlength="20" style="text-transform:uppercase"></div>
      <div class="f-group" style="margin:0;max-width:120px"><label>Rabat %</label><input required name="procent" type="number" min="1" max="90"></div>
      <button class="btn" type="submit">➕ Dodaj</button>
    </form>
    ${kody.length?`<table class="log-table"><tr><th>Kod</th><th>Rabat</th><th>Akcje</th></tr>
      ${kody.map(([k,v])=>`<tr><td><b>${esc(k)}</b></td><td><input id="kod_${esc(k)}" type="number" min="1" max="90" value="${v}" style="width:80px;padding:.3rem .5rem;border:1.5px solid var(--line);border-radius:8px"> %</td>
        <td><button class="btn ghost" style="padding:.3rem .55rem" onclick="zmienKod('${esc(k)}',document.getElementById('kod_${esc(k)}').value)">💾</button>
        <button class="ci-remove" onclick="usunKod('${esc(k)}')">🗑️</button></td></tr>`).join("")}</table>`
    : `<p style="color:var(--muted2)">Brak kodów — klienci nie mają teraz żadnych rabatów.</p>`}
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.8rem">Kody możesz ogłosić w pasku na górze strony (🎨 Wygląd i treści).</p>
  </div>`);
}
function dodajKod(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const kod = String(f.get("kod")).trim().toUpperCase();
  const proc = +f.get("procent");
  if(!/^[A-Z0-9]{2,20}$/.test(kod) || !(proc>=1 && proc<=90)){ toast("⚠️ Kod: 2–20 znaków (litery/cyfry), rabat 1–90%"); return; }
  KONFIG.kodyRabatowe[kod] = proc;
  zapiszCzescUstawien({kody: {...KONFIG.kodyRabatowe}});
  loguj("info",`Dodano kod rabatowy ${kod} (−${proc}%)`);
}
function usunKod(kod){
  delete KONFIG.kodyRabatowe[kod];
  if(rabat?.kod===kod) usunRabat();
  zapiszCzescUstawien({kody: {...KONFIG.kodyRabatowe}});
  loguj("info","Usunięto kod rabatowy "+kod);
}
function zmienKod(kod, procent){
  procent = +procent;
  if(!(procent>=1&&procent<=90)){ toast("Rabat musi wynosić 1–90%"); return; }
  KONFIG.kodyRabatowe[kod] = procent;
  zapiszCzescUstawien({kody:{...KONFIG.kodyRabatowe}});
  loguj("info",`Zmieniono kod ${kod} na −${procent}%`);
}

/* ── Profesjonalna architektura katalogów i mapowania ──────────────────────
   Warstwa rozszerza starsze operacje bez zmiany produktów. Katalog może mieć
   jednego rodzica i jedną grupę menu; podkatalog dziedziczy grupę rodzica. */
let szukajKatalogowAdmin="",filtrKatalogowAdmin="wszystkie";
let szukajMapowania="",filtrStatusuMapowania="wszystkie",filtrGrupyMapowania="wszystkie",filtrProducentaMapowania="wszyscy",sortMapowania="nazwa",stronaMapowania=1;
let mapowaniaNaStronie=[25,50,100,200,500,1000].includes(Number(wczytajLS("artway_mapowanie_na_stronie",50)))?Number(wczytajLS("artway_mapowanie_na_stronie",50)):50;
let mapowanieWynikiIds=[],mapowanieStronaIds=[];

function rozwiazNazweKatalogu(kategoria){
  const zmiany=ustawienia.kategorie||{};let wynik=String(kategoria||"").trim(),seen=new Set();
  for(let i=0;i<8&&zmiany[wynik]&&!seen.has(wynik);i++){seen.add(wynik);wynik=String(zmiany[wynik]||wynik).trim();}
  return wynik;
}
function katalogiDaneAdmin(){
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),mapa=ustawienia.mapaProduktow||{};
  const wlasne=(ustawienia.wlasneKategorie||[]).map(rozwiazNazweKatalogu),ukryte=new Set((ustawienia.ukryteKategorie||[]).map(rozwiazNazweKatalogu));
  const nazwy=[...new Set([...produkty.map(p=>rozwiazNazweKatalogu(mapa[p.id]||p.kategoria)),...wlasne].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
  const liczby=Object.fromEntries(nazwy.map(k=>[k,0]));
  produkty.forEach(p=>{const k=rozwiazNazweKatalogu(mapa[p.id]||p.kategoria);liczby[k]=(liczby[k]||0)+1;});
  const rodzice=rodziceKategoriiMenu(),dozwolone=new Set(nazwy),zajete=new Set();
  const grupy=grupyMenuKategorii().map(g=>({...g,kategorie:[...new Set(g.kategorie.map(k=>{
    let root=k,seen=new Set();while(rodzice[root]&&dozwolone.has(rodzice[root])&&!seen.has(root)){seen.add(root);root=rodzice[root];}return root;
  }).filter(k=>dozwolone.has(k)).filter(k=>{if(zajete.has(k))return false;zajete.add(k);return true;}))]}));
  return {produkty,nazwy,liczby,rodzice,dozwolone,grupy,wlasne:new Set(wlasne),ukryte};
}
function katalogGrupaInfo(kategoria,nazwy=null,grupy=null,rodzice=null){
  const dane=nazwy?null:katalogiDaneAdmin(),lista=nazwy||dane.nazwy,gs=grupy||dane.grupy,parents=rodzice||dane.rodzice,dozwolone=new Set(lista);
  let root=String(kategoria||""),current=root,seen=new Set();
  for(let i=0;i<8&&parents[current]&&dozwolone.has(parents[current])&&!seen.has(current);i++){seen.add(current);current=parents[current];}
  root=current;
  const direct=gs.find(g=>g.kategorie.includes(kategoria)),inherited=direct?null:gs.find(g=>g.kategorie.includes(root));
  return {grupa:direct||inherited||null,bezposrednio:!!direct,dziedziczone:!direct&&!!inherited,root};
}
function katalogPotomkowie(kategoria,nazwy,rodzice){
  const wynik=new Set(),kolejka=[String(kategoria||"")];
  while(kolejka.length){const parent=kolejka.shift();nazwy.filter(k=>rodzice[k]===parent&&!wynik.has(k)).forEach(k=>{wynik.add(k);kolejka.push(k);});}
  return wynik;
}
function katalogSciezkaHTML(kategoria,dane){
  const info=katalogGrupaInfo(kategoria,dane.nazwy,dane.grupy,dane.rodzice),parts=[];let current=kategoria,seen=new Set();
  while(dane.rodzice[current]&&dane.dozwolone.has(dane.rodzice[current])&&!seen.has(current)){seen.add(current);parts.unshift(dane.rodzice[current]);current=dane.rodzice[current];}
  if(info.grupa)parts.unshift(`${info.grupa.ikona||"🗂️"} ${info.grupa.nazwa}`);parts.push(kategoria);
  return `<span class="catalog-path">${parts.map((x,i)=>`<span class="${i===parts.length-1?"current":""}">${esc(x)}</span>`).join("<i>›</i>")}</span>`;
}
function ustawFiltrKatalogowAdmin(value){filtrKatalogowAdmin=String(value||"wszystkie");renderuj();}
function katalogiSzukaj(input){szukajKatalogowAdmin=String(input?.value||"");clearTimeout(window.__catalogSearch);window.__catalogSearch=setTimeout(()=>renderuj(),220);}

function widokAdminKategorie(){
  const d=katalogiDaneAdmin(),roots=d.nazwy.filter(k=>!d.rodzice[k]||!d.dozwolone.has(d.rodzice[k]));
  const infos=Object.fromEntries(d.nazwy.map(k=>[k,katalogGrupaInfo(k,d.nazwy,d.grupy,d.rodzice)]));
  const przypisane=d.nazwy.filter(k=>infos[k].grupa),podkatalogi=d.nazwy.filter(k=>infos[k].root!==k),wolne=roots.filter(k=>!infos[k].grupa),puste=d.nazwy.filter(k=>!d.liczby[k]),ukryte=d.nazwy.filter(k=>d.ukryte.has(k));
  const term=normalizujSzukanyTekst(szukajKatalogowAdmin);
  const widoczne=d.nazwy.filter(k=>{
    const info=infos[k],pasuje=!term||normalizujSzukanyTekst([k,info.grupa?.nazwa,d.rodzice[k]].join(" ")).includes(term);
    if(!pasuje)return false;
    if(filtrKatalogowAdmin==="przypisane")return !!info.grupa;
    if(filtrKatalogowAdmin==="wolne")return !info.grupa&&info.root===k;
    if(filtrKatalogowAdmin==="podkatalogi")return info.root!==k;
    if(filtrKatalogowAdmin==="ukryte")return d.ukryte.has(k);
    if(filtrKatalogowAdmin==="puste")return !d.liczby[k];
    return true;
  }).sort((a,b)=>infos[a].root.localeCompare(infos[b].root,"pl")||(a===infos[a].root?-1:b===infos[b].root?1:a.localeCompare(b,"pl")));
  const grupaOpcje=(selected="")=>`<option value="">Bez grupy menu</option>${d.grupy.map(g=>`<option value="${esc(g.id)}" ${g.id===selected?"selected":""}>${esc(g.ikona)} ${esc(g.nazwa)}</option>`).join("")}`;
  const parentOpcje=(kategoria="")=>`<option value="">Katalog główny</option>${d.nazwy.filter(k=>k!==kategoria&&!katalogPotomkowie(kategoria,d.nazwy,d.rodzice).has(k)).map(k=>`<option value="${esc(k)}" ${d.rodzice[kategoria]===k?"selected":""}>${esc(k)}</option>`).join("")}`;
  const groupCards=d.grupy.map((g,index)=>{
    const direct=roots.filter(k=>g.kategorie.includes(k)),effective=d.nazwy.filter(k=>infos[k].grupa?.id===g.id),productCount=effective.reduce((sum,k)=>sum+(d.liczby[k]||0),0);
    return `<article class="catalog-group-card ${g.aktywna?"":"is-muted"}"><header><div class="catalog-group-title"><span>${esc(g.ikona||"🗂️")}</span><div><small>GRUPA MENU ${index+1}</small><h3>${esc(g.nazwa)}</h3></div></div><span class="catalog-status ${g.aktywna?"assigned":"hidden"}">${g.aktywna?"widoczna":"ukryta"}</span></header><div class="catalog-group-metrics"><span><b>${direct.length}</b> katalogów głównych</span><span><b>${Math.max(0,effective.length-direct.length)}</b> podkatalogów</span><span><b>${productCount}</b> produktów</span></div><form class="catalog-group-editor" onsubmit="zapiszGrupeMenuKategorii(event,${jsArg(g.id)})"><label>Ikona${emojiPoleHTML("ikona",g.ikona||"🗂️","🗂️")}</label><label>Nazwa<input name="nazwa" value="${esc(g.nazwa)}" required></label><label class="catalog-check"><input type="checkbox" name="aktywna" ${g.aktywna?"checked":""}> Widoczna</label><div class="catalog-group-actions"><button class="btn ghost" type="button" onclick="przesunGrupeMenuKategorii(${jsArg(g.id)},-1)" ${index===0?"disabled":""}>↑</button><button class="btn ghost" type="button" onclick="przesunGrupeMenuKategorii(${jsArg(g.id)},1)" ${index===d.grupy.length-1?"disabled":""}>↓</button><button class="btn" type="submit">Zapisz</button><button class="btn danger" type="button" onclick="if(confirm('Usunąć grupę menu? Katalogi i produkty pozostaną.')) usunGrupeMenuKategorii(${jsArg(g.id)})">Usuń</button></div></form><div class="catalog-assignment-head"><b>Przypięte katalogi</b><button class="btn ghost" type="button" onclick="ustawKategorieWGrupie(${jsArg(g.id)},'wolne')">＋ Przypisz wolne</button><button class="btn ghost" type="button" onclick="ustawKategorieWGrupie(${jsArg(g.id)},'puste')" ${direct.length?"":"disabled"}>Wyczyść</button></div><div class="catalog-assignment-grid">${roots.map(k=>{const info=infos[k],own=info.grupa?.id===g.id,elsewhere=info.grupa&&!own,children=d.nazwy.filter(x=>d.rodzice[x]===k).length;return `<label class="catalog-assignment ${own?"is-assigned":elsewhere?"is-elsewhere":"is-free"}"><input type="checkbox" ${own?"checked":""} onchange="przelaczKategorieWGrupie(${jsArg(g.id)},${jsArg(k)},this.checked)"><span><b>${esc(k)}</b><small>${d.liczby[k]||0} produktów • ${children} podkatalogów</small>${elsewhere?`<em>obecnie: ${esc(info.grupa.nazwa)}</em>`:own?`<em>przypięty do tej grupy</em>`:`<em>nieprzypisany</em>`}</span></label>`;}).join("")||`<div class="catalog-empty">Brak katalogów głównych.</div>`}</div></article>`;
  }).join("");
  return asortymentSzkielet("kategorie",`<section class="panel catalog-architecture-hero"><div><span class="order-pro-label">Architektura sklepu</span><h1>🗂️ Katalogi, grupy i podkatalogi</h1><p>Kontroluj strukturę <b>grupa menu → katalog → podkatalog → produkt</b>. Zmiana poziomu nie przenosi ani nie usuwa produktów.</p></div><div class="diag-actions"><button class="btn ghost" onclick="przygotujKatalogImprezowyGoDan()">🎈 Przygotuj GoDan i imprezy</button><a class="btn" href="#/admin/asortyment/mapowanie">🧩 Otwórz mapowanie</a></div></section>
  <section class="catalog-stat-grid">${[["wszystkie","🗂️",d.nazwy.length,"wszystkich katalogów"],["przypisane","🔗",przypisane.length,"przypiętych do grup"],["podkatalogi","↳",podkatalogi.length,"podkatalogów"],["wolne","⚠️",wolne.length,"nieprzypisanych"],["puste","📭",puste.length,"bez produktów"],["ukryte","🙈",ukryte.length,"ukrytych"]].map(([id,icon,count,label])=>`<button class="catalog-stat-card ${filtrKatalogowAdmin===id?"active":""}" onclick="ustawFiltrKatalogowAdmin(${jsArg(id)})"><span>${icon}</span><b>${count}</b><small>${label}</small></button>`).join("")}</section>
  <section class="panel catalog-create-panel"><div class="order-section-head"><div><h2>＋ Dodaj katalog lub podkatalog</h2><p class="order-detail-lead">Nowy poziom możesz od razu osadzić pod istniejącym katalogiem albo przypiąć katalog główny do grupy menu.</p></div></div><form onsubmit="dodajKatalog(event)" class="catalog-create-form"><label>Nazwa katalogu<input required name="nazwa" placeholder="np. Balony cyfry" maxlength="60"></label><label>Katalog nadrzędny<select name="rodzic">${parentOpcje()}</select></label><label>Grupa menu dla katalogu głównego<select name="grupa">${grupaOpcje()}</select></label><button class="btn" type="submit">＋ Utwórz katalog</button></form><small class="catalog-form-hint">Jeżeli wybierzesz katalog nadrzędny, grupa menu zostanie odziedziczona automatycznie.</small></section>
  <section class="panel catalog-groups-panel"><div class="order-section-head"><div><h2>🧭 Grupy menu i przypięcia</h2><p class="order-detail-lead">Każdy katalog główny może być przypięty tylko do jednej grupy. Zaznaczenie go w innej grupie bezpiecznie przenosi samo przypięcie.</p></div><label class="catalog-check"><input type="checkbox" ${ustawienia.menuPokazNieprzypisane!==false?"checked":""} onchange="przelaczNieprzypisaneMenu(this.checked)"> Pokaż nieprzypisane w menu sklepu</label></div><form onsubmit="dodajGrupeMenuKategorii(event)" class="catalog-new-group-form"><label>Nazwa nowej grupy<input required name="nazwa" placeholder="np. Gry i zabawki"></label><label>Ikona${emojiPoleHTML("ikona","🗂️","🗂️")}</label><button class="btn" type="submit">＋ Dodaj grupę</button></form><div class="catalog-groups-grid">${groupCards||`<div class="catalog-empty">Nie ma grup menu. Dodaj pierwszą grupę powyżej.</div>`}</div></section>
  ${wolne.length?`<section class="panel catalog-unassigned-panel"><div class="order-section-head"><div><h2>⚠️ Nieprzypisane katalogi (${wolne.length})</h2><p class="order-detail-lead">Te katalogi główne nie należą do żadnej grupy. Możesz przypiąć je pojedynczo; ich podkatalogi przejmą to ustawienie.</p></div></div><div class="catalog-unassigned-grid">${wolne.map(k=>`<article><div><b>${esc(k)}</b><small>${d.liczby[k]||0} produktów • ${d.nazwy.filter(x=>d.rodzice[x]===k).length} podkatalogów</small></div><select onchange="przypiszKatalogDoGrupy(${jsArg(k)},this.value)">${grupaOpcje()}</select></article>`).join("")}</div></section>`:""}
  <section class="panel catalog-inventory-panel"><div class="order-section-head"><div><h2>📚 Rejestr katalogów (${widoczne.length}/${d.nazwy.length})</h2><p class="order-detail-lead">Pełna kontrola poziomu, ścieżki menu, widoczności i liczby produktów.</p></div></div>${adminWyszukiwaniePanelHTML({id:"katalogi",description:"Szukaj po nazwie katalogu, grupie menu albo katalogu nadrzędnym.",results:widoczne.length,active:!!term||filtrKatalogowAdmin!=="wszystkie",fields:`<label class="admin-search-wide">Nazwa, grupa lub katalog nadrzędny<input value="${esc(szukajKatalogowAdmin)}" placeholder="Szukaj katalogu…" oninput="katalogiSzukaj(this)"></label><label>Status<select onchange="ustawFiltrKatalogowAdmin(this.value)">${[["wszystkie","Wszystkie"],["przypisane","Przypięte do grup"],["wolne","Nieprzypisane"],["podkatalogi","Podkatalogi"],["puste","Bez produktów"],["ukryte","Ukryte"]].map(([v,l])=>`<option value="${v}" ${filtrKatalogowAdmin===v?"selected":""}>${l}</option>`).join("")}</select></label>`,actions:`<button class="btn ghost" onclick="szukajKatalogowAdmin='';filtrKatalogowAdmin='wszystkie';renderuj()">Wyczyść filtry</button>`})}<div class="catalog-table-wrap"><table class="log-table catalog-inventory-table"><thead><tr><th>Katalog i ścieżka</th><th>Status grupy</th><th>Poziom</th><th>Produktów</th><th>Struktura</th><th>Akcje</th></tr></thead><tbody>${widoczne.map(k=>{const info=infos[k],parent=d.rodzice[k]||"",children=d.nazwy.filter(x=>d.rodzice[x]===k).length,hidden=d.ukryte.has(k),own=d.wlasne.has(k),idKat=btoa(encodeURIComponent(k)).replace(/[^a-zA-Z0-9]/g,"");return `<tr class="${hidden?"is-muted":""}"><td><div class="catalog-name-cell"><span>${parent?"↳":"🗂️"}</span><div><b>${esc(k)}</b>${katalogSciezkaHTML(k,d)}<small>${own?"katalog własny":"katalog z produktów"}${children?` • ${children} podkatalogów`:""}</small></div></div></td><td>${info.grupa?`<span class="catalog-status ${info.dziedziczone?"inherited":"assigned"}">${info.dziedziczone?"dziedziczy":"przypięty"}: ${esc(info.grupa.nazwa)}</span>`:`<span class="catalog-status unassigned">nieprzypisany</span>`}</td><td><span class="catalog-level">${parent?"Podkatalog":"Katalog główny"}</span></td><td><b>${d.liczby[k]||0}</b>${d.liczby[k]?` <a href="#/kategoria/${encodeURIComponent(k)}">podgląd</a>`:""}</td><td><div class="catalog-structure-controls"><label>Nadrzędny<select onchange="ustawPodkatalog(${jsArg(k)},this.value)">${parentOpcje(k)}</select></label>${parent?`<small>Grupa jest dziedziczona po „${esc(info.root)}”.</small>`:`<label>Grupa menu<select onchange="przypiszKatalogDoGrupy(${jsArg(k)},this.value)">${grupaOpcje(info.grupa?.id||"")}</select></label>`}</div></td><td><div class="catalog-row-actions"><input id="kat_${idKat}" value="${esc(k)}" aria-label="Nowa nazwa katalogu"><button class="btn ghost" onclick="zmienKategorie(${jsArg(k)},$('kat_${idKat}').value)">Zmień nazwę</button><button class="btn ghost" onclick="otworzDodawanieProduktu(${jsArg(k)})">＋ Produkt</button><a class="btn ghost" href="#/admin/asortyment/mapowanie" onclick="filtrMapowania=${jsArg(k)}">🧩 Mapuj</a><button class="btn ghost" onclick="przelaczKategorie(${jsArg(k)})">${hidden?"👁️ Pokaż":"🙈 Ukryj"}</button>${own&&!d.liczby[k]?`<button class="btn danger" onclick="if(confirm('Usunąć pusty katalog?')) usunKatalog(${jsArg(k)})">Usuń</button>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="6"><div class="catalog-empty">Brak katalogów pasujących do filtrów.</div></td></tr>`}</tbody></table></div></section>`);
}

function przypiszKatalogDoGrupy(katalog,groupId){
  const d=katalogiDaneAdmin(),root=katalogGrupaInfo(katalog,d.nazwy,d.grupy,d.rodzice).root,grupy=d.grupy.map(g=>({...g,kategorie:g.kategorie.filter(k=>k!==root&&k!==katalog)}));
  const target=grupy.find(g=>g.id===String(groupId||""));if(target)target.kategorie=[...new Set([...target.kategorie,root])];
  loguj("info",target?`Przypięto katalog ${root} do grupy ${target.nazwa}`:`Odłączono katalog ${root} od grup menu`);zapiszGrupyMenuKategorii(grupy);
}
function zapiszGrupeMenuKategorii(e,id){
  e.preventDefault();const f=new FormData(e.target),d=katalogiDaneAdmin(),i=d.grupy.findIndex(g=>g.id===id);if(i<0)return;
  d.grupy[i]={...d.grupy[i],nazwa:String(f.get("nazwa")||"").trim()||d.grupy[i].nazwa,ikona:String(f.get("ikona")||"🗂️").trim()||"🗂️",aktywna:!!f.get("aktywna"),kategorie:d.grupy[i].kategorie.filter(k=>d.dozwolone.has(k))};
  loguj("info","Zapisano grupę menu kategorii: "+d.grupy[i].nazwa);zapiszGrupyMenuKategorii(d.grupy);
}
function ustawPodkatalog(katalog,rodzic){
  const d=katalogiDaneAdmin(),parent=String(rodzic||"");
  if(parent&&(parent===katalog||katalogPotomkowie(katalog,d.nazwy,d.rodzice).has(parent))){toast("Nie można utworzyć pętli w katalogach");renderuj();return;}
  const poprzedniaGrupa=katalogGrupaInfo(katalog,d.nazwy,d.grupy,d.rodzice).grupa,parents={...d.rodzice};if(parent)parents[katalog]=parent;else delete parents[katalog];
  const grupy=d.grupy.map(g=>({...g,kategorie:g.kategorie.filter(k=>k!==katalog)}));
  if(parent&&poprzedniaGrupa){let root=parent,seen=new Set();while(parents[root]&&!seen.has(root)){seen.add(root);root=parents[root];}if(!grupy.some(g=>g.kategorie.includes(root))){const g=grupy.find(x=>x.id===poprzedniaGrupa.id);if(g)g.kategorie=[...new Set([...g.kategorie,root])];}}
  ustawienia.rodziceKategorii=parents;ustawienia.menuKategorii=grupy;loguj("info",parent?`Ustawiono podkatalog ${katalog} → ${parent}`:`Przeniesiono ${katalog} na poziom główny`);zapiszCzescUstawien({rodziceKategorii:parents,menuKategorii:grupy});
}
function dodajKatalog(e){
  e.preventDefault();const f=new FormData(e.target),k=String(f.get("nazwa")||"").trim(),parent=String(f.get("rodzic")||"").trim(),groupId=String(f.get("grupa")||"");const d=katalogiDaneAdmin();
  if(k.length<2){toast("Nazwa musi mieć minimum 2 znaki");return;}if(d.nazwy.some(x=>normalizujSzukanyTekst(x)===normalizujSzukanyTekst(k))){toast("Taki katalog już istnieje");return;}
  const wlasne=[...(ustawienia.wlasneKategorie||[]),k],parents={...d.rodzice};if(parent&&d.dozwolone.has(parent))parents[k]=parent;
  const grupy=d.grupy.map(g=>({...g,kategorie:[...g.kategorie]}));if(!parent&&groupId){const g=grupy.find(x=>x.id===groupId);if(g)g.kategorie.push(k);}
  loguj("info",parent?`Utworzono podkatalog ${k} w ${parent}`:`Utworzono katalog ${k}`);zapiszCzescUstawien({wlasneKategorie:wlasne,rodziceKategorii:parents,menuKategorii:grupy});
}
function usunKatalog(k){
  const parents={...rodziceKategoriiMenu()};delete parents[k];Object.keys(parents).forEach(child=>{if(parents[child]===k)delete parents[child];});
  const wlasne=(ustawienia.wlasneKategorie||[]).filter(x=>x!==k),grupy=grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.filter(x=>x!==k)}));loguj("info","Usunięto pusty katalog: "+k);zapiszCzescUstawien({wlasneKategorie:wlasne,rodziceKategorii:parents,menuKategorii:grupy});
}
function przelaczKategorieWGrupie(id,kat,wl){
  const d=katalogiDaneAdmin(),root=katalogGrupaInfo(kat,d.nazwy,d.grupy,d.rodzice).root,grupy=d.grupy.map(g=>({...g,kategorie:g.kategorie.filter(k=>k!==root&&k!==kat)})),target=grupy.find(g=>g.id===id);if(!target)return;if(wl)target.kategorie=[...new Set([...target.kategorie,root])];zapiszGrupyMenuKategorii(grupy);
}
function ustawKategorieWGrupie(id,tryb){
  const d=katalogiDaneAdmin(),roots=d.nazwy.filter(k=>!d.rodzice[k]||!d.dozwolone.has(d.rodzice[k])),grupy=d.grupy.map(g=>({...g,kategorie:[...g.kategorie]})),target=grupy.find(g=>g.id===id);if(!target)return;
  if(tryb==="puste")target.kategorie=[];else{const zajete=new Set(grupy.filter(g=>g.id!==id).flatMap(g=>g.kategorie));target.kategorie=[...new Set([...target.kategorie,...roots.filter(k=>!zajete.has(k))])];}zapiszGrupyMenuKategorii(grupy);
}
function zmienKategorie(stara,nowa){
  nowa=String(nowa||"").trim();const d=katalogiDaneAdmin();if(!nowa||nowa===stara){toast("Wpisz inną nazwę");return;}if(d.nazwy.some(k=>k!==stara&&normalizujSzukanyTekst(k)===normalizujSzukanyTekst(nowa))){toast("Katalog o tej nazwie już istnieje");return;}
  const parents={...d.rodzice};if(parents[stara]){parents[nowa]=parents[stara];delete parents[stara];}Object.keys(parents).forEach(k=>{if(parents[k]===stara)parents[k]=nowa;});
  const groups=d.grupy.map(g=>({...g,kategorie:[...new Set(g.kategorie.map(k=>k===stara?nowa:k))]})),own=(ustawienia.wlasneKategorie||[]).map(k=>k===stara?nowa:k),hidden=(ustawienia.ukryteKategorie||[]).map(k=>k===stara?nowa:k),icons={...(ustawienia.ikonyKategorii||{})};if(icons[stara]){icons[nowa]=icons[stara];delete icons[stara];}
  ustawienia.kategorie={...(ustawienia.kategorie||{}),[stara]:nowa};if(aktywnaKategoria===stara)aktywnaKategoria=nowa;loguj("info",`Zmieniono katalog: ${stara} → ${nowa}`);zapiszCzescUstawien({kategorie:ustawienia.kategorie,menuKategorii:groups,rodziceKategorii:parents,wlasneKategorie:own,ukryteKategorie:hidden,ikonyKategorii:icons});
}

/* ── Mapowanie produktów ── */
function mapowanieMaWlasnyWpis(mapa,id){return Object.prototype.hasOwnProperty.call(mapa,String(id))||Object.prototype.hasOwnProperty.call(mapa,id);}
function produktyMapowaniaAdmin(){
  const d=katalogiDaneAdmin(),mapa=ustawienia.mapaProduktow||{};
  return d.produkty.map(p=>{const source=rozwiazNazweKatalogu(p.kategoria),manual=mapowanieMaWlasnyWpis(mapa,p.id),target=rozwiazNazweKatalogu(manual?mapa[p.id]:source),info=katalogGrupaInfo(target,d.nazwy,d.grupy,d.rodzice),invalid=!d.dozwolone.has(target);return {p,source,target,manual,changed:manual&&target!==source,invalid,info};});
}
function mapowanieStatusWiersza(row){if(row.invalid)return "brak";if(!row.info.grupa)return "bez-grupy";if(row.changed)return "zmienione";if(row.manual)return "reczne";if(row.info.root!==row.target)return "podkatalog";return "zrodlo";}
function filtrujProduktyMapowania(){
  let rows=produktyMapowaniaAdmin(),q=normalizujSzukanyTekst(szukajMapowania);
  rows=rows.filter(x=>{
    const pasujeTekst=!q||produktPasujeFrazie(x.p,q)||normalizujSzukanyTekst([x.source,x.target,x.info.grupa?.nazwa].join(" ")).includes(q);
    const pasujeKatalog=filtrMapowania==="Wszystkie"||x.target===filtrMapowania;
    const pasujeStatus=filtrStatusuMapowania==="wszystkie"||mapowanieStatusWiersza(x)===filtrStatusuMapowania;
    const pasujeGrupa=filtrGrupyMapowania==="wszystkie"||(filtrGrupyMapowania==="bez-grupy"?!x.info.grupa:x.info.grupa?.id===filtrGrupyMapowania);
    const pasujeProducent=filtrProducentaMapowania==="wszyscy"||String(x.p.producent||x.p.marka||"Nieprzypisany")===filtrProducentaMapowania;
    return pasujeTekst&&pasujeKatalog&&pasujeStatus&&pasujeGrupa&&pasujeProducent;
  });
  rows.sort((a,b)=>sortMapowania==="katalog"?a.target.localeCompare(b.target,"pl")||a.p.nazwa.localeCompare(b.p.nazwa,"pl"):sortMapowania==="status"?mapowanieStatusWiersza(a).localeCompare(mapowanieStatusWiersza(b),"pl")||a.p.nazwa.localeCompare(b.p.nazwa,"pl"):sortMapowania==="producent"?String(a.p.producent||a.p.marka||"").localeCompare(String(b.p.producent||b.p.marka||""),"pl"):a.p.nazwa.localeCompare(b.p.nazwa,"pl"));return rows;
}
function mapowanieSzukajProdukty(input){szukajMapowania=String(input?.value||"");stronaMapowania=1;clearTimeout(window.__mappingSearch);window.__mappingSearch=setTimeout(()=>renderuj(),220);}
function mapowanieUstawFiltr(pole,value){if(pole==="status")filtrStatusuMapowania=value;else if(pole==="grupa")filtrGrupyMapowania=value;else if(pole==="producent")filtrProducentaMapowania=value;else if(pole==="katalog")filtrMapowania=value;else if(pole==="sort")sortMapowania=value;stronaMapowania=1;renderuj();}
function mapowanieWyczyscFiltry(){szukajMapowania="";filtrMapowania="Wszystkie";filtrStatusuMapowania="wszystkie";filtrGrupyMapowania="wszystkie";filtrProducentaMapowania="wszyscy";sortMapowania="nazwa";stronaMapowania=1;renderuj();}
function ustawStroneMapowania(n){stronaMapowania=Math.max(1,Number(n)||1);renderuj();document.querySelector(".mapping-workspace")?.scrollIntoView({behavior:"smooth",block:"start"});}
function ustawMapowaniaNaStronie(n){mapowaniaNaStronie=[25,50,100,200,500,1000].includes(Number(n))?Number(n):50;stronaMapowania=1;zapiszLS("artway_mapowanie_na_stronie",mapowaniaNaStronie);renderuj();}
function widokAdminMapowanie(){
  const d=katalogiDaneAdmin(),all=produktyMapowaniaAdmin(),rows=filtrujProduktyMapowania(),pages=Math.max(1,Math.ceil(rows.length/mapowaniaNaStronie));stronaMapowania=Math.min(stronaMapowania,pages);const page=rows.slice((stronaMapowania-1)*mapowaniaNaStronie,stronaMapowania*mapowaniaNaStronie);mapowanieWynikiIds=rows.map(x=>String(x.p.id));mapowanieStronaIds=page.map(x=>String(x.p.id));
  const counts={reczne:all.filter(x=>x.manual).length,zrodlo:all.filter(x=>!x.manual).length,zmienione:all.filter(x=>x.changed).length,brak:all.filter(x=>x.invalid).length,"bez-grupy":all.filter(x=>!x.info.grupa).length};
  const producers=[...new Set(all.map(x=>String(x.p.producent||x.p.marka||"Nieprzypisany")))].sort((a,b)=>a.localeCompare(b,"pl")),selected=[...zaznaczoneMap].filter(id=>all.some(x=>String(x.p.id)===String(id))).length;
  const categoryOptions=(selectedValue="")=>d.nazwy.map(k=>`<option value="${esc(k)}" ${k===selectedValue?"selected":""}>${esc(k)}</option>`).join("");
  return asortymentSzkielet("mapowanie",`<section class="panel mapping-hero"><div><span class="order-pro-label">Kontrola danych produktowych</span><h1>🧩 Mapowanie produktów do katalogów</h1><p>Rozróżniamy kategorię źródłową produktu od ręcznego mapowania. Dzięki temu wiadomo, które przypisania są automatyczne, zmienione lub wymagają naprawy.</p></div><div class="diag-actions"><button class="btn" onclick="otworzDodawanieProduktu(filtrMapowania==='Wszystkie'?'':filtrMapowania)">＋ Dodaj produkt</button><a class="btn ghost" href="#/admin/asortyment/kategorie">🗂️ Zarządzaj katalogami</a></div></section>
  <section class="catalog-stat-grid mapping-stat-grid">${[["wszystkie","📦",all.length,"wszystkich produktów"],["reczne","🧩",counts.reczne,"mapowań ręcznych"],["zrodlo","↩️",counts.zrodlo,"z kategorii źródłowej"],["zmienione","🔀",counts.zmienione,"zmienionych katalogów"],["brak","⚠️",counts.brak,"brakujących katalogów"],["bez-grupy","🔗",counts["bez-grupy"],"katalogów bez grupy"]].map(([id,icon,count,label])=>`<button class="catalog-stat-card ${filtrStatusuMapowania===id||(id==="wszystkie"&&filtrStatusuMapowania==="wszystkie")?"active":""}" onclick="mapowanieUstawFiltr('status',${jsArg(id)})"><span>${icon}</span><b>${count}</b><small>${label}</small></button>`).join("")}</section>
  <section class="panel mapping-workspace">${adminWyszukiwaniePanelHTML({id:"mapowanie",description:"Szukaj po nazwie, ID, EXTERNAL_ID, SKU, EAN, producencie, katalogu lub grupie menu.",results:rows.length,active:!!szukajMapowania||filtrMapowania!=="Wszystkie"||filtrStatusuMapowania!=="wszystkie"||filtrGrupyMapowania!=="wszystkie"||filtrProducentaMapowania!=="wszyscy",fields:`<label class="admin-search-wide">Produkt, kod lub katalog<input value="${esc(szukajMapowania)}" placeholder="Nazwa, EXTERNAL_ID, SKU, EAN, producent…" oninput="mapowanieSzukajProdukty(this)"></label><label>Katalog docelowy<select onchange="mapowanieUstawFiltr('katalog',this.value)"><option value="Wszystkie">Wszystkie katalogi</option>${categoryOptions(filtrMapowania)}</select></label><label>Status mapowania<select onchange="mapowanieUstawFiltr('status',this.value)">${[["wszystkie","Wszystkie statusy"],["reczne","Ręcznie zmapowane"],["zrodlo","Kategoria źródłowa"],["zmienione","Zmieniony katalog"],["brak","Brak katalogu"],["bez-grupy","Katalog bez grupy"],["podkatalog","Podkatalog"]].map(([v,l])=>`<option value="${v}" ${filtrStatusuMapowania===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Grupa menu<select onchange="mapowanieUstawFiltr('grupa',this.value)"><option value="wszystkie">Wszystkie grupy</option><option value="bez-grupy" ${filtrGrupyMapowania==="bez-grupy"?"selected":""}>Bez grupy</option>${d.grupy.map(g=>`<option value="${esc(g.id)}" ${filtrGrupyMapowania===g.id?"selected":""}>${esc(g.ikona)} ${esc(g.nazwa)}</option>`).join("")}</select></label><label>Producent<select onchange="mapowanieUstawFiltr('producent',this.value)"><option value="wszyscy">Wszyscy producenci</option>${producers.map(v=>`<option value="${esc(v)}" ${filtrProducentaMapowania===v?"selected":""}>${esc(v)}</option>`).join("")}</select></label><label>Sortowanie<select onchange="mapowanieUstawFiltr('sort',this.value)">${[["nazwa","Nazwa A–Z"],["katalog","Katalog docelowy"],["status","Status mapowania"],["producent","Producent"]].map(([v,l])=>`<option value="${v}" ${sortMapowania===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Na stronie<select onchange="ustawMapowaniaNaStronie(this.value)">${[25,50,100,200,500,1000].map(n=>`<option value="${n}" ${mapowaniaNaStronie===n?"selected":""}>${n}</option>`).join("")}</select></label>`,actions:`<button class="btn ghost" onclick="mapowanieWyczyscFiltry()">Wyczyść filtry</button>`})}
  ${adminOperacjeWynikowHTML({id:"mapowanie",selected,pageCount:page.length,resultCount:rows.length,selectPage:"zaznaczMapowanieZakres('strona')",selectAll:"zaznaczMapowanieZakres('filtr')",clear:"odznaczMapowania()",exportSelected:"mapowanieEksportuj('zaznaczone')",exportAll:"mapowanieEksportuj('filtr')",extra:`<label class="mapping-bulk-target">Przenieś zaznaczone do <select id="mapCel">${categoryOptions()}</select></label><button class="btn" onclick="przeniesZaznaczone()" ${selected?"":"disabled"}>🧩 Przenieś</button><button class="btn ghost" onclick="usunMapowanieZaznaczonych()" ${selected?"":"disabled"}>↩️ Przywróć źródło</button>`})}
  <form onsubmit="dodajKatalogZMapowania(event)" class="mapping-create-catalog"><label>Szybkie utworzenie katalogu<input required name="nazwa" placeholder="Nazwa nowego katalogu…" maxlength="60"></label><button class="btn ghost" type="submit">＋ Utwórz katalog</button></form>
  <div class="mapping-table-wrap"><table class="log-table mapping-table"><thead><tr><th></th><th>Produkt</th><th>Kategoria źródłowa</th><th>Katalog docelowy</th><th>Położenie w menu</th><th>Status</th><th>Akcje</th></tr></thead><tbody>${page.map(x=>{const p=x.p,status=mapowanieStatusWiersza(x),checked=zaznaczoneMap.has(String(p.id))||zaznaczoneMap.has(p.id);return `<tr class="mapping-row status-${status} ${checked?"is-selected":""}"><td><input type="checkbox" ${checked?"checked":""} onchange="przelaczZaznaczenieMap(${jsArg(p.id)},this.checked)"></td><td><div class="mapping-product-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>ID ${esc(p.id)} • EXTERNAL_ID ${esc(p.externalId||"—")} • SKU ${esc(p.sku||"—")}</small><em>EAN ${esc(p.gtin||p.ean||"—")} • ${esc(p.producent||p.marka||"producent —")}</em></div></div></td><td><b>${esc(x.source||"Brak")}</b><small>wartość z kartoteki produktu</small></td><td><select class="mapping-target-select" onchange="mapujProdukt(${jsArg(p.id)},this.value)">${categoryOptions(x.target)}${x.invalid?`<option value="${esc(x.target)}" selected>⚠️ ${esc(x.target)}</option>`:""}</select>${x.changed?`<small>${esc(x.source)} → ${esc(x.target)}</small>`:""}</td><td>${x.info.grupa?`<span class="catalog-status ${x.info.dziedziczone?"inherited":"assigned"}">${x.info.dziedziczone?"dziedziczy":"grupa"}: ${esc(x.info.grupa.nazwa)}</span><small>${esc(x.info.root)}${x.info.root!==x.target?` › ${esc(x.target)}`:""}</small>`:`<span class="catalog-status unassigned">bez grupy menu</span>`}</td><td><span class="mapping-status ${status}">${status==="reczne"?"ręczne mapowanie":status==="zmienione"?"zmieniony katalog":status==="brak"?"brak katalogu":status==="bez-grupy"?"bez grupy":status==="podkatalog"?"podkatalog":"kategoria źródłowa"}</span></td><td><div class="mapping-row-actions"><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj</a>${x.manual?`<button class="btn ghost" onclick="usunMapowanieProduktu(${jsArg(p.id)})">↩️ Przywróć źródło</button>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="7"><div class="catalog-empty">Brak produktów pasujących do filtrów.</div></td></tr>`}</tbody></table></div><div class="mapping-pagination"><span>Pokazano ${page.length} z ${rows.length}</span><div class="pagination">${paginacjaHTML(stronaMapowania,pages,"ustawStroneMapowania")}</div></div></section>`);
}
function przelaczZaznaczenieMap(id,checked){const key=String(id);if(checked===undefined?(zaznaczoneMap.has(key)||zaznaczoneMap.has(id)):!checked){zaznaczoneMap.delete(key);zaznaczoneMap.delete(id);}else zaznaczoneMap.add(key);renderuj();}
function zaznaczMapowanieZakres(scope){(scope==="strona"?mapowanieStronaIds:mapowanieWynikiIds).forEach(id=>zaznaczoneMap.add(String(id)));renderuj();}
function zaznaczWszystkieMapowania(){zaznaczMapowanieZakres("filtr");}
function odznaczMapowania(){zaznaczoneMap.clear();renderuj();}
function mapowanieEksportuj(scope){const rows=produktyMapowaniaAdmin().filter(x=>scope==="filtr"?mapowanieWynikiIds.includes(String(x.p.id)):zaznaczoneMap.has(String(x.p.id)));adminEksportujCSV(`mapowanie-produktow-${new Date().toISOString().slice(0,10)}.csv`,["ID","EXTERNAL_ID","SKU","EAN","Nazwa","Producent","Kategoria źródłowa","Katalog docelowy","Grupa menu","Status"],rows.map(x=>[x.p.id,x.p.externalId||"",x.p.sku||"",x.p.gtin||x.p.ean||"",x.p.nazwa||"",x.p.producent||x.p.marka||"",x.source,x.target,x.info.grupa?.nazwa||"",mapowanieStatusWiersza(x)]));}
function przeniesZaznaczone(){const cel=$("mapCel")?.value;if(!cel||!zaznaczoneMap.size){toast("Zaznacz produkty i wybierz katalog docelowy");return;}const mapa={...(ustawienia.mapaProduktow||{})};zaznaczoneMap.forEach(id=>mapa[id]=cel);loguj("info",`Przemapowano ${zaznaczoneMap.size} produktów → ${cel}`);zaznaczoneMap.clear();zapiszCzescUstawien({mapaProduktow:mapa});}
function usunMapowanieZaznaczonych(){if(!zaznaczoneMap.size){toast("Zaznacz produkty");return;}const mapa={...(ustawienia.mapaProduktow||{})},count=zaznaczoneMap.size;zaznaczoneMap.forEach(id=>delete mapa[id]);zaznaczoneMap.clear();loguj("info",`Przywrócono kategorię źródłową dla ${count} produktów`);zapiszCzescUstawien({mapaProduktow:mapa});}
function wyczyscMapowanie(){if(!confirm("Usunąć wszystkie ręczne mapowania? Produkty wrócą do kategorii źródłowych."))return;zaznaczoneMap.clear();loguj("info","Wyczyszczono mapowanie produktów");zapiszCzescUstawien({mapaProduktow:{}});}
