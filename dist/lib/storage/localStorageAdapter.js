// Prototype adapter. Replace this module with a remote repository when a backend is introduced.
export const localStorageAdapter={
  read(key,fallback=[]){try{const value=JSON.parse(localStorage.getItem(key));return value??structuredClone(fallback);}catch{return structuredClone(fallback);}},
  write(key,value){localStorage.setItem(key,JSON.stringify(value));return value;},
};
