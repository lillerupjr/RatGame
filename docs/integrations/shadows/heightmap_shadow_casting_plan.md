# Shadow Casting from Per-Pixel Height Maps

## Context

Our game is an isometric, orthographic, top-down 2D game. Assets are 3D models (.glb) rendered from 8 camera angles (45° increments, 30° pitch) to produce pre-rendered PNG sprites. Alongside each color sprite, we now bake a **per-pixel height map** — a grayscale RGBA image where each opaque pixel stores the world-space Z (vertical height) of the 3D surface at that pixel.

### Height Map Format

- **Encoding**: 8-bit grayscale (R=G=B=height, A=sprite alpha)
- **Normalization**: each asset's geometry is shifted so its base = 0, then mapped to a fixed range `[0, 1.0]` world units (the full AABB span)
  - `0` (black) = bottom of the asset's geometry (ground contact)
  - `255` (white) = 1.0 world units above the base
- **Relative sizes are preserved**: a short asset (e.g. a taxi, height span ~0.2) only reaches pixel value ~51, while a tall building (height span ~0.9) reaches ~230. No per-asset scaling is needed at runtime.
- **Alpha**: matches the color sprite exactly — transparent where there is no geometry
- **NEW file structure** (only in public\assets-runtime\base_db32\structures\buildings\batch1 so far): We now have access to both the images in \images, heightmaps in \heightmaps and normals in \normals. Note that there may be *minor* differences in alpha between the images and heightmap+normals. Therefore the alpha that determines the final shadow mask should be given by the image, and the heightmap sort of fitted to the image alpha. Note additionally that this file structure is only present for this specific folder (batch1).
- **Views**: 8 per asset, at 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315° yaw

Converting a pixel value to world-unit height:
```
height_in_world_units = (pixel_value / 255.0) * 1.0
```
No per-asset metadata is required — the pixel values can be used directly in the scene height buffer.

---

## Inputs

- **Scene height buffer**: a 2D texture/grid covering the visible scene, where each pixel holds the absolute world-space height of whatever occupies that position (terrain, building surface, etc.)
- **Light direction**: a 2D unit vector in screen space pointing toward the light source
- **Light elevation angle**: the sun's angle above the horizon (controls shadow length)

---

## Step 1: Composite the Scene Height Buffer

When placing sprites into the world, build a global height buffer:

1. For each asset placed in the scene, select the height map matching the current camera view angle
2. For each **opaque pixel** of that height map, write its value directly into the scene height buffer at the corresponding screen position — pixel values already encode comparable world-unit heights across all assets
3. Use the sprite's alpha mask to avoid overwriting pixels where there is no geometry
4. For overlapping assets, keep the front-most value (painter's order) or the tallest value, depending on compositing rules
5. Ground/terrain pixels with no geometry get height `0` (or terrain elevation if the map has hills)

---

## Step 2: Screen-Space Ray March (Shadow Stepping)

For each pixel in the scene, determine whether it is in shadow:

1. **Read the pixel's own height** from the height buffer: `H_self`
2. **Step along the light direction** in 2D screen space, moving toward the light source in fixed increments (`step_size` pixels)
3. At each step, sample the height buffer to get `H_sample`, and compute the **expected shadow ray height** at that distance:
   ```
   ray_height = H_self + step_distance * tan(light_elevation)
   ```
   where `step_distance` is the accumulated screen-space distance from the origin pixel
4. **If `H_sample > ray_height`** at any step → the pixel is **in shadow** (something taller is blocking the light). Terminate early.
5. **If the ray exits the screen** or exceeds `max_steps` without being blocked → the pixel is **lit**

### Ground Shadows

Ground pixels (height = 0) are the most common shadow receivers. The ray march from a ground pixel stepping toward the light will naturally hit a building's tall pixels, casting the building's silhouette as a shadow on the ground.

### Self-Shadowing

Building surfaces also shadow themselves. A pixel on a lower floor will be shadowed if the ray march hits a higher part of the same building (e.g. an upper floor or rooftop overhang) along the light direction.

---

## Step 3: Apply the Shadow Mask

After the ray march, each pixel has a binary (or soft) shadow value:

- **Binary**: multiply the pixel's color by a shadow factor (e.g. `0.4` for shadowed, `1.0` for lit)
- **Soft**: use the shadow value as a blend factor for smoother transitions

---

## Tuning Parameters

| Parameter | Description | Starting Value |
|---|---|---|
| `step_size` | Pixels to advance per ray march step. Smaller = more accurate, higher cost | 1–2 px |
| `max_steps` | Maximum steps before giving up. Limits shadow reach | `max_building_height / tan(elevation) / step_size` |
| `light_elevation` | Sun angle above horizon. Low = long shadows, high = short | 30°–45° |
| `light_direction` | 2D screen-space vector toward light. Rotate to simulate time of day | varies |
| `shadow_intensity` | How dark shadows are (0 = black, 1 = no shadow) | 0.3–0.5 |

---

## Performance Considerations

- The ray march is per-pixel and embarrassingly parallel — ideal for a **GPU fragment/compute shader**
- The height buffer is a single-channel texture, cheap to sample
- Early termination (stop on first occlusion) keeps average step count low
- For large scenes, cap `max_steps` and accept that very long shadows get clipped
- Can run at half resolution and upscale the shadow mask with a bilateral or Gaussian filter

---

## Optional: Soft Shadows

Instead of binary lit/shadowed, produce softer shadow edges:

- **Penumbra accumulation**: track the closest near-miss (smallest positive `H_sample - ray_height`) and use it to blend the shadow edge
- **Multi-sample**: jitter the light direction slightly across a few samples and average
- **Step counting**: count occluded steps vs total and use the ratio as shadow intensity
