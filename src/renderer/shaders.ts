// Basic unlit vertex shader
export const basicVert = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_color;

uniform mat4 u_modelViewProjection;

out vec3 v_color;

void main() {
  v_color = a_color;
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
}
`;

// Basic unlit fragment shader
export const basicFrag = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_color;
out vec4 fragColor;

uniform vec4 u_color;

void main() {
  // If per-vertex color is provided it's multiplied with uniform color
  fragColor = u_color * vec4(v_color, 1.0);
}
`;

// Standard unlit vertex shader — works with Mesh layout (pos=0, normal=1, uv=2)
export const standardVert = /* glsl */ `#version 300 es
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
`;

// Standard unlit fragment shader — basic directional shading for visibility
export const standardFrag = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_normal;
in vec2 v_uv;

out vec4 fragColor;

uniform vec4 u_color;

void main() {
  // Simple directional lighting for visual depth
  vec3 norm = normalize(v_normal);
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float diff = max(dot(norm, lightDir), 0.0);
  float ambient = 0.2;
  float light = ambient + diff * 0.8;
  fragColor = u_color * vec4(vec3(light), 1.0);
}
`;

// Blinn-Phong vertex shader
export const phongVert = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat3 u_normalMatrix;

out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv;

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = normalize(u_normalMatrix * a_normal);
  v_uv = a_uv;
  gl_Position = u_projection * u_view * worldPos;
}
`;

// Blinn-Phong fragment shader
export const phongFrag = /* glsl */ `#version 300 es
precision highp float;

#define MAX_LIGHTS 8

struct Light {
  int type;           // 0 = directional, 1 = point, 2 = spot
  vec3 position;
  vec3 direction;
  vec3 color;
  float intensity;
  float range;
  float innerAngle;
  float outerAngle;
};

in vec3 v_worldPos;
in vec3 v_normal;
in vec2 v_uv;

out vec4 fragColor;

uniform vec3 u_viewPos;
uniform vec4 u_diffuseColor;
uniform float u_specular;
uniform float u_shininess;
uniform sampler2D u_diffuseMap;
uniform int u_useDiffuseMap;
uniform vec3 u_ambientColor;

uniform int u_numLights;
uniform Light u_lights[MAX_LIGHTS];

vec3 calcLight(Light light, vec3 normal, vec3 viewDir) {
  vec3 lightDir;
  float attenuation = 1.0;

  if (light.type == 0) {
    // Directional
    lightDir = normalize(-light.direction);
  } else {
    // Point or Spot
    vec3 toLight = light.position - v_worldPos;
    float dist = length(toLight);
    lightDir = toLight / dist;
    if (light.range > 0.0) {
      attenuation = max(0.0, 1.0 - dist / light.range);
      attenuation *= attenuation;
    }
    if (light.type == 2) {
      // Spot
      float theta = dot(lightDir, normalize(-light.direction));
      float epsilon = light.innerAngle - light.outerAngle;
      float spotFactor = clamp((theta - light.outerAngle) / epsilon, 0.0, 1.0);
      attenuation *= spotFactor;
    }
  }

  // Diffuse
  float diff = max(dot(normal, lightDir), 0.0);

  // Blinn-Phong specular
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), u_shininess);

  vec3 diffuse = diff * light.color * light.intensity;
  vec3 specular = spec * u_specular * light.color * light.intensity;

  return (diffuse + specular) * attenuation;
}

void main() {
  vec3 normal = normalize(v_normal);
  vec3 viewDir = normalize(u_viewPos - v_worldPos);

  vec4 baseColor = u_diffuseColor;
  if (u_useDiffuseMap == 1) {
    baseColor *= texture(u_diffuseMap, v_uv);
  }

  vec3 lighting = u_ambientColor;

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_numLights) break;
    lighting += calcLight(u_lights[i], normal, viewDir);
  }

  fragColor = vec4(baseColor.rgb * lighting, baseColor.a);
}
`;
