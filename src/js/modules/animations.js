// ================================
// VISUAL ANIMATIONS
// ================================

// ================================
// VISUAL ANIMATIONS
// ================================

import { Settings } from './settings.js';

let animationFrameId = null;

// Enhanced startParticleAnimation function for Swirl Animation
function startSwirlAnimation() {
  console.log('startSwirlAnimation called');
  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Convert hex to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  const primaryRgb = hexToRgb(Settings.settings.primaryColor);
  const secondaryRgb = hexToRgb(Settings.settings.secondaryColor);

  class Particle {
    constructor(isStar = false) {
      this.x = canvas.width / 2;
      this.y = canvas.height / 2;
      this.radius = isStar ? Math.random() * 3 + 2 : Math.random() * 1 + 0.5; // Larger for stars, smaller for dots
      this.life = Math.random() * 100 + 100;
      this.angle = Math.random() * Math.PI * 2;
      this.speed = Math.random() * 4 + 2;
      this.color = Math.random() > 0.5 ? primaryRgb : secondaryRgb;
      this.opacity = 1;
      this.trailLength = Math.random() * 20 + 10; // Trail effect
    }

    update() {
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
      this.angle += (Math.random() - 0.5) * 0.3; // Swirl effect
      this.life--;
      this.opacity = this.life / 100;
      this.speed *= 0.99; // Slow down over time for breeze effect
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity})`;
      ctx.fill();

      // Draw trail
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - Math.cos(this.angle) * this.trailLength, this.y - Math.sin(this.angle) * this.trailLength);
      ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function createBurst(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      const p = new Particle(true); // Star particle
      p.x = x;
      p.y = y;
      p.speed = Math.random() * 6 + 3;
      p.angle += (i - count / 2) * 0.1; // Radial spread
      particles.push(p);
    }
  }

  let burstCounter = 0;

  function animate() {
    // Fading trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create new particles for the breeze
    for (let i = 0; i < 5; i++) {
      particles.push(new Particle(false)); // Dot particle
    }
    for (let i = 0; i < 2; i++) {
      particles.push(new Particle(true)); // Star particle
    }

    // Create burst effect periodically
    burstCounter++;
    if (burstCounter % 30 === 0) { // Every half second
      createBurst(Math.random() * canvas.width, Math.random() * canvas.height);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw();
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

// Basic particle animation (for 'animation' mode)
function startParticleAnimation() {
  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Convert hex to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  const primaryRgb = hexToRgb(Settings.settings.primaryColor);
  const secondaryRgb = hexToRgb(Settings.settings.secondaryColor);

  class SimpleParticle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.radius = Math.random() * 2 + 1;
      this.vx = (Math.random() - 0.5) * 4;
      this.vy = (Math.random() - 0.5) * 4;
      this.color = Math.random() > 0.5 ? primaryRgb : secondaryRgb;
      this.opacity = Math.random() * 0.5 + 0.5;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      
      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity})`;
      ctx.fill();
    }
  }

  // Create initial particles
  for (let i = 0; i < 50; i++) {
    particles.push(new SimpleParticle());
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(particle => {
      particle.update();
      particle.draw();
    });

    animationFrameId = requestAnimationFrame(animate);
  }

  animate();
}

// Stop animation function
function stopAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// Export the functions you want to be public
export const Animations = {
  startSwirlAnimation,
  startParticleAnimation,
  stopAnimation
};

// Assign to window for legacy inline `onclick` handlers to work during transition
window.Animations = Animations;

