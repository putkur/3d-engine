#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

uniform mat4 u_model;
uniform mat4 u_viewProjection;

out vec3 v_normal;
out vec2 v_uv;

void main() {
  v_normal = a_normal;
  v_uv = a_uv;
  gl_Position = u_viewProjection * u_model * vec4(a_position, 1.0);
}
