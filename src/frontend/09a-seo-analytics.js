/* Anonimowy pomiar efektów SEO. Zapisuje wyłącznie dzienne sumy kanałów i działa tylko dla wejść z wyszukiwarek. */
let seoEfektyStan={loading:false,loadedAt:0,error:"",days:30,totals:{landing:0,product_view:0,add_to_cart:0,order:0,revenue:0},channels:{},timeline:[],products:[],updatedAt:null};
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
function seoKanalSesji(){
  try{
    const saved=sessionStorage.getItem("artway_seo_channel");if(saved)return saved;
    const host=document.referrer?new URL(document.referrer).hostname:"",channel=seoKanalZHosta(host);
    if(channel)sessionStorage.setItem("artway_seo_channel",channel);
    return channel;
  }catch(e){return "";}
}
function seoWyslijZdarzenie(event,data={}){
  const channel=seoKanalSesji();if(!channel||jestAdmin())return;
  const body={event,channel,productId:data.productId||"",value:Math.max(0,Number(data.value)||0)};
  fetch("/api/seo/event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),keepalive:true,credentials:"omit"}).catch(()=>{});
}
function seoSledzTrase(route="/"){
  if(!seoKanalSesji()||String(route).startsWith("/admin"))return;
  try{
    if(!sessionStorage.getItem("artway_seo_landing")){sessionStorage.setItem("artway_seo_landing","1");seoWyslijZdarzenie("landing");}
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
