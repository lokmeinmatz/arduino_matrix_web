import { GIFGroover } from './GIFGroover'

import { loadRaw } from './gif'

interface DomElements {
    ip: HTMLInputElement,
    test: HTMLButtonElement
    update: HTMLButtonElement
    autoUpdate: HTMLInputElement
    colorSlider: Slider,
    matrix: HTMLDivElement,
    cells: HTMLDivElement[][],
    frameSelector: HTMLDivElement
}

const dom: DomElements = {
    ip: null,
    test: null,
    update: null,
    autoUpdate: null,
    colorSlider: null,
    matrix: null,
    cells: null,
    frameSelector: null
};

// debug
(<any>window).uidom = dom


let frameIndex = 0
const frames: Uint8Array[] = [new Uint8Array(64 * 3)]
frames[0].fill(0)

function setVisibleFrame(idx: number) {
    console.log(`setting visible frame to ${idx}`)
    frameIndex = idx
    dom.frameSelector.querySelectorAll('.frame-preview').forEach(e => e.classList.remove('active'))
    dom.frameSelector.children[idx].classList.add('active')

    // set all cells
    for(let x = 0; x < 8; x++) {
        for(let y = 0; y < 8; y++) {
            const idx = (x + y * 8) * 3
            const r = frames[frameIndex][idx]
            const g = frames[frameIndex][idx + 1]
            const b = frames[frameIndex][idx + 2]
            dom.cells[x][y].style.backgroundColor = `rgb(${r},${g},${b})`
        }
    }

    uploadMatrix(frameIndex)
}

function updateFrameSelectorUI() {
    let framesDoms = dom.frameSelector.querySelectorAll('.frame-preview')

    framesDoms.forEach(e => dom.frameSelector.removeChild(e))
    
    const addFrameBtn = dom.frameSelector.children[0]
    //console.log(frames)
    
    for(let fi = 0; fi < frames.length; fi++) {
        let el = document.createElement('div')
        el.classList.add('frame-preview')
        el.textContent = `Frame ${fi + 1}`
        el.onclick = () => {
            setVisibleFrame(fi)
        }
        dom.frameSelector.insertBefore(el, addFrameBtn)
    }

    setVisibleFrame(frameIndex)
}

class Slider {
    bar: HTMLDivElement
    knob: HTMLDivElement
    lastValue: number

    private barXLimits(): { from: number, to: number } {
        const rect = this.bar.getBoundingClientRect()
        return { from: rect.left, to: rect.right }
    }

    constructor(bar: HTMLDivElement) {
        this.bar = bar
        this.lastValue = 0
        this.knob = bar.querySelector('.slider-knob')
        this.bar.onclick = evt => {

            let x = evt.clientX
            const { from, to } = this.barXLimits()

            x = Math.min(to, Math.max(from - 7, x - 7)) - from

            this.lastValue = x / (to - from)
            this.knob.style.left = (x - 7) + 'px'

        }

        this.bar.ontouchmove = evt => {
            let x = evt.changedTouches[0].pageX
            const { from, to } = this.barXLimits()
            console.log(evt)
            x = Math.min(to, Math.max(from - 15, x - 15))

            this.lastValue = x / (to - from)
            console.log('touch', x, this.lastValue)
            this.knob.style.left = (x - 7) + 'px'
        }

    }
}

// from https://www.rapidtables.com/convert/color/hsv-to-rgb.html
function HSVtoRGB(h: number, s: number, v: number): { r: number, g: number, b: number } {
    h = Math.min(360, Math.max(0, h))
    const c = v * s
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = v - c
    let mid
    if (h < 60) mid = [c, x, 0]
    else if (h < 120) mid = [x, c, 0]
    else if (h < 180) mid = [0, c, x]
    else if (h < 240) mid = [0, x, c]
    else if (h < 300) mid = [x, 0, c]
    else mid = [c, 0, x]
    return {
        r: (mid[0] + m) * 255,
        g: (mid[1] + m) * 255,
        b: (mid[2] + m) * 255
    }
}


async function testMatrix(): Promise<boolean> {

    const ipaddr = dom.ip.value

    if (ipaddr.length < 2) return false
    try {
        const res = await fetch(`http://${ipaddr}/`, {
            headers: {
                'Content-Type': 'text/plain'
            }
        })
        console.log(res)
        if (res.status == 200) {
            const pl = await res.text()
            if (pl == 'I am alive!') return true
        }
    } catch (e) {
        console.error(e)
    }
    return false
}

async function uploadMatrix(frameIndex: number) {
    const res = await fetch(`http://${dom.ip.value}/all`, {
        headers: {
            'Content-Type': 'text/plain'
        },
        method: 'POST',
        body: frames[frameIndex]
    })

    if (res.status != 200) console.error(res)
}

let reqInFlight = false

interface DeltaPixelUpdate {
    x: number
    y: number
    r: number
    g: number
    b: number
}

const updateQueue: Map<[number, number], DeltaPixelUpdate> = new Map();
(<any> window).uq = updateQueue

async function sendDeltaUpdate() {
    reqInFlight = true
    let postsSend = 0
    while (updateQueue.size > 0) {
        if (updateQueue.size > 255) {
            console.error('updateQueue size > 255!')
            return
        }
        postsSend++
        
        const body = new Uint8Array(1 + updateQueue.size * 5)
        body[0] = updateQueue.size
    
        let idx = 1
        updateQueue.forEach(ud => {
            body[idx] = ud.x
            body[idx + 1] = ud.y
            body[idx + 2] = ud.r
            body[idx + 3] = ud.g
            body[idx + 4] = ud.b
            idx += 5
        })
    
        if(idx != updateQueue.size * 5 + 1) console.error('idx != size after copy')
        updateQueue.clear()
        console.time('delta update')
        const res = await fetch(`http://${dom.ip.value}/`, {
            headers: {
                'Content-Type': 'text/plain'
            },
            method: 'POST',
            body: body
        })
    
        console.timeEnd('delta update')
        if (res.status != 200) console.error(res, await res.text())
    }
    console.log(`Send ${postsSend} posts`)
    reqInFlight = false
}

// sets the ccolor inside the matrixColors array and UI
async function setPixelColor(x: number, y: number, r: number, g: number, b: number, sendDelta = true) {
    r = Math.min(255, Math.floor(r))
    g = Math.min(255, Math.floor(g))
    b = Math.min(255, Math.floor(b))
    const idx = (y * 8 + x) * 3
    frames[frameIndex][idx] = r
    frames[frameIndex][idx + 1] = g
    frames[frameIndex][idx + 2] = b

    dom.cells[x][y].style.backgroundColor = `rgb(${r},${g},${b})`

    if (sendDelta) {

        const dup: DeltaPixelUpdate = {
            x, y, r, g, b
        }

        updateQueue.set([x, y], dup)

        if (!reqInFlight) sendDeltaUpdate()
    }
}

window.onload = () => {
    // --- get dom elements ---
    dom.ip = <HTMLInputElement>document.getElementById('ip')
    dom.test = <HTMLButtonElement>document.getElementById('test')
    dom.update = <HTMLButtonElement>document.getElementById('update')
    dom.autoUpdate = <HTMLInputElement>document.getElementById('autoupdate')
    dom.colorSlider = new Slider(
        <HTMLDivElement>document.getElementById('colorpicker-container')
    )
    dom.matrix = <HTMLDivElement>document.getElementById('matrix')
    dom.cells = []
    dom.frameSelector = <HTMLDivElement> document.getElementById('frame-selector')
    // ------------------------

    const drawCell: (x: number, y: number) => void = (x, y) => {
        const { r, g, b } = HSVtoRGB((1 - dom.colorSlider.lastValue) * 360, 1, 1)
        setPixelColor(x, y, r, g, b)
        //uploadMatrix()
    }

    document.getElementById('white').onclick = () => {
        frames[frameIndex].fill(255)
        uploadMatrix(frameIndex)
    }

    document.getElementById('black').onclick = () => {
        frames[frameIndex].fill(0)
        uploadMatrix(frameIndex)
    }

    for (let x = 0; x < 8; x++) {
        dom.cells[x] = []
        for (let y = 0; y < 8; y++) {
            let cell = document.createElement('div')
            dom.matrix.appendChild(cell)
            cell.style.gridRow = `${y + 1} / span 1`
            cell.style.gridColumn = `${x + 1} / span 1`

            dom.cells[x][y] = cell
            setPixelColor(x, y, 0, 0, 0, false)
            cell.onclick = () => {
                drawCell(x, y)
            }
        }
    }

    const moveMatrixHandler: (cx: number, cy: number) => void = (cx, cy) => {
        const matRect = dom.matrix.getBoundingClientRect()

        let x = cx - matRect.left
        let y = cy - matRect.top

        x /= matRect.width
        y /= matRect.height

        if (x < 0 || x > 1 || y < 0 || y > 1) return

        x = Math.floor(x * 8)
        y = Math.floor(y * 8)

        drawCell(x, y)
    }

    const touchMatrixHandler = evt => moveMatrixHandler(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY)

    dom.matrix.ontouchstart = touchMatrixHandler
    dom.matrix.ontouchmove = touchMatrixHandler

    dom.matrix.onmousemove = evt => {
        if (evt.buttons == 1) moveMatrixHandler(evt.clientX, evt.clientY)
    }

    dom.ip.value = '192.168.178.55'

    dom.ip.oninput = () => {
        dom.test.classList.remove('valid')
        dom.test.classList.remove('invalid')
    }

    const matContainer = document.getElementById('matrix-container')
    const matrixSizeMatch = () => {
        const dims = matContainer.getBoundingClientRect()
        console.log(dims)
        const limit = Math.min(dims.width, dims.height)
        dom.matrix.style.width = limit + 'px'
        dom.matrix.style.height = limit + 'px'
    }
    window.onresize = matrixSizeMatch
    matrixSizeMatch()


    const gifInput = document.getElementById('gif-input')

    gifInput.onchange = async evt => {
        if (evt.target.files.length != 1) return
        const gif = await new Promise((res, rej) => {
            const g = GIFGroover()
            g.onload = () => res(g)
            g.onerror = rej
            const url = URL.createObjectURL(evt.target.files[0])
            console.log('loading', url)
            g.src = url
        })
        
        console.log(gif.allFrames)
    }

    dom.update.onclick = () => {
        uploadMatrix(frameIndex)
    }

    const addFrameBtn = document.getElementById('add-frame')
    addFrameBtn.onclick = () => {
        console.log('add-frame')
        const nframe = new Uint8Array(64 * 3)
        frames.push(nframe)
        updateFrameSelectorUI()

    }

    dom.test.onclick = async () => {
        const isMatrix = await testMatrix()

        if (!isMatrix) {
            dom.test.classList.add('invalid')
            dom.test.classList.remove('valid')
            alert('IP address not correct or arduino not running')
        }
        else {
            dom.test.classList.remove('invalid')
            dom.test.classList.add('valid')
        }
    }

    updateFrameSelectorUI()
}