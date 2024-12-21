import './style.css'
import { Pentagram } from './pentagram/type';
import PentagramRenderer from './pentagram/type';

import NewPentagramRenderer from "./all_draw_pentagram/type";

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<canvas id="unfill"></canvas>
<canvas id="fill"></canvas>
`

/* const canvas = document.getElementById("unfill") as HTMLCanvasElement
canvas.width = window.innerWidth
canvas.height = window.innerHeight

const config: Pentagram = {
    color: {
        r: 0,
        g: 0,
        b: 255,
    },
    fill: false,
    animation: {
        rotate: "infinite",
        speed: 3000
    }
}

const renderer = new PentagramRenderer(config)
renderer.init(canvas).catch(console.error) */

const canvasFill = document.getElementById("fill") as HTMLCanvasElement
canvasFill.width = window.innerWidth
canvasFill.height = window.innerHeight

const config: Pentagram = {
    color: { r: 0, g: 0, b: 1 }, // 青色
    fill: true,
    animation: {
        rotate: "infinite",
        speed: 3000
    },
    effects: {
        gradient: {
            innerColor: { r: 1, g: 0, b: 0 }, // 赤
            outerColor: { r: 0, g: 0, b: 1 }  // 青
        },
        opacity: 0.8,
        antialiasing: true
    }
};

const rendererFill = new NewPentagramRenderer(config)
rendererFill.initialize(canvasFill).catch(console.error)
