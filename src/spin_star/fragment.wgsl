@fragment
fn main(
    @location(0) color: vec4<f32>
) -> @location(0) vec4<f32> {
    return vec4<f32>(color.x,color.y,0,1);
}