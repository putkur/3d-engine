#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  // Depth is written automatically. We need a valid frag output for WebGL2.
  fragColor = vec4(1.0);
}
