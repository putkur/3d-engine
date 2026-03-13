#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;
uniform float u_threshold;

void main() {
  vec3 color = texture(u_source, v_uv).rgb;
  float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
  if (brightness > u_threshold) {
    fragColor = vec4(color, 1.0);
  } else {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
}
