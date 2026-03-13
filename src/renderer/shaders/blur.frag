#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;
uniform vec2 u_direction;  // (1/width, 0) for horizontal, (0, 1/height) for vertical

// 9-tap Gaussian weights
const float weight[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

void main() {
  vec2 texOffset = u_direction;
  vec3 result = texture(u_source, v_uv).rgb * weight[0];
  for (int i = 1; i < 5; i++) {
    result += texture(u_source, v_uv + texOffset * float(i)).rgb * weight[i];
    result += texture(u_source, v_uv - texOffset * float(i)).rgb * weight[i];
  }
  fragColor = vec4(result, 1.0);
}
