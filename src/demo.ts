import { Engine } from './core/Engine';

const engine = new Engine('#engine-canvas');
engine.init();
engine.start();

// Quick visual test: cycle the clear color over time
engine.on('render', () => {
  const t = engine.clock.getElapsed();
  const r = Math.sin(t * 0.5) * 0.15 + 0.15;
  const g = Math.sin(t * 0.3 + 1) * 0.15 + 0.15;
  const b = Math.sin(t * 0.7 + 2) * 0.2 + 0.2;
  engine.gl.clearColor(r, g, b, 1.0);
});
