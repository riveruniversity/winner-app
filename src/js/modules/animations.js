// ================================
// VISUAL ANIMATIONS
// ================================

// ================================
// VISUAL ANIMATIONS
// ================================

import { Settings, settings } from './settings.js';

let animationFrameId = null;

// Enhanced startParticleAnimation function for Swirl Animation
function startSwirlAnimation() {
  if (Settings && Settings.debugLog) Settings.debugLog('startSwirlAnimation called');
  const canvas = document.getElementById('countdownCanvas');
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

  const primaryRgb = hexToRgb(settings.primaryColor);
  const secondaryRgb = hexToRgb(settings.secondaryColor);

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
  const canvas = document.getElementById('countdownCanvas');
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

  const primaryRgb = hexToRgb(settings.primaryColor);
  const secondaryRgb = hexToRgb(settings.secondaryColor);

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


// Confetti Celebration Animation
function startConfettiAnimation() {
  const canvas = document.getElementById('animationCanvas');
  if (!canvas) {
    console.error('❌ Canvas element not found!');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  let confettiPieces = [];

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

  const primaryRgb = hexToRgb(settings.primaryColor);
  const secondaryRgb = hexToRgb(settings.secondaryColor);
  const colors = [primaryRgb, secondaryRgb, {r: 255, g: 215, b: 0}, {r: 255, g: 20, b: 147}, {r: 50, g: 205, b: 50}];

  class ConfettiPiece {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = -10;
      this.vx = (Math.random() - 0.5) * 4;
      this.vy = Math.random() * 3 + 2;
      this.width = Math.random() * 8 + 4;
      this.height = Math.random() * 8 + 4;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.3;
      this.gravity = 0.05;
      this.life = 200;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.rotation += this.rotationSpeed;
      this.life--;
      
      // Slight air resistance
      this.vx *= 0.999;
      this.vy *= 0.999;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${Math.max(0, this.life / 200)})`;
      ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
      ctx.restore();
    }
  }

  function createConfetti() {
    for (let i = 0; i < 5; i++) {
      confettiPieces.push(new ConfettiPiece());
    }
  }

  let frameCount = 0;
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create new confetti pieces periodically
    if (frameCount % 3 === 0 && frameCount < 120) {
      createConfetti();
    }
    
    // Update and draw confetti
    for (let i = confettiPieces.length - 1; i >= 0; i--) {
      const piece = confettiPieces[i];
      piece.update();
      piece.draw();
      
      if (piece.y > canvas.height + 10 || piece.life <= 0) {
        confettiPieces.splice(i, 1);
      }
    }
    
    frameCount++;
    
    // Continue animation if there are still pieces or we're still creating them
    if (confettiPieces.length > 0 || frameCount < 120) {
      animationFrameId = requestAnimationFrame(animate);
    }
  }

  animate();
}

// Time Machine Animation - Tunnel/warp effect
function startTimeMachineAnimation() {
  if (Settings && Settings.debugLog) Settings.debugLog('startTimeMachineAnimation called');
  const canvas = document.getElementById('countdownCanvas');
  const ctx = canvas.getContext('2d');
  let rings = [];
  let time = 0;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Convert hex to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  const primaryRgb = hexToRgb(settings.primaryColor);
  const secondaryRgb = hexToRgb(settings.secondaryColor);

  class TimeRing {
    constructor(startRadius = 0) {
      this.radius = startRadius;
      this.maxRadius = Math.max(canvas.width, canvas.height);
      this.speed = 3 + Math.random() * 2;
      this.thickness = 2 + Math.random() * 3;
      this.color = Math.random() > 0.5 ? primaryRgb : secondaryRgb;
      this.opacity = 1;
      this.pulseOffset = Math.random() * Math.PI * 2;
    }

    update() {
      this.radius += this.speed;
      this.opacity = 1 - (this.radius / this.maxRadius);
      this.speed *= 1.02; // Accelerate as it moves away
    }

    draw() {
      const pulse = Math.sin(time * 0.1 + this.pulseOffset) * 0.2 + 0.8;
      const glowOpacity = this.opacity * pulse;
      
      // Draw outer glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${glowOpacity * 0.3})`;
      ctx.lineWidth = this.thickness * 3;
      ctx.stroke();

      // Draw main ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${glowOpacity})`;
      ctx.lineWidth = this.thickness;
      ctx.stroke();
    }

    isDead() {
      return this.opacity <= 0;
    }
  }

  // Create grid lines for tunnel effect
  function drawTunnelGrid() {
    const gridLines = 8;
    const angleStep = (Math.PI * 2) / gridLines;
    
    for (let i = 0; i < gridLines; i++) {
      const angle = i * angleStep + time * 0.02;
      const startX = centerX + Math.cos(angle) * 50;
      const startY = centerY + Math.sin(angle) * 50;
      const endX = centerX + Math.cos(angle) * Math.max(canvas.width, canvas.height);
      const endY = centerY + Math.sin(angle) * Math.max(canvas.width, canvas.height);
      
      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.4)`);
      gradient.addColorStop(1, `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.1)`);
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Create energy particles
  class EnergyParticle {
    constructor() {
      this.angle = Math.random() * Math.PI * 2;
      this.distance = 20 + Math.random() * 50;
      this.speed = 2 + Math.random() * 3;
      this.size = 1 + Math.random() * 2;
      this.color = Math.random() > 0.5 ? primaryRgb : secondaryRgb;
      this.life = 1;
    }

    update() {
      this.distance += this.speed;
      this.speed *= 1.05;
      this.life = Math.max(0, 1 - this.distance / 800);
    }

    draw() {
      const x = centerX + Math.cos(this.angle) * this.distance;
      const y = centerY + Math.sin(this.angle) * this.distance;
      
      ctx.beginPath();
      ctx.arc(x, y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.life})`;
      ctx.fill();
    }

    isDead() {
      return this.life <= 0;
    }
  }

  let energyParticles = [];

  function animate() {
    time++;
    
    // Create dark tunnel background with radial gradient
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(canvas.width, canvas.height) / 2);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.95)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tunnel grid
    drawTunnelGrid();

    // Create new rings periodically
    if (time % 20 === 0) {
      rings.push(new TimeRing());
    }

    // Update and draw rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.update();
      ring.draw();
      
      if (ring.isDead()) {
        rings.splice(i, 1);
      }
    }

    // Create energy particles
    if (time % 3 === 0) {
      energyParticles.push(new EnergyParticle());
    }

    // Update and draw energy particles
    for (let i = energyParticles.length - 1; i >= 0; i--) {
      const particle = energyParticles[i];
      particle.update();
      particle.draw();
      
      if (particle.isDead()) {
        energyParticles.splice(i, 1);
      }
    }

    // Add some screen flash effects
    if (time % 60 === 0) {
      ctx.fillStyle = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

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
  startConfettiAnimation,
  startTimeMachineAnimation,
  stopAnimation
};

// Assign to window for legacy inline `onclick` handlers to work during transition
window.Animations = Animations;

