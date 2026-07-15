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
