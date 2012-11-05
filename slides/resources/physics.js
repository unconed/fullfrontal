window.Physics = window.DemoPhysics || {};

(function (ph) {

ph.Engine = function (options, particles, constraints) {

  var defaults = {
    method: 'verlet',
    step: 0.16,
  };

  this.options = _.extend(defaults, options || {});
  this.particles = particles;
  this.constraints = constraints;

  this.init();
}

ph.Engine.prototype = {

  init: function () {
  },

  euler: function (particle) {
    var v = new THREE.Vector3(),
        a = new THREE.Vector3(),
        step = this.options.step;

    // Apply velocity
    v.copy(particle.velocity);
    v.multiplyScalar(step);
    particle.position.addSelf(v);

    // Apply acceleration
    a.copy(particle.acceleration);
    a.multiplyScalar(step);
    particle.velocity.addSelf(a);
  },

  verlet: function (particle) {
    var p = new THREE.Vector3(),
        a = new THREE.Vector3(),
        step = this.options.step;

    // Initialize last position if needed
    if (!particle.last) {
      particle.last = new THREE.Vector3();
      particle.velocity.multiplyScalar(step);
      particle.last.sub(particle.position, particle.velocity);
    }

    // Calculate a*dt^2
    a.copy(particle.acceleration);
    a.multiplyScalar(step * step);

    // Calculate next position
    p.copy(particle.position);
    p.multiplyScalar(2);
    p.subSelf(particle.last);
    p.addSelf(a);

    // Update history
    particle.last = particle.position;
    particle.position = p;

    // Estimate velocity for visualization purposes
    particle.velocity.sub(particle.position, particle.last);
    particle.velocity.multiplyScalar(1 / step);
  },

  update: function () {

    _.each(this.particles, function (particle) {
      // Collect all forces
      particle.acceleration.set(0, 0, 0);
      _.each(this.constraints, function (constraint) {
        constraint.accelerate(particle, this);
      }.bind(this));

      // Update points
      this[this.options.method](particle);
    }.bind(this));

    // Apply constraints
    _.loop(4, function () {
      _.each(this.particles, function (particle) {
        _.each(this.constraints, function (constraint) {
          constraint.constrain(particle, this);
        }.bind(this));
      }.bind(this));
    }.bind(this))
  },

  // Helpers for visualization
  position: function (i) {
    var l = this.particles.length,
        p = this.particles[i];

    if (l == 0) {
      return [0, 0, 0];
    }
    if (!p) {
      p = this.particles[l - 1];
    }

    p = p.position;
    return [p.x, p.y, p.z];
  },

  velocity: function (i, end, scale) {
    var l = this.particles.length,
        p = this.particles[i];

    if (l == 0) {
      return [0, 0, 0];
    }
    if (!p) {
      p = this.particles[l - 1];
    }

    var v = p.velocity;
    p = p.position;

    return end ? [p.x + v.x * scale, p.y + v.y * scale, p.z + v.z * scale] : [p.x, p.y, p.z];
  },

  acceleration: function (i, end, scale) {
    var l = this.particles.length,
        p = this.particles[i];

    if (l == 0) {
      return [0, 0, 0];
    }
    if (!p) {
      p = this.particles[l - 1];
    }

    var v = p.velocity;
    var a = p.acceleration;
    p = p.position;

    var out = [p.x + v.x * scale, p.y + v.y * scale, p.z + v.z * scale];

    if (end) {
      out[0] += a.x;
      out[1] += a.y;
      out[2] += a.z;
    }

    return out;
  },
}



ph.Particle = function (x, y, z, vx, vy, vz, radius, mass) {
  x = x || 0;
  y = y || 0;
  z = z || 0;

  vx = vx || 0;
  vy = vy || 0;
  vz = vz || 0;

  this.position = new THREE.Vector3(x, y, z);
  this.velocity = new THREE.Vector3(vx, vy, vz); // For Euler
  this.acceleration = new THREE.Vector3();
  this.last = null; // For Verlet
  this.radius = (radius === undefined) ? 0.1 : radius;
  this.mass = (mass === undefined) ? 1 : mass;
}



ph.Constraint = function () {
}

ph.Constraint.prototype = {

  accelerate: function (particle, physics) {
  },

  constrain: function (particle, physics, atRest) {
  },

}


ph.Gravity = function (g) {
  this.g = g || 1;
}

ph.Gravity.prototype = _.extend(new ph.Constraint(), {

  accelerate: function (particle, physics) {
    particle.acceleration.y -= this.g;
  },

});


ph.Friction = function (f) {
  this.f = f || .99;
}

ph.Friction.v = new THREE.Vector3();

ph.Friction.prototype = _.extend(new ph.Constraint(), {

  accelerate: function (particle, physics) {
    var v = ph.Friction.v;

    if (physics.options.method == 'verlet') {
      if (particle.last) {
        v.sub(particle.position, particle.last);
        v.multiplyScalar(1 - this.f);
        particle.last.addSelf(v);
      }
    }
    else {
      particle.velocity.multiplyScalar(this.f);
    }
  },

});



ph.GravityWell = function (x, y, z, mass) {
  this.position = new THREE.Vector3(x, y, z);
  this.mass = mass || 1;
  this.g = 1;
}

ph.GravityWell.p = new THREE.Vector3();

ph.GravityWell.prototype = _.extend(new ph.Constraint(), {

  accelerate: function (particle, physics) {
    var p = ph.GravityWell.p;

    if (!particle.mass) return;

    p.sub(this.position, particle.position);
    var r = p.length();
    if (r > 0) {
      var a = this.mass * this.g / (r*r);

      p.normalize().multiplyScalar(a);
      particle.acceleration.addSelf(p);
    }
  },

});




ph.BoxCollider = function (width, height, depth, elasticity) {
  this.width = width || 2;
  this.height = height || 2;
  this.depth = depth || 2;
  this.elasticity = elasticity || 1;
}

ph.BoxCollider.prototype = _.extend(new ph.Constraint(), {

  constrain: function (particle, physics, atRest) {
    var right = this.width / 2,
        down = this.height / 2,
        back = this.depth / 2,
        left = -right,
        up = -down,
        front = -back,
        elasticity = this.elasticity;

    function constrain(axis, a, b) {
      if (particle.position[axis] - particle.radius < a) {
        // Flip position around edge.
        particle.position[axis] = (a + particle.radius)*2 - particle.position[axis];

        if (physics.options.method == 'verlet') {
          // Flip last position around edge.
          particle.last[axis] = (a + particle.radius)*2 - particle.last[axis];
        }
        else {
          // Flip velocity
          particle.velocity[axis] = -particle.velocity[axis] * elasticity;
        }

      }

      if (particle.position[axis] + particle.radius > b) {
        // Flip position around edge.
        particle.position[axis] = (b - particle.radius)*2 - particle.position[axis];

        if (physics.options.method == 'verlet') {
          // Flip last position around edge.
          particle.last[axis] = (b - particle.radius)*2 - particle.last[axis];
        }
        else {
          // Flip velocity
          particle.velocity[axis] = -particle.velocity[axis] * elasticity;
        }
      }
    }

    constrain('x', left, right);
    constrain('y', up, down);
    constrain('z', front, back);
  },

});


ph.ParticleCollider = function (elasticity) {
  this.elasticity = elasticity || 1;
}

ph.ParticleCollider.p = new THREE.Vector3();
ph.ParticleCollider.v = new THREE.Vector3();
ph.ParticleCollider.i = new THREE.Vector3();

ph.ParticleCollider.prototype = _.extend(new ph.Constraint(), {

  constrain: function (particle, physics, atRest) {
    var elasticity = this.elasticity,
        step = physics.options.step,
        method = physics.options.method,
        p = ph.ParticleCollider.p,
        v = ph.ParticleCollider.v,
        i = ph.ParticleCollider.i;

    var found = false;
    _.each(physics.particles, function (other) {
      // Only iterate each pair once
      if (other == particle) {
        found = true;
        return;
      }
      if (!found) {
        return;
      }

      // Get difference of positions
      p.sub(particle.position, other.position);

      // Check separation distance
      var distance = p.length();
      var separation = particle.radius + other.radius;
      if (distance < separation) {

        // Collision
        var m1 = other.mass,
            m2 = particle.mass;

        // Move objects away from each other so they don't penetrate
        p.normalize();
        p.multiplyScalar(separation - distance);

        // Estimate velocity for verlet
        if (method == 'verlet') {
          particle.velocity.sub(particle.position, particle.last);
          particle.velocity.multiplyScalar(1 / step);

          other.velocity.sub(other.position, other.last);
          other.velocity.multiplyScalar(1 / step);
        }

        // Mass 0 = immovable object
        if (m1 > 0 && m2 > 0) {
          p.multiplyScalar(0.5);
          particle.position.addSelf(p);

          if (method == 'verlet') {
            particle.last.addSelf(p);
          }

          p.multiplyScalar(-1);
          other.position.addSelf(p);

          if (method == 'verlet') {
            other.last && other.last.addSelf(p);
          }
        }
        else if (m1 > 0) {
          p.multiplyScalar(-1);
          other.position.addSelf(p);

          if (method == 'verlet') {
            other.last.addSelf(p);
          }
        }
        else if (m2 > 0) {
          particle.position.addSelf(p);

          if (method == 'verlet') {
            particle.last.addSelf(p);
          }
        }

        // Calculate relative velocity of objects
        p.normalize();
        v.sub(other.velocity, particle.velocity);

        // Calculate velocity vector to add to reflect velocities
        i.copy(p).multiplyScalar(p.dot(v) * (1 + elasticity));

        // Add velocity to each object, divided according to their masses
        var total = m1 + m2;

        // Mass 0 = immovable object
        if (m1 > 0 && m2 > 0) {
          v.copy(i).multiplyScalar(m2 / total);
          particle.velocity.addSelf(v);

          v.copy(i).multiplyScalar(m1 / total);
          other.velocity.subSelf(v);
        }
        else if (m1 > 0) {
          other.velocity.subSelf(i);
        }
        else if (m2 > 0) {
          particle.velocity.addSelf(i);
        }

        // If using verlet, apply velocity to reconstruct new last position
        if (method == 'verlet') {
          v.copy(other.velocity).multiplyScalar(step);
          other.last.sub(other.position, v);

          v.copy(particle.velocity).multiplyScalar(step);
          particle.last.sub(particle.position, v);
        }
      }

    });
  },

});


})(window.Physics);
