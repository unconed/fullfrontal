DomReady.ready(function() {
  if (Acko.hasWebGL()) {
    var demo = new Acko.TubeCurves();
  }
  else {
    var div = document.createElement('div');
    div.innerHTML = '<p style="font-family: Calibri, Lucida Grande, Ubuntu, sans; font-size: 2em; text-align: center; padding-top: 2em; margin: 0;">Sorry, your browser does not support WebGL.<br><br>Try Chrome.</p>';
    document.body.appendChild(div);
  }
});

var π = Math.PI;

window.Acko = window.Acko || {};

Acko.hasWebGL = function () {
  try {
    return !!window.WebGLRenderingContext &&
           !!document.createElement('canvas').getContext('experimental-webgl');
  } catch(e) {
    return false;
  }
};

Acko.TubeCurves = function () {  
  
  this.initGL(document.body);
  
  this.initRibbons();
//  this.initDebug();

  this.loop();
};

Acko.TubeCurves.prototype = {
  
  initGL: function (element) {
    // set the scene size
    this.width = element.offsetWidth,
    this.height = element.offsetHeight;

    // create a WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    // start the renderer
    this.renderer.setSize(this.width, this.height);

    // insert into body
    element.appendChild(this.renderer.domElement);

    // set some camera attributes
    var VIEW_ANGLE = 85,
        ASPECT = this.width / this.height,
        NEAR = 0.01,
        FAR = 100;

    this.camera = new THREE.PerspectiveCamera(
                       VIEW_ANGLE,
                       ASPECT,
                       NEAR,
                       FAR );

    this.controls = new Acko.SceneControls(this.camera, element);

    this.scene = new THREE.Scene();
    this.scene.add(this.camera);
  },
  
  initRibbons: function () {

    this.time = 0;
    this.ribbons = 10;
    this.uniforms = [];

    var width = .5/this.ribbons, height = 16, segments = 3000;

    var colors = [
    new THREE.Color(0x9B0017),
      new THREE.Color(0x9B0017),
      new THREE.Color(0xB9001D),
      new THREE.Color(0xFFB734),
      new THREE.Color(0xFFE4B0),
      new THREE.Color(0xFFB734),
      new THREE.Color(0xFF9E09),
      new THREE.Color(0x9B0017),
      new THREE.Color(0x9B0017),
      new THREE.Color(0xB9001D),
    ];
    colors = colors.reverse();

    for (var i = 0; i < this.ribbons; ++i) {
      var geometry = new THREE.PlaneGeometry(width, height, 3, segments);

      this.uniforms.push({
          time: {
            type: 'f', // a float
            value: 0
          },
          offset: {
            type: 'f', // a float
            value: (i + 1.5) * width,
          },
      });

      var shaderMaterial = new THREE.ShaderMaterial({
          uniforms:       this.uniforms[i],
          vertexShader:   this.getShader('ribbon-vertex'),
          fragmentShader: this.getShader('ribbon-pixel'),
          vertexColors:   true,
      });
      
			for (var k = 0; k < geometry.faces.length; ++k) {
				f  = geometry.faces[k];
				n = (f instanceof THREE.Face3) ? 3 : 4;
        f.color = colors[i % colors.length];
			}

      var ribbon = new THREE.Mesh(
         geometry,
         shaderMaterial);

      ribbon.doubleSided = true;
      ribbon.rotation.x += π / 2;

      // add the sphere to the scene
      this.scene.add(ribbon);
    }
    
  },
  
  loop: function () {
    this.time += .03;

    for (var i = 0; i < this.ribbons; ++i) {
      this.uniforms[i].time.value = this.time;
      this.controls.phi = this.time*.1;
      this.controls.update();
    }
    
    var that = this;
    this.render(function () {
      that.loop();
    });
  },
  
  render: function (callback) {
    if (!this.pending) {
      this.pending = true;

      var that = this;
      window.requestAnimationFrame(function () {
        that.pending = false;
        that._render();
        callback && callback();
      });
    }
  },

  _render: function () {
    this.renderer.render(this.scene, this.camera);
  },

  getShader: function (id) {
    var el = document.getElementById(id);
    return el.innerText || el.textContent;
  },
  
  initDebug: function () {           
    var axisLength = 1;

    var info = [
      [ [ -axisLength * .25, 0, 0 ], [ axisLength, 0, 0 ], 0xff0000 ],
      [ [ 0, -axisLength * .25, 0 ], [ 0, axisLength, 0 ], 0x00ff00 ],
      [ [ 0, 0, -axisLength * .25 ], [ 0, 0, axisLength ], 0x0000ff ]
    ];

    for (var i = 0; i < 3; i++) {
      material = new THREE.MeshBasicMaterial({color: 0xffffff});
      geometry = new THREE.Geometry();

      geometry.vertices.push(new THREE.Vertex(new THREE.Vector3(info[i][0][0], info[i][0][1], info[i][0][2])));
      geometry.vertices.push(new THREE.Vertex(new THREE.Vector3(info[i][1][0], info[i][1][1], info[i][1][2])));

      var line = new THREE.Line(geometry, new THREE.LineBasicMaterial({color: info[i][2], opacity: 0.8, linewidth: 1}));
      this.scene.addObject(line);
    }
  }  
};




Acko.SceneControls = function (camera, domElement) {
  this.element = domElement;
  this.camera = camera;

  this.initState();
  this.bindMouse();
  this.update();
};

Acko.SceneControls.prototype = {
  
  initState: function () {
    this.width = this.element.offsetWidth,
    this.height = this.element.offsetHeight;
    this.phi = 0.3;
    this.theta = 0.8;
    this.orbit = 3;
    this.dragSpeed = 2;
  },

  bindMouse: function () {
    var that = this;
    this.element.addEventListener('mousedown', function () {
      that.drag = true;
      that.lastHover = that.dragOrigin = { x: event.pageX, y: event.pageY };
    }, false);
    this.element.addEventListener('mouseup', function () {
      that.drag = false;
    }, false);
    this.element.addEventListener('mousemove', function () {
      if (that.drag) {
        var relative = { x: event.pageX - that.dragOrigin.x, y: event.pageY - that.dragOrigin.y },
            delta = { x: event.pageX - that.lastHover.x, y: event.pageY - that.lastHover.y };
        that.lastHover = { x: event.pageX, y: event.pageY };
        that.handleMouseMove(that.dragOrigin, relative, delta);
      }
    }, false);
  },
  
  handleMouseMove: function (origin, relative, delta) {
    this.phi = this.phi + delta.x * this.dragSpeed / this.width;
    this.theta = Math.min(π/2, Math.max(-π/2, this.theta + delta.y * this.dragSpeed / this.height));

    this.update();
  },
  
  update: function () {
    this.camera.position.x = Math.cos(this.phi) * Math.cos(this.theta) * this.orbit;
    this.camera.position.y = Math.sin(this.theta) * this.orbit;
    this.camera.position.z = Math.sin(this.phi) * Math.cos(this.theta) * this.orbit;

    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
  },
  
};

