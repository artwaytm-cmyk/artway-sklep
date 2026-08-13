function seoEfektyDzien(value=new Date()){const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return "";const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Warsaw",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d),get=t=>p.find(x=>x.type===t)?.value||"";return `${get("year")}-${get("month")}-${get("day")}`;}
function seoEfektyPrzesunDzien(day,offset){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
const SEO_EFEKTY_DZIS=seoEfektyDzien();
let seoEfektyFiltry={preset:"30",from:seoEfektyPrzesunDzien(SEO_EFEKTY_DZIS,-29),to:SEO_EFEKTY_DZIS,domain:"all",channel:"all",metric:"landing",search:""};
let seoEfektyStan={loading:false,loadedAt:0,error:"",days:30,range:{from:seoEfektyFiltry.from,to:seoEfektyFiltry.to,days:30},totals:{landing:0,product_view:0,add_to_cart:0,order:0,revenue:0},comparison:{},channels:{},domains:{},landingPages:[],campaigns:[],referrers:[],timeline:[],products:[],updatedAt:null};
let seoEfektySearchTimer=0;
let seoEfektyRequestId=0;
function seoEfektyOdswiezPanel(options={}){
  const current=document.querySelector("[data-seo-effects-workspace]");if(!current)return;
  const fragment=dokumentTymczasowyHTML(seoEfektyPanelHTML()),next=fragment.querySelector("[data-seo-effects-workspace]");if(!next)return;
  current.replaceWith(next);if(options.focusSearch){const input=next.querySelector("[data-seo-effects-search]");input?.focus();if(input)input.setSelectionRange(input.value.length,input.value.length);}
}
async function seoPobierzEfekty(days=seoEfektyStan.days||30,force=false){
  if(!force&&(seoEfektyStan.loading||Date.now()-seoEfektyStan.loadedAt<60_000))return;
  const requestId=++seoEfektyRequestId;
  seoEfektyStan={...seoEfektyStan,loading:true,error:"",days:Number(days)||seoEfektyStan.days||30};seoEfektyOdswiezPanel();
  try{
    const params=new URLSearchParams({from:seoEfektyFiltry.from,to:seoEfektyFiltry.to,domain:seoEfektyFiltry.domain,channel:seoEfektyFiltry.channel,days:String(Math.max(1,Math.min(400,Number(days)||30)))});
    const response=await fetch(`/api/seo/performance?${params}`,{cache:"no-store",headers:chmuraNaglowki(false),credentials:"same-origin"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();if(requestId!==seoEfektyRequestId)return;seoEfektyStan={...seoEfektyStan,...data,loading:false,loadedAt:Date.now(),error:""};
  }catch(error){if(requestId!==seoEfektyRequestId)return;seoEfektyStan={...seoEfektyStan,loading:false,loadedAt:Date.now(),error:String(error?.message||error)};}
  if(trasa()==="/admin/seo/efekty")seoEfektyOdswiezPanel();
}
function seoEfektyUstawOkres(preset){
  const today=seoEfektyDzien(),days=Math.max(1,Math.min(400,Number(preset)||30));seoEfektyFiltry={...seoEfektyFiltry,preset:String(preset),from:seoEfektyPrzesunDzien(today,-(days-1)),to:today};seoEfektyStan.loadedAt=0;void seoPobierzEfekty(days,true);
}
function seoEfektyUstawDzien(day){seoEfektyFiltry={...seoEfektyFiltry,preset:"custom",from:day,to:day};seoEfektyStan.loadedAt=0;void seoPobierzEfekty(1,true);}
function seoEfektyZmienDate(field,value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return;const next={...seoEfektyFiltry,preset:"custom",[field]:value};if(next.from>next.to){if(field==="from")next.to=value;else next.from=value;}seoEfektyFiltry=next;seoEfektyStan.loadedAt=0;void seoPobierzEfekty(30,true);}
function seoEfektyUstawFiltr(field,value){if(!["domain","channel"].includes(field))return;seoEfektyFiltry={...seoEfektyFiltry,[field]:String(value||"all")};seoEfektyStan.loadedAt=0;void seoPobierzEfekty(seoEfektyStan.days,true);}
function seoEfektyUstawMetryke(metric){if(!["landing","product_view","add_to_cart","order","revenue"].includes(metric))return;seoEfektyFiltry={...seoEfektyFiltry,metric};seoEfektyOdswiezPanel();}
function seoEfektySzukaj(value){seoEfektyFiltry={...seoEfektyFiltry,search:String(value||"")};clearTimeout(seoEfektySearchTimer);seoEfektySearchTimer=setTimeout(()=>seoEfektyOdswiezPanel({focusSearch:true}),180);}
function seoEfektyWyczyscFiltry(){const today=seoEfektyDzien();seoEfektyFiltry={preset:"30",from:seoEfektyPrzesunDzien(today,-29),to:today,domain:"all",channel:"all",metric:"landing",search:""};seoEfektyStan.loadedAt=0;void seoPobierzEfekty(30,true);}
function seoEfektyEksportuj(typ="dni"){
  const state=seoEfektyStan||{},name=`seo-efekty-${typ}-${state.range?.from||seoEfektyFiltry.from}-${state.range?.to||seoEfektyFiltry.to}.csv`;
  if(typ==="dni")return adminEksportujCSV(name,["dzien","wejscia","karty_produktow","koszyk","zamowienia","sprzedaz","wejscia_do_produktu_proc","koszyk_z_produktu_proc","konwersja_proc","koszyk_do_zamowienia_proc","srednie_zamowienie"],(state.timeline||[]).map(x=>[x.day,x.landing,x.product_view,x.add_to_cart,x.order,x.revenue,x.productViewRate,x.cartRate,x.orderRate,x.cartToOrderRate,x.averageOrderValue]));
  if(typ==="domeny")return adminEksportujCSV(name,["domena","wejscia","produkty","koszyk","zamowienia","sprzedaz"],Object.entries(state.domains||{}).map(([key,x])=>[key,x.landing,x.product_view,x.add_to_cart,x.order,x.revenue]));
  if(typ==="kanaly")return adminEksportujCSV(name,["kanal","wejscia","produkty","koszyk","zamowienia","sprzedaz"],Object.entries(state.channels||{}).map(([key,x])=>[key,x.landing,x.product_view,x.add_to_cart,x.order,x.revenue]));
  const products=typeof seoEfektyProduktyAktualne==="function"?seoEfektyProduktyAktualne(state):[];
  return adminEksportujCSV(name,["produkt_id","nazwa","identyfikator_zewnetrzny","ean","wyswietlenia","koszyk","zamowienia","sprzedane_sztuki","wartosc_pozycji","skutecznosc_koszyka_proc","konwersja_zamowienia_proc"],products.map(({item,p})=>[item.productId,p.nazwa||"",p.externalId||p.sku||"",p.ean||p.gtin||"",item.views,item.carts,item.orders,item.units,item.revenue,item.effectiveness,item.orderRate]));
}
