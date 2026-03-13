#version 300 es
precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;
in vec2 v_uv;

out vec4 fragColor;

uniform vec4 u_color;
uniform vec3 u_viewPos;
uniform vec3 u_lightDir;
uniform vec3 u_lightColor;
uniform vec3 u_ambientColor;

void main() {
  vec3 N = normalize(v_normal);
  vec3 L = normalize(-u_lightDir);
  vec3 V = normalize(u_viewPos - v_worldPos);
  vec3 H = normalize(L + V);

  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 64.0) * 0.5;

  vec3 lighting = u_ambientColor + (diff + spec) * u_lightColor;
  fragColor = u_color * vec4(lighting, 1.0);
}
