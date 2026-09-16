// Keeps the legacy gamepad menu layer active, but prevents its direct player-1
// dodge action when the same physical pad is assigned to another local slot.
(function(){
  function shouldBlockPlayerOneGamepadDodge(source){
    return window.LocalPlayerControls &&
      window.LocalPlayerControls.getGamepadSlot()>0 &&
      source === 'GamepadDodge';
  }

  if(typeof window.beginDodgePress === 'function'){
    const playerOneBeginDodgePress=window.beginDodgePress;
    window.beginDodgePress=function(source){
      if(shouldBlockPlayerOneGamepadDodge(source)) return false;
      return playerOneBeginDodgePress.apply(this,arguments);
    };
  }

  if(typeof window.endDodgePress === 'function'){
    const playerOneEndDodgePress=window.endDodgePress;
    window.endDodgePress=function(source){
      if(shouldBlockPlayerOneGamepadDodge(source)) return false;
      return playerOneEndDodgePress.apply(this,arguments);
    };
  }

  if(typeof window.doDodge !== 'function') return;
  const playerOneDodge=window.doDodge;
  window.doDodge=function(){
    // Keyboard Shift calls doDodge(true). The legacy gamepad calls it without
    // arguments and must not also move player 1 when the pad owns another slot.
    if(window.LocalPlayerControls && window.LocalPlayerControls.getGamepadSlot()>0 && arguments[0]!==true) return false;
    return playerOneDodge.apply(this,arguments);
  };

  // Legacy menu navigation uses element.click(). Do not let a synthetic click
  // reach controls visually covered by a modal/overlay.
  function getTopOverlay(){
    const candidates=[
      document.getElementById('mob-settings-overlay'),
      document.querySelector('#name-overlay.open'),
      document.querySelector('#net-overlay.open'),
      document.querySelector('#mob-menu-overlay.open'),
      document.querySelector('.game-overlay.open')
    ];
    return candidates.find(el=>el && getComputedStyle(el).display!=='none') || null;
  }
  window.addEventListener('click',function(event){
    if(event.isTrusted) return;
    const top=getTopOverlay();
    if(top && !top.contains(event.target)){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  // The legacy cursor adds .gamepad-hover before clicking. Strip that class
  // from elements behind the currently visible modal as soon as it appears.
  const hoverGuard=new MutationObserver(()=>{
    const top=getTopOverlay();
    if(!top) return;
    document.querySelectorAll('.gamepad-hover,.hover.active').forEach(el=>{
      if(!top.contains(el)) el.classList.remove('gamepad-hover','hover','active');
    });
  });
  hoverGuard.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
})();
