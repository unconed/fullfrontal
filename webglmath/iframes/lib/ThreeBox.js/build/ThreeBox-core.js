/**
 * ThreeBox.js. More flexible tQuery boilerplate.
 */

// Math!
var π = Math.PI,
    τ = π * 2;

// Check dependencies.
(function (deps) {
  for (var i in deps) {
    if (!window[i]) throw "Error: ThreeBox requires " + deps[i];
  }
})({
  'THREE': 'Three.js',
  'tQuery': 'tQuery.js (bundle)'//,
});

// Namespace.
window.ThreeBox = {};

// Shortcut static call.
window.threeBox = function (element, options) {
  // Omit element (use body)
  if (element && !(element instanceof Node)) {
    options = element;
    element = null;
  }

  return tQuery.createWorld(options).threeBox(element, options);
};

// Make microevent methods chainable.
MicroEvent.prototype.on   = function () { MicroEvent.prototype.bind.apply(this, arguments);    return this; }
MicroEvent.prototype.emit = function () { MicroEvent.prototype.trigger.apply(this, arguments); return this; }
MicroEvent.mixin	= function(destObject){
	var props	= ['bind', 'unbind', 'trigger', 'on', 'emit'];
	for(var i = 0; i < props.length; i ++){
		destObject.prototype[props[i]]	= MicroEvent.prototype[props[i]];
	}
}

// Make world microevents nicer.
tQuery.World.prototype.on = tQuery.World.prototype.addEventListener;
tQuery.World.prototype.emit = tQuery.World.prototype.dispatchEvent;
/**
 * World.threeBox() – Create a renderer inside a DOM element.
 *
 * Based on tQuery boilerplate.
 */
tQuery.World.registerInstance('threeBox', function (element, options) {

  // Shorthand, omit element.
  if (element && !(element instanceof Node)) {
    options = element;
    element = null;
  }

  // Use body by default
  element = element || document.body;

  // Place renderer in element.
  var domElement  = element;

  if (element == document.body) {
    // Remove margins/padding on body.
    domElement.style.margin   = 0;
    domElement.style.padding  = 0;
    domElement.style.overflow = 'hidden';
  }
  else {
    // Ensure container acts as a reference frame for children.
    var style = getComputedStyle(element);
    if (element.position == 'static') {
      element.position = 'relative';
    }
  }

  // Insert into DOM.
  this.appendTo(domElement);

  // Set up ThreeBox
  this.addThreeBox(element, options || {});

  // Chained API
  return this;
});

/**
 * World.addThreeBox – Set up threebox.
 */
tQuery.World.registerInstance('addThreeBox', function (element, options) {
  // Sanity check
  console.assert(this.hasThreeBox() !== true);

  // Handle parameters  
  options  = tQuery.extend(options, {
    cameraControls: false,
    cursor:         true,
    controlClass:   ThreeBox.OrbitControls,
    elementResize:  true,
    fullscreen:     true,
    screenshot:     true,
    stats:          true,
    scale:          1//,
  });

  // Make tRenderer.domElement style "display: block" - by default it is inline-block
  // - so it is affected by line-height and create a white line at the bottom
  this.tRenderer().domElement.style.display = "block"

  // Create the context
  var ctx  = {};
  tQuery.data(this, '_threeBoxContext', ctx);

  // Get some variables
  var tCamera  = this.tCamera();
  var tRenderer  = this.tRenderer();

  // Add Stats.js.
  if (options.stats) {
    ctx.stats  = new Stats();
    ctx.stats.domElement.style.position = 'absolute';
    ctx.stats.domElement.style.left     = '10px';
    ctx.stats.domElement.style.top      = '10px';
    element && element.appendChild(ctx.stats.domElement);
    ctx.loopStats  = function () {
      ctx.stats.update();
    };
    this.loop().hook(ctx.loopStats);
  }

  // Create camera controls.
  if (options.cameraControls) {
    var loop = this.loop(), render = this.render.bind(this);

    ctx.cameraControls = new options.controlClass(tCamera, element, options);
    if (ctx.cameraControls.on) {
      ctx.cameraControls.on('change', function () {
        // If not looping, ensure view is updated on interaction.
        if (!loop._timerId) {
          render();
        }
      });
    }
    this.setCameraControls(ctx.cameraControls);
  }

  // Track element / window resizes.
  if (options.elementResize) {
    ctx.elementResize = ThreeBox.ElementResize.bind(tRenderer, tCamera, element, options)
                        .on('resize', function (width, height) {
                          // Update tQuery world dimensions.
                          this._opts.renderW = width;
                          this._opts.renderH = height;

                          // Forward resize events to world.
                          this.emit('resize', width, height);
                        }.bind(this));
  }

  // Contextual mouse cursor
  if (options.cursor !== null) {
    ctx.cursor = ThreeBox.Cursor.bind(element, options);
  }

  // Allow 'p' to make screenshot.
  if (THREEx && THREEx.Screenshot && options.screenshot) {
    ctx.screenshot = THREEx.Screenshot.bindKey(tRenderer);
  }

  // Allow 'f' to go fullscreen where this feature is supported.
  if (THREEx && THREEx.FullScreen && options.fullscreen && THREEx.FullScreen.available()) {
    ctx.fullscreen = THREEx.FullScreen.bindKey();
  }

  // Bind 'destroy' event on tQuery.world.
  ctx._$onDestroy = this.bind('destroy', function () {
    if (this.hasThreeBox() === false) return;
    this.removeThreeBox();
  });

  // Chained API
  return this;
});

tQuery.World.registerInstance('hasThreeBox', function () {
  // Get threeBox context.
  var ctx  = tQuery.data(this, "_threeBoxContext")
  return ctx === undefined ? false : true;
});

tQuery.World.registerInstance('removeThreeBox', function () {
  // Get threeBox context.
  var ctx  = tQuery.data(this, '_threeBoxContext');
  if (ctx === undefined) return this;

  // Remove the context from the world.
  tQuery.removeData(this, '_threeBoxContext');

  // Unbind 'destroy' for tQuery.World
  this.unbind('destroy', this._$onDestroy);

  // remove stats.js
  if (ctx.stats) {
    document.body.removeChild(ctx.stats.domElement);
    this.loop().unhook(ctx.loopStats);
  }

  // Remove camera controls.
  ctx.cameraControls && this.removeCameraControls()
                     && ctx.cameraControls.stop();

  // Stop elementResize.
  ctx.elementResize  && ctx.elementResize.unbind();

  // Stop cursor tracking.
  ctx.cursor         && ctx.cursor.unbind();

  // Unbind screenshot
  ctx.screenshot     && ctx.screenshot.unbind();

  // Unbind fullscreen
  ctx.fullscreen     && ctx.fullscreen.unbind();
});
/**
 * Update renderer and camera when the element is resized
 * 
 * @param {Object} renderer The renderer to update
 * @param {Object} camera The camera to update
 * @param {Object} element The DOM element to size to
 *
 * Based on THREEx.WindowResize.
 */
ThreeBox.ElementResize = function (renderer, camera, domElement, options) {
  this.scale = options.scale || 1;
  this.orbit = options.orbit;

  var callback = this.callback = function () {
    var width = Math.floor(domElement.offsetWidth),
        height = Math.floor(domElement.offsetHeight);

    // Size renderer appropriately.
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.width = width + "px";
    renderer.domElement.style.height = height + "px";

    // Scale
    var ws = Math.floor(width/this.scale),
        hs = Math.floor(height/this.scale);

    // Notify the renderer of the size change.
    renderer.setSize(ws, hs);

    // Update the camera aspect and ortho extents
    camera.aspect = width / height;
    if (camera instanceof THREE.OrthographicCamera) {
      camera.top = this.orbit / 2;
      camera.bottom = -camera.top;
      camera.left = -camera.top * camera.aspect;
      camera.right = -camera.bottom * camera.aspect;
    }
    camera.updateProjectionMatrix();

    // Notify of change.
    this.emit('resize', ws, hs);
  }.bind(this);

  // Bind the resize event on the window and element.
  window.addEventListener('resize', callback, false);
  domElement.addEventListener('resize', callback, false);

  // Update size immediately.
  setTimeout(callback, 0);
}

ThreeBox.ElementResize.bind  = function (renderer, camera, element, options) {
  return new ThreeBox.ElementResize(renderer, camera, element, options);
}

/**
 * Change resize scale.
 */
ThreeBox.ElementResize.prototype.scale = function (scale) {
  this.scale = scale;
}

/**
 * Stop watching window resize
 */
ThreeBox.ElementResize.prototype.unbind = function () {
  window.removeEventListener('resize', callback);
  domElement.removeEventListener('resize', callback);
}

MicroEvent.mixin(ThreeBox.ElementResize);/**
 * Click-and-drag mouse controls with Euler angles, yaw and pitch.
 */
ThreeBox.OrbitControls = function (camera, domElement, options) {
  this.element = domElement;
  this.camera = camera;

  this.options = tQuery.extend(options, {
    phi: τ/4,
    theta: 0.3,
    orbit: 2,
    lookAt: [0, 0, 0],
    speed: 2//,
  });

  this.init();
  this.start();
  this.update();
};

ThreeBox.OrbitControls.prototype = {

  init: function () {
    this.width = this.element && this.element.offsetWidth,
    this.height = this.element && this.element.offsetHeight;
    this.phi = this.options.phi;
    this.theta = this.options.theta;
    this.orbit = this.options.orbit;
    this.speed = this.options.speed;

    this.lookAt = new THREE.Vector3();
    this.lookAt.set.apply(this.lookAt, this.options.lookAt || []);

    if (!this.width) {
      console.warn('ThreeBox container has width 0');
    }
    if (!this.height) {
      console.warn('ThreeBox container has height 0');
    }
  },

  start: function () {
    var that = this;

    this._mouseDown = function (event) {
      that.width = that.element && that.element.offsetWidth,
      that.height = that.element && that.element.offsetHeight;

      that.drag = true;
      that.lastHover = that.origin = { x: event.pageX, y: event.pageY };

      event.preventDefault();
    };

    this._mouseUp = function () {
      that.drag = false;
    };

    this._mouseMove = function (event) {
      if (that.drag) {
        var relative = { x: event.pageX - that.origin.x, y: event.pageY - that.origin.y },
            delta = { x: event.pageX - that.lastHover.x, y: event.pageY - that.lastHover.y };
        that.lastHover = { x: event.pageX, y: event.pageY };
        that.moved(that.origin, relative, delta);
      }
    };

    if (this.element) {
      this.element.addEventListener('mousedown', this._mouseDown, false);
      document.addEventListener('mouseup', this._mouseUp, false);
      document.addEventListener('mousemove', this._mouseMove, false);
    }
  },

  stop: function () {
    if (this.element) {
      this.element.removeEventListener('mousedown', this._mouseDown);
      document.removeEventListener('mouseup', this._mouseUp);
      document.removeEventListener('mousemove', this._mouseMove);
    }
  },

  moved: function (origin, relative, delta) {
    this.phi = this.phi + delta.x * this.speed / Math.max(1, this.width);
    this.theta = Math.min(π/2, Math.max(-π/2, this.theta + delta.y * this.speed / Math.max(1, this.height)));

    this.emit('change');
  },

  update: function () {
    this.camera.position.x = Math.cos(this.phi) * Math.cos(this.theta) * this.orbit;
    this.camera.position.y = Math.sin(this.theta) * this.orbit;
    this.camera.position.z = Math.sin(this.phi) * Math.cos(this.theta) * this.orbit;

    this.camera.position.addSelf(this.lookAt);
    this.camera.lookAt(this.lookAt);
  }//,

};

ThreeBox.OrbitControls.bind  = function (camera, domElement, options) {
  return new ThreeBox.OrbitControls(camera, domElement, options);
}

MicroEvent.mixin(ThreeBox.OrbitControls);
/**
 * Set cursor shape and auto-hide with timer.
 * 
 * @param {Object} element DOM element to track mouse movement on.
 * @param {Object} options Options for ThreeBox.
 */
ThreeBox.Cursor = function (element, options) {
  // Use move cursor if controls are active.
  var cursor = options.cameraControls ? 'move' : 'default';

  // Timer state
  var timer = null, ignore = false, delay = 2000;

  // Cursor auto-hiding
  function moved() {
    ignore || show();
    clearTimeout(timer);
    ignore = false;

    timer = setTimeout(function () {
      ignore = true;
      hide();
    }, delay);
  }

  function show() { element.style.cursor = cursor; }
  function hide() { element.style.cursor = 'none'; }

  // Update cursor on mouse move
  if (!options.cursor) {
    element.addEventListener('mousemove', moved);
    hide();
  }
  else {
    show();
  }

  // Return .unbind() the function to stop watching window resize.
  return {
    /**
     * Stop watching window resize
     */
    unbind: function () {
      element.removeEventListener('mousemove', moved);
    }
  };
}

ThreeBox.Cursor.bind  = function (element, options) {
  return ThreeBox.Cursor(element, options);
}
// Quick'n'dirty loader for additional .html content
ThreeBox.preload = function (files, callback) {
  // Only callback passed.
  if (files instanceof Function) {
    callback = files;
    files = [];
  }

  // Allow single file.
  files = typeof files == 'string' ? [files] : files;

  // Completion counter
  var remaining = files.length;
  var accumulate = {};
  var ping = function (data) {
    // Collect objects
    _.extend(accumulate, data || {});

    // Call callback if done.
    if (--remaining == 0) {
      callback(accumulate);
    };
  }

  // Prepare extensions
  var l = ThreeBox.preload;
  var regexps = {},
      exts = {
        'html': l.html,
        'jpg': l.image,
        'png': l.image,
        'gif': l.image,
        'mp3': l.audio,
      };
  _.each(exts, function (handler, ext) {
    regexps[ext] = new RegExp('\\.' + ext + '$');
  });

  // Load individual file
  _.each(files, function (file) {
    // Use appropriate handler based on extension
    _.each(exts, function (handler, ext) {
      if (file.match(regexps[ext])) {
        var path = file.split(/\//g);
        var name = path.pop().replace(/\.[A-Za-z0-9]+$/, '');

        handler(file, name, ping);
      }
    });
  });
};

ThreeBox.preload.html = function (file, name, callback) {
  new microAjax(file, function (res) {
    var match;

    // Insert javascript directly
    if (match = res.match(/^<script[^>]*type=['"]text\/javascript['"][^>]*>([\s\S]+?)<\/script>$/m)) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.innerHTML = match[1];
      document.body.appendChild(script);
    }
    // Insert HTML via div
    else {
      var div = document.createElement('div');
      div.innerHTML = res;
      document.body.appendChild(div);
    }

    console.log('Loaded HTML ', file);
    callback();
  });
};

ThreeBox.preload.image = function (file, name, callback) {
  THREE.ImageUtils.loadTexture(file, null, function (texture) {
    var ret = {};
    ret[name] = texture;

    console.log('Loaded texture ', file);
    callback(ret);
  });
};

ThreeBox.preload.audio = function (file, name, callback) {
  // Load binary file via AJAX
  var request = new XMLHttpRequest();
  request.open("GET", file, true);
  request.responseType = "arraybuffer";

  request.onload = function () {
    var ret = {};
    ret[name] = request.response;

    console.log('Loaded audio ', file);
    callback(ret);
  };

  request.send();
}
