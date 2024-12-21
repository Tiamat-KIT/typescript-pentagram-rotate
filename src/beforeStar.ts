const vertexShader = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(
    @builtin(vertex_index) vertexIndex : u32
) -> VertexOutput {
    // 頂点インデックスの配列（五芒星を描く順序）
    let starOrder = array<u32, 5>(0u, 2u, 4u, 1u, 3u);
    
    // 中心座標と半径
    let center = vec2<f32>(0.0, 0.0);
    let radius = 0.8;
    
    // 正五角形の頂点を計算し、五芒星の順序で接続
    let baseAngle = -3.14159 / 2.0;
    let idx = starOrder[vertexIndex % 5u];
    let angle = baseAngle + (f32(idx) * 2.0 * 3.14159 / 5.0);
    
    let pos = vec2<f32>(
        center.x + radius * cos(angle),
        center.y + radius * sin(angle)
    );

    var output: VertexOutput;
    output.position = vec4<f32>(pos.x, pos.y, 0.0, 1.0);
    output.color = vec4<f32>(0.0, 0.0, 1.0, 1.0); // 青色
    return output;
}
`;

const fragmentShader = `
@fragment
fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
    return color;
}
`;

async function initWebGPU() {
    const gpu = navigator.gpu
    if(!gpu) {
        throw new Error("Not Supported WebGPU")
    }

    const adapter = await gpu.requestAdapter()
    if(!adapter) {
        throw new Error("WebGPU Not Supported")
    }
    const device: GPUDevice = await adapter.requestDevice({
        label: "Device"
    })
    const canvas = document.querySelector("canvas")
    if(!canvas) {
        throw new Error("Canvas Element Not Found")
    }
    const context = canvas.getContext("webgpu")
    if(!context) {
        throw new Error("WebGPU Not Supported")
    }
    const format = gpu.getPreferredCanvasFormat()

    context.configure({
        device,
        format,
        alphaMode: "premultiplied"
    })

    const shader = device.createShaderModule({
        label: "Pentagon and Pentagram Shaders",
        code: vertexShader + fragmentShader
    })

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shader,
            entryPoint: "vs_main"
        },
        fragment: {
            module: shader,
            entryPoint: "fs_main",
            targets:[{
                format
            }]
        },
        primitive: {
            topology: "line-strip",
            stripIndexFormat: "uint32"
        }
    })

    function render() {
        const commandEncoder = device.createCommandEncoder()
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context?.getCurrentTexture().createView(),
                clearValue: {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 0
                },
                loadOp: "clear",
                storeOp: "store"
            }] as Iterable<GPURenderPassColorAttachment>
        })

        renderPass.setPipeline(pipeline)
        renderPass.draw(6)
        renderPass.end()

        device.queue.submit([commandEncoder.finish()])
    }

    function frame() {
        render()
        requestAnimationFrame(frame)
    }
    frame()
}

initWebGPU().then(() => console.log("View"))