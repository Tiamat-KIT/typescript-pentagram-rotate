import vertexShader from "./vertex.wgsl?raw";
import fragmentShader from "./fragment.wgsl?raw";

export type Pentagram = {
    color: Record<"r" | "g" | "b", number>,
    fill: boolean,
    animation?: {
        rotate: "infinite" | number,
        speed: number
    },
    effects?: {
        gradient?: {
            innerColor: { r: number; g: number; b: number };
            outerColor: { r: number; g: number; b: number };
        };
        opacity?: number;
        antialiasing?: boolean;
    };
}


export default class PentagramRenderer {
    private device: GPUDevice | null = null;
    private context: GPUCanvasContext | null = null;
    private renderPipeline: GPURenderPipeline | null = null;
    private uniformBuffer: GPUBuffer | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private pentagram: Pentagram;
    private rotation: number = 0;
    private animationFrame: number | null = null;

    constructor(pentagram: Pentagram) {
        this.pentagram = pentagram;
    }

    async init(canvas: HTMLCanvasElement) {
        const adapter = await navigator.gpu.requestAdapter()
        if(!adapter) {
            throw new Error("WebGPU Not Supported")
        }
        this.device = await adapter.requestDevice()

        this.context = canvas.getContext("webgpu")
        if(!this.context) {
            throw new Error("WebGPU Not Supported")
        }

        const format = navigator.gpu.getPreferredCanvasFormat()
        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: "premultiplied"
        })

        this.uniformBuffer = this.device.createBuffer({
            size: 4 * 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })

        this.renderPipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: this.device.createShaderModule({
                    code: vertexShader,
                }),
                entryPoint: "vs_main",
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: fragmentShader
                }),
                entryPoint: "fs_main",
                targets: [{
                    format: format
                }]
            },
            primitive: {
                topology: this.pentagram.fill ? "triangle-strip" : "line-strip",
                stripIndexFormat: "uint32"
            }
        })

        this.bindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.uniformBuffer
                }
            }]
        })
        this.startAnimation()
    }

    private updateUniforms() {
        const uniformData = new Float32Array([
            this.rotation,
            this.pentagram.color.r,
            this.pentagram.color.g,
            this.pentagram.color.b
        ])
        if(!this.device || !this.uniformBuffer) return;
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            uniformData.buffer,
        )
    }
    private startAnimation() {
        if(!this.pentagram.animation) return;
        
        const animate = () => {
            const {rotate, speed} = this.pentagram.animation!;
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
    render(){
        if(!this.device || !this.context) return
        const commandEncoder = this.device.createCommandEncoder()
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: {r: 0, g: 0, b: 0, a: 0},
                storeOp: "store",
                loadOp: "clear"
            }]
        })
        if(!renderPass || !this.renderPipeline) return
        renderPass.setPipeline(this.renderPipeline)
        renderPass.setBindGroup(0, this.bindGroup)
        renderPass.draw(6)
        renderPass.end()

        this.device.queue.submit([commandEncoder.finish()])
    }
    stop() {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
}