#version 300 es
precision highp float;

in vec2 v_uv;
in vec4 v_color;

out vec4 fragColor;

uniform sampler2D u_texture;
uniform int u_useTexture;

void main() {
  vec4 color = v_color;
  if (u_useTexture == 1) {
    color *= texture(u_texture, v_uv);
  }
  // Soft particle: premultiplied alpha
  fragColor = color;
}
