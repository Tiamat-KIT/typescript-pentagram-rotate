import { Pentagram } from "../pentagram/type";

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
            size: 4 * 11,// 4 * 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // パイプラインの作成
        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.device.createShaderModule({ code: this.getVertexShader() }),
                entryPoint: 'main',
                buffers: [{
                    arrayStride: 12, // float2 position + float is_outer
                    attributes: [
                        {
                            format: 'float32x2',
                            offset: 0,
                            shaderLocation: 0,
                        },
                        {
                            format: 'float32',
                            offset: 8,
                            shaderLocation: 1,
                        }
                    ],
                }],
            },
            fragment: {
                module: this.device.createShaderModule({ code: this.getFragmentShader() }),
                entryPoint: 'main',
                targets: [{
                    format: this.context.getCurrentTexture().format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                        },
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none',
            },
            multisample: {
                count: this.config.effects?.antialiasing ? 4 : 1,
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
        const outerRadius = 0.8;
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

    private getVertexShader(): string {
        return `
        struct Uniforms {
            rotation: f32,
            inner_color: vec4<f32>,
            outer_color: vec4<f32>,
            use_gradient: f32,
            opacity: f32,
        };

        @binding(0) @group(0) var<uniform> uniforms: Uniforms;

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) color: vec4<f32>,
            @location(1) uv: vec2<f32>,
            @location(2) is_outer: f32,
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
            @location(0) position: vec2<f32>,
            @location(1) is_outer_vertex: f32,
        ) -> VertexOutput {
            var output: VertexOutput;
            let rotated = rotate2d(position, uniforms.rotation);
            
            // デバイス座標に変換
            output.position = vec4<f32>(rotated, 0.0, 1.0);
            
            // グラデーション用のUV座標を計算
            output.uv = (position + 1.0) * 0.5;
            
            // 外側/内側の頂点フラグを渡す
            output.is_outer = is_outer_vertex;
            
            // 基本色を設定
            output.color = uniforms.outer_color;
            if (is_outer_vertex < 0.5) {
                output.color = uniforms.inner_color;
            }
            
            return output;
        }`;
    }

    private getFragmentShader(): string {
        return `
        @fragment
        fn main(
            @location(0) color: vec4<f32>,
            @location(1) uv: vec2<f32>,
            @location(2) is_outer: f32,
        ) -> @location(0) vec4<f32> {
            var final_color = color;
            
            // グラデーション効果
            if (uniforms.use_gradient > 0.5) {
                let t = length(uv - 0.5) * 2.0;
                final_color = mix(uniforms.inner_color, uniforms.outer_color, t);
            }
            
            // アンチエイリアス効果（エッジの周りでスムージング）
            let edge_distance = abs(length(uv - 0.5) * 2.0 - 1.0);
            let alpha = 1.0 - smoothstep(0.0, 0.01, edge_distance);
            
            // 透明度を適用
            final_color.a *= uniforms.opacity * alpha;
            
            return final_color;
        }`;
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
        if(!this.device || !this.uniformBuffer) return;
        const uniformData = new Float32Array([
            this.rotation,
            // 内側の色
            ...(this.config.effects?.gradient?.innerColor ? [this.config.effects.gradient.innerColor.r, this.config.effects.gradient.innerColor.g, this.config.effects.gradient.innerColor.b] : [this.config.color.r, this.config.color.g, this.config.color.b]),
            1.0,
            // 外側の色
            ...(this.config.effects?.gradient?.outerColor ? [this.config.effects.gradient.outerColor.r, this.config.effects.gradient.outerColor.g, this.config.effects.gradient.outerColor.b] : [this.config.color.r, this.config.color.g, this.config.color.b]),
            1.0,
            // グラデーション使用フラグ
            this.config.effects?.gradient ? 1.0 : 0.0,
            // 透明度
            this.config.effects?.opacity ?? 1.0,
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
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