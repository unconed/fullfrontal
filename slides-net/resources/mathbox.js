DomReady.ready(function() {
  var preload = [
    '../../mathbox/shaders/snippets.glsl.html',
    '../../mathbox/vendor/ThreeRTT.js/build/ThreeRTT.glsl.html',
    '../../mathbox/vendor/ThreeRTT.js/shaders/examples.glsl.html',
  ];

  var url = location.hash, match;
  if (match = url.match(/^#([0-9]+)$/)) {
    preload.push('mb-' + match[1] + '.html');
  }

  // Clock that starts as soon as it is first called (per id).
  var clocks = {};
  window.clock = function (id) {
    if (!clocks[id]) clocks[id] = +new Date();
    return (+new Date() - clocks[id]) * .001;
  }

  ThreeBox.preload(preload, function () {

    // Force FPS
    var fps = 60;
    if (fps < 60) {
      var raf = window.requestAnimationFrame;
      window.requestAnimationFrame = function (x) {
        setTimeout(x, 1000 / (fps + 1));
      }
    }

    // Single or multiple mathboxen
    window.mathBoxSetup = window.mathBoxSetup || function () {};
    window.mathBoxOptions = window.mathBoxOptions || {}
    window.mathBoxScript = window.mathBoxScript || [];

    if (window.mathBoxSetup.constructor != Array) {
      window.mathBoxOptions = [window.mathBoxOptions || {}];
      window.mathBoxSetup = [window.mathBoxSetup];
      window.mathBoxScript = [window.mathBoxScript];
    }

    // Console access
    window.mathbox = [];
    window.prim = [];
    window.director = [];

    _.each(window.mathBoxOptions, function (options, i) {
      var setup = window.mathBoxSetup[i];
      var script = window.mathBoxScript[i];

      // MathBox boilerplate
      var mathbox = mathBox(_.extend({
        cameraControls: true,
        stats: false,
        scale: 1,
        orbit: 3.5,
        theta: 0//,
      }, options || {})).start();

      mathbox.transition(300);

      window.mathbox.push(mathbox);
      window.prim.push(mathbox.primitives);

      var director = new MathBox.Director(mathbox, script || []);
      window.director.push(director);

      setup && setup(mathbox, director);

    });

    // Controls for stand-alone
    window.addEventListener('keydown', function (e) {
      _.each(window.director, function (director) {
        if (e.keyCode == 38 || e.keyCode == 37) director.back();
        if (e.keyCode == 40 || e.keyCode == 39) director.forward();
      });
    });

    // Receive navigation commands from parent frame
    window.addEventListener("message", function (e) {
      var data = e.data && e.data.mathBoxDirector;
      var method = data.method, args = data.args || [];
      _.each(window.director, function (director) {
        if (director[method]) {
          director[method].apply(director, args);
        }
      });
    }, false);

  });

});
