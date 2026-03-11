#version 300 es
precision highp float;

in vec3 v_normal;
in vec2 v_uv;

out vec4 fragColor;

uniform vec4 u_color;

void main() {
  // Simple directional lighting for visual depth
  vec3 norm = normalize(v_normal);
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float diff = max(dot(norm, lightDir), 0.0);
  float ambient = 0.2;
  float light = ambient + diff * 0.8;
  fragColor = u_color * vec4(vec3(light), 1.0);
}
