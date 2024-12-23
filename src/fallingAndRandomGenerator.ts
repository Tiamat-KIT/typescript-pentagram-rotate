import initWgpu from "./utils/initWgpu";

export default async function complete() {
    const {context,device,format} = await initWgpu()
    // 星の数を定義
    const NUM_STARS = 500;

    // 星のインスタンスデータを生成
    function createStarInstances() {
        const instances = [];
        for (let i = 0; i < NUM_STARS; i++) {
            // ランダムな位置（-1.0 から 1.0 の範囲）
            const x = (Math.random() * 2 - 1) * 0.8;
            const y = (Math.random() * 2 - 1) * 0.8;
            // ランダムなスケール（0.02 から 0.08 の範囲）
            const scale = 0.02 + Math.random() * 0.06;
            // ランダムな初期角度
            const initialRotation = Math.random() * Math.PI * 2;
            // ランダムな移動速度
            const speedX = (Math.random() - 0.5) * 0.5;
            const speedY = (Math.random() - 0.5) * 0.5;
            const rotationSpeed = (Math.random() - 0.5) * 3;

            instances.push(x, y, scale, initialRotation, speedX, speedY, rotationSpeed);
        }
        return new Float32Array(instances);
    }

    // 五芒星の頂点データを作成
    function createStarVertices(outerRadius = 1.0, innerRadius = 0.38) {
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

    struct InstanceInput {
        @location(2) position: vec2<f32>,
        @location(3) scale: f32,
        @location(4) initialRotation: f32,
        @location(5) speed: vec2<f32>,
        @location(6) rotationSpeed: f32,
    }

    @binding(0) @group(0) var<uniform> uniforms: Uniforms;

    @vertex
    fn vertexMain(
        @location(0) position: vec2<f32>,
        @builtin(instance_index) instanceIdx: u32,
        instance: InstanceInput,
    ) -> @builtin(position) vec4<f32> {
        // 時間に基づいて回転と移動を計算
        let rotation = instance.initialRotation + uniforms.time * instance.rotationSpeed;
        let moveX = instance.position.x + instance.speed.x * uniforms.time;
        let moveY = instance.position.y + instance.speed.y * uniforms.time;

        // 回転行列
        let c = cos(rotation);
        let s = sin(rotation);
        let rotMatrix = mat2x2<f32>(
            c, -s,
            s, c
        );

        // スケーリングと回転を適用
        let scaledPos = position * instance.scale;
        let rotatedPos = rotMatrix * scaledPos;
        
        // 最終位置の計算（画面内でラップする）
        var wrappedX = select(moveX, moveX + 2.0, moveX < -1.0);
        wrappedX = select(wrappedX, wrappedX - 2.0, wrappedX > 1.0);
        var wrappedY = select(moveY, moveY + 2.0, moveY < -1.0);
        wrappedY = select(wrappedY, wrappedY - 2.0, wrappedY > 1.0);

        let finalPos = vec2<f32>(
            rotatedPos.x + wrappedX,
            rotatedPos.y + wrappedY
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
            buffers: [
                {
                    // 頂点座標
                    arrayStride: 8,
                    attributes: [{
                        format: 'float32x2',
                        offset: 0,
                        shaderLocation: 0
                    }]
                },
                {
                    // インスタンスデータ
                    arrayStride: 28, // 7 floats * 4 bytes
                    stepMode: 'instance',
                    attributes: [
                        {
                            format: 'float32x2',
                            offset: 0,
                            shaderLocation: 2
                        },
                        {
                            format: 'float32',
                            offset: 8,
                            shaderLocation: 3
                        },
                        {
                            format: 'float32',
                            offset: 12,
                            shaderLocation: 4
                        },
                        {
                            format: 'float32x2',
                            offset: 16,
                            shaderLocation: 5
                        },
                        {
                            format: 'float32',
                            offset: 24,
                            shaderLocation: 6
                        }
                    ]
                }
            ]
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

    // インスタンスデータの作成
    const instanceData = createStarInstances();
    const instanceBuffer = device.createBuffer({
        size: instanceData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(instanceBuffer, 0, instanceData);

    // Uniform バッファの作成
    const uniformBuffer = device.createBuffer({
        size: 4,
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
        renderPass.setVertexBuffer(1, instanceBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint16');
        renderPass.drawIndexed(starData.indices.length, NUM_STARS, 0, 0, 0);
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    }

    render();
}
