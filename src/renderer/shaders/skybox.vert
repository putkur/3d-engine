#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;

uniform mat4 u_viewProjection; // view matrix with translation zeroed × projection

out vec3 v_texCoord;

void main() {
  v_texCoord = a_position;
  vec4 pos = u_viewProjection * vec4(a_position, 1.0);
  // Set z = w so the skybox is always at max depth
  gl_Position = pos.xyww;
}
