import './style.css'
import { Pentagram } from './pentagram/type';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<canvas id="fill"></canvas>
`

const canvasFill = document.getElementById("fill") as HTMLCanvasElement
canvasFill.width = 1000 //window.innerWidth
canvasFill.height = 1000 //window.innerHeight

/* const config: Pentagram = {
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
}; */



/* main() */