#version 300 es
precision highp float;

#define MAX_LIGHTS 8
#define PI 3.14159265359

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
in vec4 v_lightSpacePos;
in mat3 v_TBN;

out vec4 fragColor;

// Camera
uniform vec3 u_viewPos;

// Material (PBR metallic-roughness)
uniform vec4 u_albedoColor;
uniform float u_metallic;
uniform float u_roughness;
uniform float u_ao;           // ambient occlusion multiplier

// Texture maps
uniform sampler2D u_albedoMap;
uniform int u_useAlbedoMap;
uniform sampler2D u_normalMap;
uniform int u_useNormalMap;
uniform sampler2D u_metallicRoughnessMap; // B = metallic, G = roughness (glTF layout)
uniform int u_useMetallicRoughnessMap;

// Environment / IBL
uniform samplerCube u_envMap;
uniform int u_useEnvMap;
uniform float u_envIntensity;

// Ambient
uniform vec3 u_ambientColor;

// Lights
uniform int u_numLights;
uniform Light u_lights[MAX_LIGHTS];

// Shadow
uniform sampler2D u_shadowMap;
uniform int u_useShadowMap;
uniform float u_shadowBias;
uniform mat4 u_lightSpaceMatrix;

// ------------------------------------------------------------------
// PBR BRDF functions (Cook-Torrance)
// ------------------------------------------------------------------

/** Normal Distribution Function — GGX/Trowbridge-Reitz */
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a  = roughness * roughness;
  float a2 = a * a;
  float NdotH  = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  float denom = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

/** Geometry function — Schlick-GGX */
float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

/** Geometry — Smith's method (view + light) */
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

/** Fresnel — Schlick approximation */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/** Fresnel with roughness for IBL */
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// ------------------------------------------------------------------
// Shadow (reused from phong shader)
// ------------------------------------------------------------------

float calcShadow(vec4 lightSpacePos) {
  vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
  projCoords = projCoords * 0.5 + 0.5;
  if (projCoords.x < 0.0 || projCoords.x > 1.0 ||
      projCoords.y < 0.0 || projCoords.y > 1.0 ||
      projCoords.z > 1.0) {
    return 1.0;
  }
  float currentDepth = projCoords.z;
  float bias = u_shadowBias * 0.1;
  float shadow = 0.0;
  vec2 texelSize = 1.0 / vec2(textureSize(u_shadowMap, 0));
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float pcfDepth = texture(u_shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
      shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
    }
  }
  return shadow / 9.0;
}

// ------------------------------------------------------------------
// Light attenuation
// ------------------------------------------------------------------

void getLightDirection(Light light, out vec3 L, out float attenuation) {
  if (light.type == 0) {
    // Directional
    L = normalize(-light.direction);
    attenuation = 1.0;
  } else {
    vec3 toLight = light.position - v_worldPos;
    float dist = length(toLight);
    L = toLight / dist;
    attenuation = 1.0;
    if (light.range > 0.0) {
      attenuation = max(0.0, 1.0 - dist / light.range);
      attenuation *= attenuation;
    }
    if (light.type == 2) {
      float theta = dot(L, normalize(-light.direction));
      float epsilon = light.innerAngle - light.outerAngle;
      float spot = clamp((theta - light.outerAngle) / epsilon, 0.0, 1.0);
      attenuation *= spot;
    }
  }
}

// ------------------------------------------------------------------

void main() {
  // Normal
  vec3 N;
  if (u_useNormalMap == 1) {
    vec3 tangentNormal = texture(u_normalMap, v_uv).rgb * 2.0 - 1.0;
    N = normalize(v_TBN * tangentNormal);
  } else {
    N = normalize(v_normal);
  }

  vec3 V = normalize(u_viewPos - v_worldPos);

  // Albedo
  vec4 albedo4 = u_albedoColor;
  if (u_useAlbedoMap == 1) {
    albedo4 *= texture(u_albedoMap, v_uv);
  }
  vec3 albedo = albedo4.rgb;
  float alpha = albedo4.a;

  // Metallic / roughness
  float metallic = u_metallic;
  float roughness = u_roughness;
  if (u_useMetallicRoughnessMap == 1) {
    vec4 mr = texture(u_metallicRoughnessMap, v_uv);
    metallic *= mr.b;
    roughness *= mr.g;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // F0: reflectance at normal incidence
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, albedo, metallic);

  // Shadow
  float shadow = 1.0;
  if (u_useShadowMap == 1) {
    shadow = calcShadow(v_lightSpacePos);
  }

  // Accumulate direct lighting
  vec3 Lo = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_numLights) break;

    vec3 L;
    float attenuation;
    getLightDirection(u_lights[i], L, attenuation);

    vec3 H = normalize(V + L);
    vec3 radiance = u_lights[i].color * u_lights[i].intensity * attenuation;

    // Apply shadow only to the first directional light
    if (i == 0) {
      radiance *= shadow;
    }

    // Cook-Torrance BRDF
    float NDF = distributionGGX(N, H, roughness);
    float G   = geometrySmith(N, V, L, roughness);
    vec3  F   = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular = numerator / denominator;

    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);

    float NdotL = max(dot(N, L), 0.0);
    Lo += (kD * albedo / PI + specular) * radiance * NdotL;
  }

  // Ambient / IBL
  vec3 ambient;
  if (u_useEnvMap == 1) {
    vec3 R = reflect(-V, N);
    vec3 envColor = texture(u_envMap, R).rgb * u_envIntensity;
    vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    vec3 kD = (1.0 - F) * (1.0 - metallic);
    ambient = kD * albedo * u_ambientColor + F * envColor;
  } else {
    ambient = u_ambientColor * albedo;
  }
  ambient *= u_ao;

  vec3 color = ambient + Lo;

  fragColor = vec4(color, alpha);
}
