#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;    // Billboard quad vertex
layout(location = 1) in vec2 a_uv;

// Per-particle instance data
layout(location = 2) in vec3  a_particlePos;
layout(location = 3) in float a_particleSize;
layout(location = 4) in vec4  a_particleColor;

uniform mat4 u_view;
uniform mat4 u_projection;

out vec2 v_uv;
out vec4 v_color;

void main() {
  v_uv = a_uv;
  v_color = a_particleColor;

  // Billboard: always face the camera
  vec3 cameraRight = vec3(u_view[0][0], u_view[1][0], u_view[2][0]);
  vec3 cameraUp    = vec3(u_view[0][1], u_view[1][1], u_view[2][1]);

  vec3 worldPos = a_particlePos
    + cameraRight * a_position.x * a_particleSize
    + cameraUp    * a_position.y * a_particleSize;

  gl_Position = u_projection * u_view * vec4(worldPos, 1.0);
}
