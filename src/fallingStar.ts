import './style.css'
import { Pentagram } from './pentagram/type';
import PentagramRenderer from './pentagram/type';

import NewPentagramRenderer from "./spin_star/type";
import initWgpu from './utils/initWgpu';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<canvas id="fill"></canvas>
`

const canvasFill = document.getElementById("fill") as HTMLCanvasElement
canvasFill.width = 1000 //window.innerWidth
canvasFill.height = 1000 //window.innerHeight

async function main() {
    const {device,context,format} = await initWgpu()

// 五芒星の頂点データを作成（塗りつぶし用の三角形で構成）
function createStarVertices(outerRadius = 0.5, innerRadius = 0.19) {
    const vertices = [];
    const numPoints = 5;
    const centerX = 0;
    const centerY = 0;

    // 外側と内側の頂点を計算
    for (let i = 0; i < numPoints * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI / numPoints) - Math.PI / 2;
        vertices.push(
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        );
    }

    // 三角形のインデックスを生成
    const indices = [];
    for (let i = 0; i < numPoints * 2; i++) {
        indices.push(i);
        indices.push((i + 1) % (numPoints * 2));
        indices.push(numPoints * 2); // 中心点のインデックス
    }

    // 中心点を追加
    vertices.push(centerX, centerY);

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}

// シェーダーの定義
const shaderCode = `
struct Uniforms {
    time: f32,
}

@binding(0) @group(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
    // 時間に基づいて回転と移動を計算
    let rotation = uniforms.time * 2.0;
    let moveX = -0.5 * uniforms.time;
    let moveY = -0.5 * uniforms.time;

    // 回転行列
    let c = cos(rotation);
    let s = sin(rotation);
    let rotMatrix = mat2x2<f32>(
        c, -s,
        s, c
    );

    // 頂点を回転させて移動
    let rotatedPos = rotMatrix * position;
    let finalPos = vec2<f32>(
        rotatedPos.x + moveX,
        rotatedPos.y + moveY
    );

    return vec4<f32>(finalPos, 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 1.0, 0.0, 1.0); // 黄色で塗りつぶし
}
`;

// パイプラインの設定
const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
        module: device.createShaderModule({ code: shaderCode }),
        entryPoint: 'vertexMain',
        buffers: [{
            arrayStride: 8,
            attributes: [{
                format: 'float32x2',
                offset: 0,
                shaderLocation: 0
            }]
        }]
    },
    fragment: {
        module: device.createShaderModule({ code: shaderCode }),
        entryPoint: 'fragmentMain',
        targets: [{ format: format }]
    },
    primitive: {
        topology: 'triangle-list'
    }
});

// 頂点データとインデックスデータの作成
const starData = createStarVertices();
const vertexBuffer = device.createBuffer({
    size: starData.vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, starData.vertices);

const indexBuffer = device.createBuffer({
    size: starData.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(indexBuffer, 0, starData.indices);

// Uniform バッファの作成
const uniformBuffer = device.createBuffer({
    size: 4, // float32 for time
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{
        binding: 0,
        resource: { buffer: uniformBuffer }
    }]
});

// 開始時間の記録
const startTime = performance.now();

// レンダリングループ
function render() {
    // 経過時間を計算（秒単位）
    const time = (performance.now() - startTime) / 1000;
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([time]));

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store'
        }]
    });

    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, uniformBindGroup);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint16');
    renderPass.drawIndexed(starData.indices.length, 1, 0, 0, 0);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(render);
}

render();
}

main()