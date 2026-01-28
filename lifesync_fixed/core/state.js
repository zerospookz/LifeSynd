export const State={
  cache:{},
  get(k,d){
    if(!(k in this.cache)){
      try{this.cache[k]=JSON.parse(localStorage.getItem(k))??d}catch{this.cache[k]=d}
    }
    return this.cache[k]
  },
  set(k,v){this.cache[k]=v;localStorage.setItem(k,JSON.stringify(v))}
};