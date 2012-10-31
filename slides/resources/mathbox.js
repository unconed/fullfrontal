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

  var clocks = {};
  window.clock = function (i) {
    if (!clocks[i]) clocks[i] = +new Date();
    return (+new Date() - clocks[i]) * .001;
  }

  ThreeBox.preload(preload, function () {
    // MathBox boilerplate
    var mathbox = mathBox(_.extend({
      cameraControls: true,
      stats: false,
      scale: .7,
      orbit: 3.5,
      theta: 0//,
    }, window.mathBoxOptions || {})).start();

    window.mathBoxStart = +new Date()
    window.requestAnimationFrame(function recurse() {
      window.mathBoxTime = (+new Date() - window.mathBoxStart) * .001;
      window.requestAnimationFrame(recurse);
    });

    window.mathbox = mathbox;
    window.prim = mathbox.primitives;

    window.mathBoxSetup(mathbox);

    window.mathBoxDirector = new MathBox.Director(mathbox, window.mathBoxSteps);
    window.mathbox.transition(150);

    window.addEventListener('keydown', function (e) {
      if (e.keyCode == 38 || e.keyCode == 37) mathBoxDirector.back();
      if (e.keyCode == 40 || e.keyCode == 39) mathBoxDirector.forward();
    });
    window.addEventListener("message", function (e) {
      var data = e.data && e.data.mathBoxDirector;
      var method = data.method, args = data.args || [];
      if (mathBoxDirector[method]) {
        mathBoxDirector[method].apply(mathBoxDirector, args);
      }
    }, false);
  });

});
