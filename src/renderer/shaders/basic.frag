#version 300 es
precision highp float;

in vec3 v_color;
out vec4 fragColor;

uniform vec4 u_color;

void main() {
  // If per-vertex color is provided it's multiplied with uniform color
  fragColor = u_color * vec4(v_color, 1.0);
}
