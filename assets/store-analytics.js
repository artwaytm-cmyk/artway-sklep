/* GENERATED STORE ANALYTICS — loaded after the first storefront render */
/* Anonimowy pomiar efektów SEO. Zapisuje wyłącznie dzienne sumy kanałów, domen wejścia i konwersji. */
const SEO_DOMENY=new Set(["artwaytm.pl","allsklep.pl"]);
function seoNormalizujDomene(value=""){const host=String(value||"").toLowerCase().replace(/^www\./,"").split(":")[0];return SEO_DOMENY.has(host)?host:"";}
function seoBezpiecznaSciezka(value="/"){const path=String(value||"/").split(/[?#]/)[0].replace(/[\u0000-\u001f\u007f]/g,"").slice(0,180);return path.startsWith("/")?path:"/";}
function seoUsunZnacznikDomeny(){try{const url=new URL(location.href);if(!url.searchParams.has("entry_domain"))return;url.searchParams.delete("entry_domain");history.replaceState(history.state,"",`${url.pathname}${url.search}${url.hash}`);}catch(e){}}
function seoKanalZHosta(host=""){
  const value=String(host||"").toLowerCase();
  if(/(^|\.)google\./.test(value))return "google";
  if(/(^|\.)bing\.com$/.test(value))return "bing";
  if(/(^|\.)duckduckgo\.com$/.test(value))return "duckduckgo";
  if(/(^|\.)yahoo\./.test(value))return "yahoo";
  if(/(^|\.)ecosia\.org$/.test(value))return "ecosia";
  if(/(^|\.)(?:search\.brave\.com|qwant\.com|startpage\.com|yandex\.[a-z.]+|seznam\.cz)$/.test(value))return "other_search";
  return "";
}
function seoAtrybucjaSesji(route="/"){
  try{
    const stored=JSON.parse(sessionStorage.getItem("artway_seo_attribution_v2")||"null");if(stored?.entryDomain&&stored?.channel)return stored;
    const url=new URL(location.href),own=seoNormalizujDomene(location.hostname)||"artwaytm.pl",via=seoNormalizujDomene(url.searchParams.get("entry_domain")),referrer=document.referrer?new URL(document.referrer):null,referrerHost=String(referrer?.hostname||"").toLowerCase().replace(/^www\./,""),searchChannel=seoKanalZHosta(referrerHost),campaignName=String(url.searchParams.get("utm_campaign")||url.searchParams.get("utm_source")||"").toLowerCase().replace(/[^a-z0-9_.-]/g,"").slice(0,80);
    const externalReferrer=referrerHost&&!SEO_DOMENY.has(referrerHost)?referrerHost.replace(/[^a-z0-9.-]/g,"").slice(0,120):"";
    const attribution={entryDomain:via||own,landingPath:seoBezpiecznaSciezka(route||location.pathname),channel:searchChannel||(campaignName?"campaign":externalReferrer?"referral":"direct"),campaign:campaignName,referrerDomain:externalReferrer};
    sessionStorage.setItem("artway_seo_attribution_v2",JSON.stringify(attribution));seoUsunZnacznikDomeny();return attribution;
  }catch(e){return {entryDomain:"artwaytm.pl",landingPath:seoBezpiecznaSciezka(route),channel:"direct",campaign:"",referrerDomain:""};}
}
function seoWyslijZdarzenie(event,data={}){
  const attribution=seoAtrybucjaSesji(data.route||trasa());if(!attribution.channel||jestAdmin())return;
  const body={event,channel:attribution.channel,entryDomain:attribution.entryDomain,landingPath:attribution.landingPath,campaign:attribution.campaign,referrerDomain:attribution.referrerDomain,productId:data.productId||"",value:Math.max(0,Number(data.value)||0),items:Array.isArray(data.items)?data.items.slice(0,100):[]};
  fetch("/api/seo/event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),keepalive:true,credentials:"omit"}).catch(()=>{});
}
function seoSledzTrase(route="/"){
  if(String(route).startsWith("/admin"))return;seoAtrybucjaSesji(route);
  try{
    if(!sessionStorage.getItem("artway_seo_landing")){sessionStorage.setItem("artway_seo_landing","1");seoWyslijZdarzenie("landing",{route});}
    if(String(route).startsWith("/produkt/")){
      const id=String(route).split("/")[2]||"",key=`artway_seo_view_${id}`;
      if(id&&!sessionStorage.getItem(key)){sessionStorage.setItem(key,"1");seoWyslijZdarzenie("product_view",{productId:id});}
    }
  }catch(e){}
}
function seoSledzKoszyk(productId){seoWyslijZdarzenie("add_to_cart",{productId});}
function seoSledzZamowienie(value,orderId="",items=[]){
  const safeId=String(orderId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80),key=`artway_seo_order_sent_${safeId||"current"}`;
  try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");}catch(e){}
  seoWyslijZdarzenie("order",{value,items:(Array.isArray(items)?items:[]).map(item=>({productId:item?.id||"",units:Number(item?.ilosc)||1,revenue:Number(item?.wartosc)||0}))});
}
