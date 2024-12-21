struct Uniforms {
    rotation: f32,
    color: vec3<f32>
}

@group(0) @binding(0)  var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>
}

// 2D Rotation Matrix
// | cosθ, sinθ |
// | -sinθ, cosθ |

// return 2x2 matrix
// | cos(angle), sin(angle) |
// | -sin(angle), cos(angle) |

fn rotate2d(angle:f32) -> mat2x2<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return mat2x2<f32>(
        vec2<f32>(c, s),
        vec2<f32>(-s, c)
    );
}

@vertex
fn vs_main(
    @builtin(vertex_index) vertexIndex: u32
) -> VertexOutput {
    let starOrder = array<u32, 5>(0u, 2u, 4u, 1u, 3u);
    let center = vec2<f32>(0.0, 0.0);
    let radius = 0.8;

    let idx = starOrder[vertexIndex % 5u];
    let angle = -3.14159 / 2.0 + (f32(idx) * 2.0 * 3.14159 / 5.0);
    var pos = vec2<f32>(
        center.x + radius * cos(angle),
        center.y + radius * sin(angle)
    );

    // Rotate
    pos = rotate2d(uniforms.rotation) * pos;

    var output: VertexOutput;
    output.position = vec4<f32>(pos.x, pos.y, 0.0, 1.0);
    output.color = vec4<f32>(uniforms.color, 1.0);
    return output;
}