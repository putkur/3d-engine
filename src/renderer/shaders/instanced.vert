#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

// Per-instance model matrix (4 vec4 columns at locations 4-7)
layout(location = 4) in vec4 a_instanceModel0;
layout(location = 5) in vec4 a_instanceModel1;
layout(location = 6) in vec4 a_instanceModel2;
layout(location = 7) in vec4 a_instanceModel3;

uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv;

void main() {
  mat4 model = mat4(
    a_instanceModel0,
    a_instanceModel1,
    a_instanceModel2,
    a_instanceModel3
  );

  vec4 worldPos = model * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;

  // Compute normal matrix (inverse transpose of upper-left 3×3)
  mat3 normalMatrix = transpose(inverse(mat3(model)));
  v_normal = normalize(normalMatrix * a_normal);

  v_uv = a_uv;
  gl_Position = u_projection * u_view * worldPos;
}
