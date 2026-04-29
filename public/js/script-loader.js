// function loadScriptsAfterDOM() {

//   const scripts = [
//   "js/popper.min.js",
//   "js/simplebar.min.js",
//   "js/bootstrap.min.js",
//   //"js/pcoded.js",
//   "js/feather.min.js",
//   "js/apexcharts.min.js",
//   "js/dashboard-default.js"
// ];

//   let loaded = 0;

//   scripts.forEach(src => {
//     const script = document.createElement('script');
//     script.src = src;

//     script.onload = () => {
//       loaded++;

//       if (loaded === scripts.length) {

//         // Ejecutar configuraciones del template
//         if (typeof layout_change === "function") layout_change('light');
//         if (typeof font_change === "function") font_change("Roboto");
//         if (typeof change_box_container === "function") change_box_container('false');
//         if (typeof layout_caption_change === "function") layout_caption_change('true');
//         if (typeof layout_rtl_change === "function") layout_rtl_change('false');
//         if (typeof preset_change === "function") preset_change("preset-1");


//         // Feather icons
//         if (window.feather) {
//           feather.replace();
//         }
//       }
//     };

//     document.body.appendChild(script);
//   });
// }

// const observer = new MutationObserver((mutations, obs) => {
//   const sidebar = document.querySelector('.pc-sidebar');
//   const btn = document.querySelector('#sidebar-hide');

//   if (sidebar && btn) {

//     loadScriptsAfterDOM();

//     obs.disconnect();
//   }
// });

// observer.observe(document.body, {
//   childList: true,
//   subtree: true
// });

// document.addEventListener('click', function(e) {
//   const btn = e.target.closest('#sidebar-hide');

//   if (btn) {
//     e.preventDefault();

//     const sidebar = document.querySelector('.pc-sidebar');

//     if (sidebar) {
//       sidebar.classList.toggle('pc-sidebar-hide');
//     }
//   }
// });

// document.addEventListener('click', function(e) {
//   const btn = e.target.closest('#sidebar-hide');

//   if (btn) {
//     e.preventDefault();

//     const wrapper = document.querySelector('.layout-wrapper');

//     if (wrapper) {
//       wrapper.classList.toggle('pc-sidebar-hide');
//     }
//   }
// });

// document.addEventListener('click', function(e) {
//   const btn = e.target.closest('#sidebar-hide');

//   if (btn) {
//     e.preventDefault();
//     document.body.classList.toggle('pc-sidebar-hide');

//   }
// });


