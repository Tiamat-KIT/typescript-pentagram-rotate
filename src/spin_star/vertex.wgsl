struct Uniforms {
    rotation: f32,
    color: vec3<f32>,
};

@binding(0) @group(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

fn rotate2d(pos: vec2<f32>, angle: f32) -> vec2<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return vec2<f32>(
        pos.x * c - pos.y * s,
        pos.x * s + pos.y * c
    );
}

@vertex
fn main(
    @location(0) position: vec2<f32>
    
) -> VertexOutput {
    var output: VertexOutput;
    let rotated = rotate2d(position, uniforms.rotation);
    output.position = vec4<f32>(rotated * 0.8, 0.0, 1.0);
    output.color = vec4<f32>(uniforms.color, 1.0);
    return output;
}