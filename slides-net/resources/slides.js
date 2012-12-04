$(function() {
	$.deck('.slide');

  function slomo(e) {
    $('body')[e.shiftKey ? 'addClass' : 'removeClass']('slomo');

    // Sync up iframe mathboxes to correct step
    window.$frames = $frames;
    $frames && $frames.each(function () {
      mathboxSpeed(this, e.shiftKey ? .2 : 1);
    });

  }
  $(document).keydown(slomo).keyup(slomo);

  window.iframes = [];

  // Go to specific step
  function mathboxGo(iframe, step) {
    iframe.contentWindow && iframe.contentWindow.postMessage({ mathBoxDirector: { method: 'go', args: [step] }}, '*');
  }

  // Set speed
  function mathboxSpeed(iframe, speed) {
    iframe.contentWindow && iframe.contentWindow.postMessage({ mathBox: { method: 'speed', args: [speed] }}, '*');
  }

  // Pre-load and unload iframes one frame before/after
  var $iframes = {};
  $('.slide').each(function (i) {
    var $this = $(this);
    var $parents = $this.parents('.slide');

    // Build index of which iframes are active per slide
    if ($parents.length) $this = $parents;
    _.each([i-1, i, i+1], function (i) {
      $iframes[i] = ($iframes[i] || $()).add($this.find('iframe'));
    });
  });

  function disable(iframe) {
    if (!$(iframe).data('src')) {
      var src = $(iframe).attr('src');
      $(iframe).data('src', src);
      iframe.onload = null;
      iframe.src = 'about:blank';

      iframes.splice(iframes.indexOf(iframe), 1);
    }
  }

  function enable(iframe, step) {
    var src = $(iframe).data('src');
    if (src) {
      iframe.onload = function () {
        iframe.onload = null;
        mathboxGo(iframe, step);
      }
      iframe.src = src;
      $(iframe).data('src', null);

      iframes.push(iframe);
    }
  }

  // Hide all iframes
  $('iframe').each(function () {
    disable(this);
  });

  // Interface with websocket for remote navigation commands
  (function () {
    var host = window.document.location.host.replace(/:.*/, '');
    var ws = new WebSocket('ws://' + host + ':8080');
    ws.onmessage = function (event) {
      var data = JSON.parse(event.data);
      var command = {
          up:    'prev',
          left:  'prev',
          down:  'next',
          right: 'next',
          play:  'next',
        }[data.type];
      if (command) {
        $.deck(command);
      }
    };
  })();

  // Respond to presentation deck navigation
  var $frames = null;

	$(document).bind('deck.change', function (e, from, to) {
    var out = [];

    $('#message').remove();

    function getTopSlide(step) {
      var $slide = $.deck('getSlide', step),
          $parents = $slide.parents('.slide');

      if ($parents.length) {
        $slide = $parents;
      }

      return $slide;
    }

    var $subslide = $.deck('getSlide', to);
    var $slide = getTopSlide(to);
    var step = $slide.find('.slide').index($subslide) + 2;

    // Sync up iframe mathboxes to correct step
    $frames = $slide.find('iframe');
    $frames.each(function () {
      mathboxGo(this, step);
    });

    // Start playing videos
    $slide.find('video').each(function () {
      this.play();
    });
    $('.deck-container')[$slide.find('iframe.youtube').length ? 'addClass' : 'removeClass']('flat');

    // Stop old videos
    setTimeout(function () {
      $.deck('getSlide', from).find('video').each(function () {
        this.pause();
      });
    }, 580);

    // Start at beginning or end of mathbox slides
    var go = to > from ? 1 : -1;

    // Pre-load iframes (but allow time for current transition)
    $iframes[to].each(function () {
      var iframe = this;
      setTimeout(function () { enable(iframe, go); }, 580);
    });

    // Unload old iframes
    $('iframe').not($iframes[to]).each(function () {
      disable(this);
    });
  });
});
