#version 300 es
precision highp float;

// Base mesh attributes
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

// Skinning attributes
layout(location = 4) in vec4 a_joints;   // joint indices (stored as float)
layout(location = 5) in vec4 a_weights;  // blend weights

// Uniforms shared with phong.vert
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat4 u_lightSpaceMatrix;

// Joint palette — max 128 joints
uniform mat4 u_jointMatrices[128];

out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv;
out vec4 v_lightSpacePos;

void main() {
  // Build blended skin matrix from up to 4 joints
  ivec4 j = ivec4(a_joints);
  vec4  w = a_weights;

  mat4 skin =
    w.x * u_jointMatrices[j.x] +
    w.y * u_jointMatrices[j.y] +
    w.z * u_jointMatrices[j.z] +
    w.w * u_jointMatrices[j.w];

  // Transform position through skin matrix, then model matrix
  vec4 skinnedPos    = skin * vec4(a_position, 1.0);
  vec4 worldPos      = u_model * skinnedPos;

  // Normal: use inverse-transpose of the skin's upper-3x3
  // (skin already combines world-space bone matrices, so no extra model needed for normals
  //  when model is identity — for non-identity models we apply model's normal matrix too)
  mat3 skinNormal = mat3(skin);
  // Compute cofactor matrix (adjugate transpose) for correct normal transform
  vec3 skinnedNormal = normalize(inverse(transpose(skinNormal)) * a_normal);

  v_worldPos      = worldPos.xyz;
  v_normal        = normalize(mat3(u_model) * skinnedNormal);
  v_uv            = a_uv;
  v_lightSpacePos = u_lightSpaceMatrix * worldPos;

  gl_Position = u_projection * u_view * worldPos;
}
