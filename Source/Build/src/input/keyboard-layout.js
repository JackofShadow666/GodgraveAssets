(function(){
  'use strict';

  const CODE_ALIASES = {
    KeyW: ['w', 'ц'],
    KeyA: ['a', 'ф'],
    KeyS: ['s', 'ы'],
    KeyD: ['d', 'в'],
    KeyT: ['t', 'е'],
    KeyE: ['e', 'у'],
    KeyR: ['r', 'к'],
    KeyQ: ['q', 'й'],
    KeyY: ['y', 'н'],
    KeyZ: ['z', 'я'],
    KeyX: ['x', 'ч'],
    KeyC: ['c', 'с'],
    KeyV: ['v', 'м'],
    KeyG: ['g', 'п'],
    KeyH: ['h', 'р'],
    KeyU: ['u', 'г'],
    KeyI: ['i', 'ш'],
    KeyJ: ['j', 'о'],
    KeyO: ['o', 'щ'],
    Digit1: ['1'],
    Enter: ['enter'],
    Escape: ['escape']
  };

  function getAliases(event){
    const aliases = new Set();
    const key = String(event?.key || '').toLowerCase();
    if(key) aliases.add(key);
    const byCode = CODE_ALIASES[event?.code];
    if(Array.isArray(byCode)){
      for(const alias of byCode) aliases.add(alias);
    }
    return aliases;
  }

  window.GG_KEYBOARD_LAYOUT = {
    codeAliases: CODE_ALIASES,
    getAliases
  };
})();
