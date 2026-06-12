/**
 * Coign SDK Loader — paste this snippet into your HTML <head>.
 *
 * Before the main SDK loads, `window.Coign` is a stub that queues calls in
 * `window.Coign.q`. After the SDK loads, it replays them automatically.
 *
 * Usage:
 *   <script>
 *     window.Coign = window.Coign || function() {
 *       (window.Coign.q = window.Coign.q || []).push(arguments);
 *     };
 *     Coign('init', { preset: 'coign-balanced' });
 *     Coign('config', { theme: { accent: '#6366f1' } });
 *     Coign(function(coign) {
 *       coign.ask('What is this page about?').then(console.log);
 *     });
 *   </script>
 *   <script src="https://cdn.example.com/coign-sdk@0.1.0.js" async></script>
 */
(function (window) {
  if (window.Coign && window.Coign.version) return;
  window.Coign = function () {
    (window.Coign.q = window.Coign.q || []).push(arguments);
  };
})(window);
