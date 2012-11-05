// Shitty physics engine


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

  semiimplicit: function (particle) {
    var v = new THREE.Vector3(),
        a = new THREE.Vector3(),
        step = this.options.step;

    // Apply acceleration
    a.copy(particle.acceleration);
    a.multiplyScalar(step);
    particle.velocity.addSelf(a);

    // Apply velocity
    v.copy(particle.velocity);
    v.multiplyScalar(step);
    particle.position.addSelf(v);
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
      particle.velocity.multiplyScalar(step || 1);
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
    particle.velocity.multiplyScalar(step ? (1 / step) : 1);
  },

  update: function () {

    _.each(this.particles, function (particle) {
      particle.acceleration.set(0, 0, 0);
    });

    // Collect all forces
    _.each(this.constraints, function (constraint) {
      constraint.accelerate(this);
    }.bind(this));

    _.each(this.particles, function (particle) {
      // Update points
      this[this.options.method](particle);
    }.bind(this));

    // Apply constraints
    _.loop(8, function () {
      _.each(this.constraints, function (constraint) {
        constraint.constrain(this);
      }.bind(this));
    }.bind(this))
  },

  // Helpers for visualization
  position: function (i) {
    var l = this.particles.length;

    if (l == 0) {
      return [0, 0, 0];
    }

    p = this.particles[i % l];

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

  acceleration: function (i, end, vScale, aScale) {
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

    var out = [p.x + v.x * vScale, p.y + v.y * vScale, p.z + v.z * vScale];

    if (end) {
      out[0] += a.x * aScale;
      out[1] += a.y * aScale;
      out[2] += a.z * aScale;
    }

    return out;
  },
}



/**
 * Dynamic particle
 */
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



// Constraint base class
ph.Constraint = function () {
}

ph.Constraint.prototype = {

  accelerate: function (physics) {
  },

  constrain: function (physics) {
  },

}



/**
 * Simple gravity, always points down.
 */
ph.Gravity = function (g) {
  this.g = g || 1;
}

ph.Gravity.prototype = _.extend(new ph.Constraint(), {

  accelerate: function (physics) {
    var g = this.g;

    _.each(physics.particles, function (particle) {
      if (!particle.mass) return;
      particle.acceleration.y -= g;
    });
  },

});



/**
 * Fake air friction, reduces velocity by a given factor every frame.
 */
ph.Friction = function (f) {
  this.f = f || .99;
}

ph.Friction.v = new THREE.Vector3();

ph.Friction.prototype = _.extend(new ph.Constraint(), {

  accelerate: function (physics) {
    var v = ph.Friction.v,
        f = this.f;

    _.each(physics.particles, function (particle) {
      if (physics.options.method == 'verlet') {
        if (particle.last) {
          v.sub(particle.position, particle.last);
          v.multiplyScalar(1 - f);
          particle.last.addSelf(v);
        }
      }
      else {
        particle.velocity.multiplyScalar(f);
      }
    });
  },

});


/**
 * Spring enforces distance between two particles.
 */
ph.SpringConstraint = function (a, b, force, separation) {
  var p = ph.SpringConstraint.p;

  // Initialize to current distance
  if (separation === undefined) {
    p.sub(a.position, b.position);
    separation = p.length();
  }

  this.a = a;
  this.b = b;
  this.force = force || 1;
  this.separation = separation;
}

ph.SpringConstraint.p = new THREE.Vector3();
ph.SpringConstraint.v = new THREE.Vector3();

ph.SpringConstraint.prototype = _.extend(new ph.Constraint(), {

  accelerate: function (physics) {

    var a = this.a,
        b = this.b,
        m1 = this.a.mass,
        m2 = this.b.mass,
        separation = this.separation,
        p = ph.SpringConstraint.p,
        v = ph.SpringConstraint.v,
        force = this.force,
        method = physics.options.method,
        step = physics.options.step;

    p.sub(b.position, a.position);
    var distance = p.length();

    // Threshold
//    if (Math.abs(separation - distance) < (separation*.000001)) return;

    // Move objects towards/away from each other so they are at the right distance.
    p.normalize();
    p.multiplyScalar((separation - distance) * force);

    // Mass 0 = immovable object
    if (m1 > 0 && m2 > 0) {
      p.multiplyScalar(0.5);
      b.acceleration.addSelf(p);
      a.acceleration.subSelf(p);
    }
    else if (m1 > 0) {
      a.acceleration.subSelf(p);
    }
    else if (m2 > 0) {
      b.acceleration.addSelf(p);
    }
  },

});


/**
 * Rigid stick enforces distance between two particles.
 */
ph.StickConstraint = function (a, b, separation) {
  var p = ph.StickConstraint.p;

  // Initialize to current distance
  if (separation === undefined) {
    p.sub(a.position, b.position);
    separation = p.length();
  }

  this.a = a;
  this.b = b;
  this.separation = separation;
}

ph.StickConstraint.p = new THREE.Vector3();
ph.StickConstraint.v = new THREE.Vector3();

ph.StickConstraint.prototype = _.extend(new ph.Constraint(), {

  constrain: function (physics) {

    var a = this.a,
        b = this.b,
        m1 = this.a.mass,
        m2 = this.b.mass,
        separation = this.separation,
        p = ph.StickConstraint.p,
        v = ph.StickConstraint.v,
        method = physics.options.method,
        step = physics.options.step;

    // Only applies to one pair of particles, apply from A side.
    p.sub(b.position, a.position);
    var distance = p.length();

    // Move objects towards/away from each other so they are at the right distance.
    p.normalize();
    p.multiplyScalar(separation - distance);

    // Mass 0 = immovable object
    if (m1 > 0 && m2 > 0) {
      p.multiplyScalar(0.5);
      b.position.addSelf(p);

      p.multiplyScalar(-1);
      a.position.addSelf(p);

      if (method == 'verlet') {
        a.last.addSelf(p);
      }
    }
    else if (m1 > 0) {
      p.multiplyScalar(-1);
      a.position.addSelf(p);

    }
    else if (m2 > 0) {
      b.position.addSelf(p);
      p.multiplyScalar(-1);
    }

    var projection;

    p.normalize();
  },

  /*
  satisfy: function (physics) {
    // Only applies to one pair of particles, apply from A side.
    if (particle != this.a) return;

    var a = this.a,
        b = this.b;

    if (method == 'euler') {
      projection = p.dot(a.velocity);
      v.copy(p).multiplyScalar(-projection);
      a.velocity.addSelf(v);

      projection = p.dot(b.velocity);
      v.copy(p).multiplyScalar(-projection);
      b.velocity.addSelf(v);
    }
  },
  */

});



/**
 * Gravity well at given position with given mass.
 */
ph.GravityWell = function (x, y, z, mass) {
  this.position = new THREE.Vector3(x, y, z);
  this.mass = mass || 1;
  this.g = 1;
}

ph.GravityWell.p = new THREE.Vector3();

ph.GravityWell.prototype = _.extend(new ph.Constraint(), {

  accelerate: function (physics) {
    var p = ph.GravityWell.p,
        position = this.position,
        mass = this.mass,
        g = this.g;

    _.each(physics.particles, function (particle) {
      if (!particle.mass) return;

      p.sub(position, particle.position);
      var r = p.length();
      if (r > 0) {
        var a = mass * g / (r*r);

        p.normalize().multiplyScalar(a);
        particle.acceleration.addSelf(p);
      }
    });
  },

});



/**
 * Collides particles against a box of given width/height/depth around the origin.
 */
ph.BoxCollider = function (width, height, depth, elasticity) {
  this.width = width || 2;
  this.height = height || 2;
  this.depth = depth || 2;
  this.elasticity = elasticity || 1;
}

ph.BoxCollider.prototype = _.extend(new ph.Constraint(), {

  constrain: function (physics) {
    var right = this.width / 2,
        down = this.height / 2,
        back = this.depth / 2,
        left = -right,
        up = -down,
        front = -back,
        elasticity = this.elasticity;

    function constrain(particle, axis, a, b) {
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

    _.each(physics.particles, function (particle) {
      constrain(particle, 'x', left, right);
      constrain(particle, 'y', up, down);
      constrain(particle, 'z', front, back);
    });
  },

});



/**
 * Does particle-particle collision, treating them as solid balls
 */
ph.ParticleCollider = function (elasticity) {
  this.elasticity = elasticity || 1;
}

ph.ParticleCollider.p = new THREE.Vector3();
ph.ParticleCollider.v = new THREE.Vector3();
ph.ParticleCollider.i = new THREE.Vector3();

ph.ParticleCollider.prototype = _.extend(new ph.Constraint(), {

  constrain: function (physics) {
    var elasticity = this.elasticity,
        step = physics.options.step,
        method = physics.options.method,
        p = ph.ParticleCollider.p,
        v = ph.ParticleCollider.v,
        i = ph.ParticleCollider.i;

    _.each(physics.particles, function (particle) {
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

          // Estimate velocity for verlet
          if (method == 'verlet') {
            particle.velocity.sub(particle.position, particle.last);
            particle.velocity.multiplyScalar(1 / step);

            other.velocity.sub(other.position, other.last);
            other.velocity.multiplyScalar(1 / step);
          }

          // Move objects away from each other so they don't penetrate
          p.normalize();
          p.multiplyScalar(separation - distance);

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
    });
  },

});


})(window.Physics);
