/* Anonimowy pomiar efektów SEO. Zapisuje wyłącznie dzienne sumy kanałów, domen wejścia i konwersji. */
let seoEfektyStan={loading:false,loadedAt:0,error:"",days:30,totals:{landing:0,product_view:0,add_to_cart:0,order:0,revenue:0},channels:{},domains:{},landingPages:[],campaigns:[],referrers:[],timeline:[],products:[],updatedAt:null};
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
  const body={event,channel:attribution.channel,entryDomain:attribution.entryDomain,landingPath:attribution.landingPath,campaign:attribution.campaign,referrerDomain:attribution.referrerDomain,productId:data.productId||"",value:Math.max(0,Number(data.value)||0)};
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
function seoSledzZamowienie(value){
  try{if(sessionStorage.getItem("artway_seo_order_sent"))return;sessionStorage.setItem("artway_seo_order_sent","1");}catch(e){}
  seoWyslijZdarzenie("order",{value});
}
async function seoPobierzEfekty(days=30,force=false){
  if(seoEfektyStan.loading||(!force&&Date.now()-seoEfektyStan.loadedAt<60_000))return;
  seoEfektyStan={...seoEfektyStan,loading:true,error:"",days};
  try{
    const response=await fetch(`/api/seo/performance?days=${Math.max(7,Math.min(365,Number(days)||30))}`,{cache:"no-store",headers:chmuraNaglowki(false),credentials:"same-origin"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();seoEfektyStan={...seoEfektyStan,...data,loading:false,loadedAt:Date.now(),error:""};
  }catch(error){seoEfektyStan={...seoEfektyStan,loading:false,loadedAt:Date.now(),error:String(error?.message||error)};}
  if(trasa().startsWith("/admin/seo"))renderuj();
}
