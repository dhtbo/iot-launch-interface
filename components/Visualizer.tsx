import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { LaunchState } from '../types';

interface VisualizerProps {
  state: LaunchState;
}

const Visualizer: React.FC<VisualizerProps> = ({ state }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<LaunchState>(state);
  const launchTimerRef = useRef<number>(0);

  // Keep the ref in sync
  useEffect(() => {
    // Reset launch timer if we just entered LAUNCHING state
    if (state === LaunchState.LAUNCHING && stateRef.current !== LaunchState.LAUNCHING) {
      launchTimerRef.current = Date.now();
    }
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      let particles: Particle[] = [];
      // INCREASED: 4000 particles for better text density
      const numParticles = 4000; 
      let textTargets: p5.Vector[] = [];
      let pg: p5.Graphics;

      class Particle {
        pos: p5.Vector;
        prevPos: p5.Vector; 
        vel: p5.Vector;
        acc: p5.Vector;
        maxSpeed: number;
        maxForce: number;
        color: p5.Color;
        baseSize: number; // Remember original size
        size: number;
        offset: number; // Random offset for noise
        
        constructor() {
          this.pos = p.createVector(p.random(p.width), p.random(p.height));
          this.prevPos = this.pos.copy();
          this.vel = p5.Vector.random2D();
          this.acc = p.createVector(0, 0);
          this.maxSpeed = 10;
          this.maxForce = 1;
          this.color = p.color(255);
          this.baseSize = p.random(2, 4); // Slightly smaller base size for density
          this.size = this.baseSize;
          this.offset = p.random(1000);
        }

        update() {
          this.prevPos = this.pos.copy(); 
          this.vel.add(this.acc);
          this.vel.limit(this.maxSpeed);
          this.pos.add(this.vel);
          this.acc.mult(0);
        }

        applyForce(force: p5.Vector) {
          this.acc.add(force);
        }

        seek(target: p5.Vector, arrival = false) {
          let desired = p5.Vector.sub(target, this.pos);
          let d = desired.mag();
          
          if (arrival && d < 100) {
            let m = p.map(d, 0, 100, 0, this.maxSpeed);
            desired.setMag(m);
          } else {
            desired.setMag(this.maxSpeed);
          }

          let steer = p5.Vector.sub(desired, this.vel);
          steer.limit(this.maxForce);
          this.applyForce(steer);
        }

        display(isTrail = false) {
          p.stroke(this.color);
          
          if (isTrail) {
            p.strokeWeight(this.size * 0.8);
            p.line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
          } else {
            p.strokeWeight(this.size);
            p.point(this.pos.x, this.pos.y);
          }
        }
      }

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        pg = p.createGraphics(p.width, p.height);
        
        for (let i = 0; i < numParticles; i++) {
          particles.push(new Particle());
        }
        
        prepareTextTargets("科技节启动");

        // Safety: Re-calculate targets after 500ms to ensure web fonts (Orbitron) are loaded
        setTimeout(() => {
          if (p.width > 0) prepareTextTargets("科技节启动");
        }, 500);
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        pg = p.createGraphics(p.width, p.height);
        prepareTextTargets("科技节启动");
      };

      function prepareTextTargets(str: string) {
        pg.clear();
        pg.background(0); // Ensure black background for contrast check
        pg.fill(255);
        // Adjusted text size to ensure it fits better
        pg.textSize(Math.min(p.width * 0.12, 200));
        pg.textAlign(p.CENTER, p.CENTER);
        pg.textStyle(p.BOLD);
        pg.textFont('Noto Sans SC'); 
        pg.text(str, p.width / 2, p.height / 2);
        
        textTargets = [];
        pg.loadPixels();
        
        // Robust High-DPI Handling:
        const d = pg.pixelDensity();
        const fullW = pg.width * d;
        const fullH = pg.height * d;
        
        // Sample step
        const step = 5; 
        
        // Loop through logical pixels
        for (let y = 0; y < p.height; y += step) {
          for (let x = 0; x < p.width; x += step) {
            const physX = Math.floor(x * d);
            const physY = Math.floor(y * d);

            if (physX >= fullW || physY >= fullH) continue;

            const index = 4 * (physY * fullW + physX);
            
            if (index < pg.pixels.length && pg.pixels[index] > 128) {
              textTargets.push(p.createVector(x, y));
            }
          }
        }
      }

      p.draw = () => {
        p.background(0, 0, 0, 50); 
        p.blendMode(p.ADD); 

        const currentState = stateRef.current;
        const center = p.createVector(p.width / 2, p.height / 2);

        // 1. Draw Background Ring (Only in waiting/early stages)
        if (currentState === LaunchState.WAITING || currentState === LaunchState.WAVE_DETECTED) {
           const breath = (p.sin(p.frameCount * 0.05) + 1) * 0.5; 
           p.noFill();
           p.stroke(255, 255, 255, 20);
           p.strokeWeight(1);
           p.circle(center.x, center.y, 500 + breath * 50);
        }

        particles.forEach((pt, idx) => {
          let force = p.createVector(0, 0);
          
          // Reset size default
          pt.size = pt.baseSize;

          if (currentState === LaunchState.WAITING) {
            pt.maxSpeed = 3;
            pt.color = p.color(100, 100, 120, 150);
            
            let noiseVal = p.noise(pt.pos.x * 0.003, pt.pos.y * 0.003, p.frameCount * 0.005);
            let angle = noiseVal * p.TWO_PI * 4;
            force = p5.Vector.fromAngle(angle);
            force.mult(0.5);
            pt.applyForce(force);
            
            // Wrap edges
            if(pt.pos.x<0) pt.pos.x=p.width; if(pt.pos.x>p.width) pt.pos.x=0;
            if(pt.pos.y<0) pt.pos.y=p.height; if(pt.pos.y>p.height) pt.pos.y=0;

          } else if (currentState === LaunchState.WAVE_DETECTED) {
            // High Energy Green/Cyan Flow
            pt.maxSpeed = 20;
            pt.maxForce = 0.8;
            pt.color = p.color(0, 255, 200, 150); 
            
            // Spiral vortex
            let dir = p5.Vector.sub(center, pt.pos);
            let dist = dir.mag();
            dir.normalize();
            let tangent = p.createVector(-dir.y, dir.x).mult(6);
            dir.mult(2);
            
            if (dist > 100) {
              pt.applyForce(dir);
              pt.applyForce(tangent);
            } else {
               pt.pos = p5.Vector.random2D().mult(p.width * 0.7).add(center);
               pt.prevPos = pt.pos.copy();
            }

          } else if (currentState === LaunchState.HEART_DETECTED) {
            // MIXED MODE: 
            // 40% of particles become "Emotion" (Pink/Warm), 60% keep "Tech" (Blue/Cool) background
            
            const isEmotion = (idx % 5) < 2; // 2 out of 5 particles are emotion

            if (isEmotion) {
                // Pink/Magenta / Warm
                pt.maxSpeed = 4;
                pt.maxForce = 0.1;
                
                // Breath size
                const pulse = p.sin(p.frameCount * 0.1 + pt.offset) * 0.5 + 1; 
                pt.size = pt.baseSize * 2 * pulse; // Bigger, softer
                pt.color = p.color(255, 50, 150, 150); // Soft Pink

                // Gentle diffuse movement (Cloud like)
                let angle = p.noise(pt.pos.x * 0.005, pt.pos.y * 0.005, p.frameCount * 0.01) * p.TWO_PI * 4;
                force = p5.Vector.fromAngle(angle);
                force.mult(0.5);
                pt.applyForce(force);

            } else {
                // Background Tech Blue (Slower than Step 1)
                pt.maxSpeed = 12;
                pt.maxForce = 0.5;
                pt.color = p.color(0, 100, 255, 60); // Faint Blue
                
                // Spiral still active but weaker
                let dir = p5.Vector.sub(center, pt.pos);
                dir.normalize();
                let tangent = p.createVector(-dir.y, dir.x).mult(3);
                pt.applyForce(tangent);
            }
            
            // Keep on screen
            if(pt.pos.x<0) pt.pos.x=p.width; if(pt.pos.x>p.width) pt.pos.x=0;
            if(pt.pos.y<0) pt.pos.y=p.height; if(pt.pos.y>p.height) pt.pos.y=0;

          } else if (currentState === LaunchState.LAUNCHING) {
            const elapsed = Date.now() - launchTimerRef.current;
            
            if (elapsed < 1200) {
              // IMPLOSION
              pt.maxSpeed = 35;
              pt.maxForce = 3;
              pt.color = p.color(255, 200, 50); // Gold
              pt.seek(center);
              
            } else if (elapsed < 2000) {
               // EXPLOSION
               if (elapsed < 1300 && pt.vel.mag() < 10) {
                 pt.vel = p5.Vector.random2D().mult(p.random(30, 80));
               }
               pt.maxSpeed = 60; 
               // Random bright colors
               if (p.random(1) > 0.6) pt.color = p.color(255, 255, 255, 220);
               else if (p.random(1) > 0.3) pt.color = p.color(255, 50, 50, 200);
               else pt.color = p.color(255, 200, 0, 200);
               
            } else {
               // TEXT FORMATION
               pt.maxSpeed = 15;
               pt.maxForce = 1.2;
               pt.color = p.color(100, 255, 255, 200); // Cyan/White Glow
               
               if (textTargets.length > 0) {
                 // CRITICAL FIX: Distribute particles evenly across the ENTIRE text length.
                 // Old logic (idx % length) would truncate text if targets > particles.
                 // New logic maps 0..numParticles to 0..textTargets.length
                 const targetIndex = Math.floor(p.map(idx, 0, particles.length, 0, textTargets.length));
                 const target = textTargets[targetIndex];
                 if (target) pt.seek(target, true);
               } else {
                 pt.seek(center, true);
               }
            }
          }

          pt.update();
          const isFast = pt.vel.mag() > 5;
          pt.display(isFast);
        });
        
        p.blendMode(p.BLEND);
      };
    };

    const p5Instance = new p5(sketch, containerRef.current);

    return () => {
      p5Instance.remove();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black" />;
};

export default Visualizer;
