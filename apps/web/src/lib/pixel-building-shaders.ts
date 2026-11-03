/** Decorative architecture on real footprints. Windows, roofs and equipment are
 * an artistic interpretation, not surveyed features or economic entities. */
export const BUILDING_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec3 a_position;
in vec2 a_uv;
in vec3 a_style;
in vec2 a_size;
uniform mat4 u_matrix;

out vec2 v_uv;
flat out vec3 v_style;
flat out vec2 v_size;

void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
  v_uv = a_uv;
  v_style = a_style;
  v_size = a_size;
}
`;

export const BUILDING_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
flat in vec3 v_style;
flat in vec2 v_size;
out vec4 fragColor;

const float PIXEL = 0.20;
const float FLOOR_HEIGHT = 3.20;

// Integrate only the edge crossed by the screen pixel. Resolved shapes remain
// solid and crisp; subpixel frames stop flashing as the camera moves.
float boxCoverage(vec2 p, vec2 halfSize, vec2 footprint) {
  vec2 overlap = clamp(
    halfSize + footprint * 0.5 - abs(p), vec2(0.0), min(halfSize * 2.0, footprint)
  );
  vec2 coverage = overlap / footprint;
  return coverage.x * coverage.y;
}

float bandCoverage(float distance, float width, float footprint) {
  float overlap = clamp((width + footprint) * 0.5 - abs(distance), 0.0, min(width, footprint));
  return overlap / footprint;
}

float jointCoverage(float coordinate, float period, float width, float footprint) {
  float distance = mod(coordinate + period * 0.5, period) - period * 0.5;
  return bandCoverage(distance, width, footprint);
}

vec3 plaster(float variant) {
  if (variant < 0.5) return vec3(0.92, 0.83, 0.68);
  if (variant < 1.5) return vec3(0.80, 0.55, 0.39);
  if (variant < 2.5) return vec3(0.59, 0.75, 0.76);
  return vec3(0.74, 0.73, 0.63);
}

vec3 trimColor(float variant) {
  if (variant < 0.5) return vec3(0.98, 0.92, 0.79);
  if (variant < 1.5) return vec3(0.96, 0.84, 0.67);
  if (variant < 2.5) return vec3(0.93, 0.94, 0.86);
  return vec3(0.90, 0.88, 0.76);
}

vec3 roofColor(float variant) {
  if (variant < 0.5) return vec3(0.72, 0.34, 0.21);
  if (variant < 1.5) return vec3(0.31, 0.42, 0.48);
  if (variant < 2.5) return vec3(0.82, 0.44, 0.27);
  return vec3(0.47, 0.52, 0.44);
}

vec3 facade(vec2 p, vec2 size, float variant, vec2 footprint, float openings, float detail, float structure) {
  vec3 wall = plaster(variant);
  vec3 trim = trimColor(variant);
  vec3 glass = vec3(0.23, 0.42, 0.49);
  // The distant material contains the average cool tint of its openings, rather
  // than a dense window pattern that cannot be resolved at that distance.
  vec3 color = mix(wall, glass, 0.055 * (1.0 - openings));
  float socle = clamp((0.72 - p.y) / footprint.y + 0.5, 0.0, 1.0);
  color = mix(color, mix(wall, vec3(0.52, 0.40, 0.30), 0.44), socle);
  // Corners and the plinth give large plaster faces material structure without
  // adding a roof-wide or wall-wide high-frequency pattern.
  if (size.x > 3.0) {
    float corner = min(p.x, size.x - p.x);
    float pier = clamp((0.48 - corner) / footprint.x + 0.5, 0.0, 1.0);
    color = mix(color, trim * 0.92, pier * structure * 0.54);
  }

  // Small masonry joints are evaluated only when their world size is visible.
  if (detail > 0.01 && (p.y < 0.72 || variant > 2.5)) {
    float periodY = p.y < 0.72 ? 0.60 : 1.20;
    float periodX = p.y < 0.72 ? 1.20 : 2.40;
    float course = floor(p.y / periodY);
    float joints = max(
      jointCoverage(p.y, periodY, 0.12, footprint.y),
      jointCoverage(p.x + mod(course, 2.0) * periodX * 0.5, periodX, 0.12, footprint.x)
    );
    color *= 1.0 - joints * detail * 0.12;
  }

  // More breathing room between openings: the building reads as a facade first.
  if (openings > 0.01 && size.x > 1.80 && p.y > 0.85 && p.y < size.y - 0.65) {
    float targetBay = variant < 1.5 ? 3.80 : 4.20;
    float bays = max(1.0, floor(size.x / targetBay));
    float bayWidth = size.x / bays;
    float bayX = p.x - (floor(p.x / bayWidth) + 0.5) * bayWidth;
    vec2 wp = vec2(bayX, mod(p.y, FLOOR_HEIGHT) - 1.95);
    float halfWidth = min(0.72, bayWidth * 0.24);
    vec2 openingSize = vec2(halfWidth, 0.68);
    float opening = boxCoverage(wp, openingSize, footprint);
    // Medium-scale architecture survives the micro-detail LOD: a 40 cm frame
    // and 30 cm sill stay readable around an otherwise simple blue opening.
    vec2 frameSize = openingSize + vec2(0.40, 0.40);
    float outer = boxCoverage(wp, frameSize, footprint);
    float shadow = boxCoverage(wp - vec2(0.20, -0.20), frameSize, footprint);
    color *= 1.0 - max(0.0, shadow - outer) * openings * 0.16;
    color = mix(color, trim * 0.96, max(0.0, outer - opening) * openings);
    color = mix(color, glass, opening * openings);
    float sill = boxCoverage(wp + vec2(0.0, 1.16), vec2(halfWidth + 0.48, 0.15), footprint);
    color = mix(color, trim * 0.91, sill * openings);

    if (detail > 0.01) {
      // One broad reflection replaces the old crossbar/glint/checker pattern.
      float reflection = boxCoverage(
        wp - vec2(-halfWidth * 0.44, 0.30),
        vec2(halfWidth * 0.31, 0.16), footprint
      );
      color = mix(color, vec3(0.56, 0.75, 0.79), reflection * detail * openings * 0.72);
    }
  }

  // Entrance is a single quiet wood shape, with close-range framing only.
  if (openings > 0.01 && size.x > 4.20 && size.y > 2.80 && v_style.z > 0.82 && p.y < 2.95) {
    float bays = max(1.0, floor(size.x / 3.80));
    float bayWidth = size.x / bays;
    float entranceX = (floor(bays * 0.5) + 0.5) * bayWidth;
    vec2 dp = p - vec2(entranceX, 1.35);
    float door = boxCoverage(dp, vec2(0.60, 1.08), footprint);
    float frame = boxCoverage(dp, vec2(0.96, 1.44), footprint);
    color = mix(color, trim * 0.94, max(0.0, frame - door) * openings);
    color = mix(color, vec3(0.43, 0.29, 0.19), door * openings);
    if (detail > 0.01) {
      float knob = boxCoverage(dp - vec2(0.32, 0.0), vec2(0.10), footprint);
      color = mix(color, vec3(0.94, 0.74, 0.36), knob * detail * openings);
    }
  }

  // Broad cornice and roof contact carry the silhouette even at the coarse LOD.
  float cornice = bandCoverage(p.y - (size.y - 0.35), 0.50, footprint.y);
  float contact = bandCoverage(p.y - (size.y - 0.08), 0.16, footprint.y);
  color = mix(color, trim * 0.94, cornice * 0.84);
  color = mix(color, wall * 0.71, contact * 0.75);
  return color;
}

vec3 pitchedRoof(vec2 p, vec2 size, float variant, vec2 footprint, float detail) {
  vec3 base = roofColor(variant);
  vec3 color = base;
  if (detail > 0.01) {
    // Large, low-contrast ceramic/slate courses. They fade as a material instead
    // of turning into alternating bright/dark diagonal moire bands.
    float course = floor(p.y / 1.0);
    float offset = mod(course, 2.0) * 0.60;
    float seams = max(
      jointCoverage(p.y, 1.0, 0.12, footprint.y),
      jointCoverage(p.x + offset, 1.20, 0.10, footprint.x)
    );
    float highlight = bandCoverage(mod(p.y, 1.0) - 0.34, 0.18, footprint.y);
    color *= 1.0 + detail * (highlight * 0.055 - seams * 0.13);
  }

  float edge = min(min(p.x, size.x - p.x), min(p.y, size.y - p.y));
  float edgeFootprint = max(footprint.x, footprint.y);
  float eave = clamp((0.90 - edge) / edgeFootprint + 0.5, 0.0, 1.0);
  color = mix(color, base * 0.81, eave);
  float ridge = bandCoverage(p.y - size.y * 0.5, 1.0, footprint.y);
  color = mix(color, base * 1.10, ridge * 0.90);
  return color;
}

vec3 roofUnit(vec3 color, vec3 concrete, vec2 p, vec2 center, vec2 footprint, float structure) {
  vec2 ep = p - center;
  float shadow = boxCoverage(ep - vec2(0.55, -0.60), vec2(1.35, 1.80), footprint);
  float body = boxCoverage(ep, vec2(1.20, 1.55), footprint);
  float top = boxCoverage(ep + vec2(0.16), vec2(1.02, 1.28), footprint);
  float vent = boxCoverage(ep + vec2(0.16), vec2(0.62, 0.72), footprint);
  color = mix(color, concrete * 0.76, shadow * structure);
  color = mix(color, vec3(0.47, 0.56, 0.57), body * structure);
  color = mix(color, vec3(0.78, 0.84, 0.82), top * structure);
  return mix(color, vec3(0.47, 0.56, 0.57), vent * structure * 0.66);
}

vec3 flatRoof(vec2 p, vec2 size, float variant, vec2 footprint, float detail, float structure) {
  vec3 concrete = mix(vec3(0.73, 0.74, 0.67), trimColor(variant), 0.14);
  vec3 color = concrete;
  // Twelve-metre concrete panels and broad parapets are macro architecture,
  // independent of whether 20 cm art pixels can currently be resolved.
  float joints = max(
    jointCoverage(p.x, 12.0, 0.32, footprint.x),
    jointCoverage(p.y, 12.0, 0.32, footprint.y)
  );
  color *= 1.0 - joints * structure * 0.14;

  // One or two 2–3 m housings per large roof, never an equipment wallpaper.
  if (structure > 0.01 && min(size.x, size.y) > 9.0 && size.x * size.y > 140.0) {
    color = roofUnit(color, concrete, p, size * vec2(0.32, 0.42), footprint, structure);
    if (size.x * size.y > 1800.0 && min(size.x, size.y) > 14.0) {
      color = roofUnit(color, concrete, p, size * vec2(0.70, 0.62), footprint, structure);
    }
  }

  float edge = min(min(p.x, size.x - p.x), min(p.y, size.y - p.y));
  float edgeFootprint = max(footprint.x, footprint.y);
  float inner = clamp((1.18 - edge) / edgeFootprint + 0.5, 0.0, 1.0);
  float parapet = clamp((0.68 - edge) / edgeFootprint + 0.5, 0.0, 1.0);
  color = mix(color, concrete * 0.80, inner * 0.84);
  color = mix(color, trimColor(variant) * 0.97, parapet * 0.93);
  return color;
}

void main() {
  // Derivatives MUST use continuous world-space UVs before quantization and
  // before material branches. Units are metres covered by one framebuffer pixel.
  vec2 footprint = max(fwidth(v_uv), vec2(0.001));
  float span = max(footprint.x, footprint.y);
  float openings = 1.0 - smoothstep(0.65, 1.55, span);
  float detail = 1.0 - smoothstep(0.18, 0.55, span);
  float structure = 1.0 - smoothstep(1.20, 3.20, span);
  vec2 size = max(v_size, vec2(PIXEL));
  vec2 p = max(v_uv, vec2(0.0));
  // Quantize only when a 20 cm art pixel is actually resolved. Otherwise analytic
  // coverage filters hidden detail; nearest-neighbour canvas scaling stays pixel.
  if (span < PIXEL * 0.60) p = (floor(p / PIXEL) + 0.5) * PIXEL;
  float variant = clamp(floor(v_style.y + 0.5), 0.0, 3.0);
  vec3 color;
  if (v_style.x < 0.5) color = facade(p, size, variant, footprint, openings, detail, structure);
  else if (v_style.x < 1.5) color = pitchedRoof(p, size, variant, footprint, detail);
  else color = flatRoof(p, size, variant, footprint, detail, structure);

  // One face-light multiplication; shape/material hierarchy supplies the contrast.
  color *= clamp(v_style.z, 0.70, 1.08);
  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
