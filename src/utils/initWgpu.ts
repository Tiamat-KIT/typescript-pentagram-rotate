export default async function initWgpu(){
    const canvas = document.querySelector("canvas")
    if(!canvas) throw new Error()
    let adapter = await navigator.gpu.requestAdapter()
    if(!adapter) throw new Error()

    const device = await adapter.requestDevice()
    const context = canvas.getContext("webgpu")
    if(!context) throw new Error();

    const format = navigator.gpu.getPreferredCanvasFormat()
    

    context.configure({
        device,
        format,
        alphaMode: "premultiplied",
    })
    return {
        device, context, format
    }

}
