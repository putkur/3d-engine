#version 300 es
precision highp float;

in vec3 v_texCoord;
out vec4 fragColor;

uniform samplerCube u_skybox;

void main() {
  fragColor = texture(u_skybox, v_texCoord);
}
