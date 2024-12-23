import { Pentagram } from "../pentagram/type";
import vertexShader from "./vertex.wgsl?raw"
import fragmentShader from "./fragment.wgsl?raw"

export default class NewPentagramRenderer {
    private device: GPUDevice | null = null;
        private context: GPUCanvasContext | null = null;
        private renderPipeline: GPURenderPipeline | null = null;
        private vertexBuffer: GPUBuffer | null = null;
        private indexBuffer: GPUBuffer | null = null;
        private uniformBuffer: GPUBuffer | null = null;
        private bindGroup: GPUBindGroup | null = null;
        private config: Pentagram;
        private rotation: number = 0;
        private animationFrame: number | null = null;

    constructor(config: Pentagram) {
        this.config = config;
    }

    async initialize(canvas: HTMLCanvasElement) {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('WebGPU not supported');
        
        this.device = await adapter.requestDevice();
        this.context = canvas.getContext('webgpu')!;
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'premultiplied',
        });

        // 頂点データの作成（五角形の頂点）
        const vertices = this.createVertices();
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();

        // インデックスデータの作成（三角形の描画順序）
        const indices = this.config.fill ? 
            this.createFilledIndices() :
            this.createOutlineIndices();
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();

        // Uniform バッファの作成
        this.uniformBuffer = this.device.createBuffer({
            size: 4 * 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // パイプラインの作成
        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.device.createShaderModule({ code: vertexShader }),
                entryPoint: 'main',
                buffers: [{
                    arrayStride: 2 * 4, // 2 floats (x, y)
                    attributes: [{
                        format: 'float32x2',
                        offset: 0,
                        shaderLocation: 0,
                    }],
                }],
            },
            fragment: {
                module: this.device.createShaderModule({ code: fragmentShader }),
                entryPoint: 'main',
                targets: [{ format }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none',
            },
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer },
            }],
        });

        this.startAnimation();
    }

    private createVertices(): Float32Array {
        // 10個の頂点（外側の5点 + 内側の5点）
        const vertices = new Float32Array(20); // 10頂点 × (x, y)
        const outerRadius = 0.2;
        const innerRadius = outerRadius * 0.381966; // 黄金比に基づく内側の半径
        
        // 外側の5頂点
        for (let i = 0; i < 5; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
            vertices[i * 2] = outerRadius * Math.cos(angle);     // x
            vertices[i * 2 + 1] = outerRadius * Math.sin(angle); // y
        }
        
        // 内側の5頂点
        for (let i = 0; i < 5; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5) + Math.PI / 5;
            vertices[(i + 5) * 2] = innerRadius * Math.cos(angle);     // x
            vertices[(i + 5) * 2 + 1] = innerRadius * Math.sin(angle); // y
        }
        console.log(`Vertices Data: ${JSON.stringify(vertices,null,2)}`)
        return vertices;
    }

    private createFilledIndices(): Uint16Array {
        // 中央の五角形（3つの三角形）
        // 0,2,4は外側の頂点、5,6,7,8,9は内側の頂点（新しく追加）
        return new Uint16Array([
            // 中央の五角形を構成する3つの三角形
            5, 6, 7,    // 中央五角形の三角形1
            5, 7, 8,    // 中央五角形の三角形2
            5, 8, 9,    // 中央五角形の三角形3
            
            // 外側に伸びる5つの三角形
            0, 5, 9,    // 上部の三角形
            1, 6, 5,    // 右上の三角形
            2, 7, 6,    // 右下の三角形
            3, 8, 7,    // 左下の三角形
            4, 9, 8     // 左上の三角形
        ]);
    }

    private createOutlineIndices(): Uint16Array {
        // 外周線のためのインデックス
        return new Uint16Array([0, 2, 2, 4, 4, 1, 1, 3, 3, 0]);
    }

    render() {
        if(!this.device || !this.context || !this.renderPipeline)  return

        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        if (this.indexBuffer === null) return
        renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
        
        const indexCount = this.config.fill ? 24 : 10; // 塗りつぶし: 8三角形×3頂点, 輪郭: 5線×2頂点
        renderPass.drawIndexed(indexCount);
        
        renderPass.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }

    // その他のメソッド（updateUniforms, startAnimation, stop）は前回と同じ
    private updateUniforms() {
        const uniformData = new Float32Array([
            this.rotation,
            this.config.color.r,
            this.config.color.g,
            this.config.color.b
        ])
        console.log(`update Uniform Data: ${uniformData}`)
        if(!this.device || !this.uniformBuffer) return;
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            uniformData.buffer,
        )
    }
    private startAnimation() {
        if(!this.config.animation) return;
        
        const animate = () => {
            const {rotate, speed} = this.config.animation!;
            const rotationStep = (2 * Math.PI) / (speed / 16.7);

            if(rotate === "infinite") {
                this.rotation = (this.rotation + rotationStep) % (2 * Math.PI);
                this.updateUniforms();
                this.render();
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                const targetRotation = rotate * (Math.PI / 180);
                if(this.rotation < targetRotation) {
                    this.rotation += rotationStep;
                    this.updateUniforms();
                    this.render();
                    this.animationFrame = requestAnimationFrame(animate);
                }
            }
        }
        this.animationFrame = requestAnimationFrame(animate);
    }
    stop() {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
}