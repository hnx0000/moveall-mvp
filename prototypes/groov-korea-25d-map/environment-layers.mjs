// Independent providers may expose precipitation, radar frames (timestamped),
// storm tracks, clouds, regional conditions and marine temperature/waves.
// A provider must return observedAt/validUntil and explicit availability.
// No forecast or exercise recommendation is inferred from missing/stale data.
export class EnvironmentLayers {
  #providers=new Map(); #requests=new Map();
  register(id,provider){
    if(!provider||typeof provider.load!=='function')throw new TypeError('Layer provider requires load({bounds,time,signal}).');
    this.cancel(id);this.#providers.set(id,provider);
  }
  capabilities(){return [...this.#providers].map(([id,p])=>({id,kinds:p.kinds||[]}));}
  cancel(id){this.#requests.get(id)?.abort();this.#requests.delete(id);}
  async load(id,{bounds,time=Date.now()}={}){
    this.cancel(id);const provider=this.#providers.get(id);
    if(!provider)return {available:false,reason:'unconfigured'};
    const controller=new AbortController();this.#requests.set(id,controller);
    try{
      const data=await provider.load({bounds,time,signal:controller.signal});
      if(controller.signal.aborted)return {available:false,reason:'cancelled'};
      if(!Number.isFinite(data?.observedAt)||!Number.isFinite(data?.validUntil)||data.validUntil<time)return {available:false,reason:'stale'};
      return {...data,available:true};
    }finally{if(this.#requests.get(id)===controller)this.#requests.delete(id);}
  }
  dispose(){for(const id of this.#requests.keys())this.cancel(id);this.#providers.clear();}
}

// Exploration providers ingest verified GPS segments and report covered road
// length against a versioned, routable road graph. Pin drafts and preview routes
// are intentionally not exploration evidence. Population/rank scores are unrelated.
export function createExplorationStore(provider){
  return {async ingest(activity){
    if(!activity?.verified||!activity.id||!Array.isArray(activity.segments))throw new Error('검증된 실제 운동 기록만 탐험에 반영할 수 있습니다.');
    return provider.ingest(activity); // Provider must deduplicate activity.id.
  },async summary(region){return provider.summary(region);}};
}
