// === src/core/debug-config.js ===
// Temporary startup debug switches.
// Set unlockBrowserInput to true to allow DevTools/context menu even if the
// in-game checkbox cannot be reached because startup fails early.
(function(){
  'use strict';

  window.GG_DEBUG_CONFIG = Object.assign({
    unlockBrowserInput: true
  }, window.GG_DEBUG_CONFIG || {});
})();
