#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_scene;       // Main scene texture
uniform sampler2D u_bloom;       // Bloom texture (blurred bright areas)

// Tone mapping & effects
uniform float u_exposure;        // HDR exposure (default 1.0)
uniform float u_bloomStrength;   // Bloom mix amount (0 = off, default 0.3)
uniform float u_vignetteStrength;// Vignette darkening (0 = off, default 0.4)
uniform float u_saturation;      // Color saturation (1.0 = normal)
uniform int u_enableFXAA;        // FXAA toggle

// FXAA constants
const float FXAA_REDUCE_MIN = 1.0 / 128.0;
const float FXAA_REDUCE_MUL = 1.0 / 8.0;
const float FXAA_SPAN_MAX   = 8.0;

/**
 * Fast Approximate Anti-Aliasing (FXAA 3.11 simplified).
 */
vec3 applyFXAA(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 rgbNW = texture(tex, uv + vec2(-1.0, -1.0) * texelSize).rgb;
  vec3 rgbNE = texture(tex, uv + vec2( 1.0, -1.0) * texelSize).rgb;
  vec3 rgbSW = texture(tex, uv + vec2(-1.0,  1.0) * texelSize).rgb;
  vec3 rgbSE = texture(tex, uv + vec2( 1.0,  1.0) * texelSize).rgb;
  vec3 rgbM  = texture(tex, uv).rgb;

  vec3 luma = vec3(0.299, 0.587, 0.114);
  float lumaNW = dot(rgbNW, luma);
  float lumaNE = dot(rgbNE, luma);
  float lumaSW = dot(rgbSW, luma);
  float lumaSE = dot(rgbSE, luma);
  float lumaM  = dot(rgbM, luma);

  float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

  vec2 dir;
  dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
  dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

  float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * FXAA_REDUCE_MUL, FXAA_REDUCE_MIN);
  float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = min(vec2(FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX), dir * rcpDirMin)) * texelSize;

  vec3 rgbA = 0.5 * (
    texture(tex, uv + dir * (1.0 / 3.0 - 0.5)).rgb +
    texture(tex, uv + dir * (2.0 / 3.0 - 0.5)).rgb
  );
  vec3 rgbB = rgbA * 0.5 + 0.25 * (
    texture(tex, uv + dir * -0.5).rgb +
    texture(tex, uv + dir *  0.5).rgb
  );

  float lumaB = dot(rgbB, luma);
  if (lumaB < lumaMin || lumaB > lumaMax) {
    return rgbA;
  }
  return rgbB;
}

/**
 * Reinhard tone mapping.
 */
vec3 toneMapReinhard(vec3 color) {
  return color / (color + vec3(1.0));
}

/**
 * ACES Filmic tone mapping (approximate).
 */
vec3 toneMapACES(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 texelSize = 1.0 / vec2(textureSize(u_scene, 0));

  // Sample scene color (with optional FXAA)
  vec3 color;
  if (u_enableFXAA == 1) {
    color = applyFXAA(u_scene, v_uv, texelSize);
  } else {
    color = texture(u_scene, v_uv).rgb;
  }

  // Add bloom
  vec3 bloom = texture(u_bloom, v_uv).rgb;
  color = mix(color, color + bloom, u_bloomStrength);

  // Exposure
  color *= u_exposure;

  // Tone mapping (ACES filmic)
  color = toneMapACES(color);

  // Saturation
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);

  // Vignette
  vec2 uv = v_uv * 2.0 - 1.0;
  float vignette = 1.0 - dot(uv, uv) * u_vignetteStrength;
  color *= clamp(vignette, 0.0, 1.0);

  // Gamma correction (linear → sRGB)
  color = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(color, 1.0);
}
