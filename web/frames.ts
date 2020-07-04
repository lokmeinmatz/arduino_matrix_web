import { dom } from './index'

let frameIndex = 0
const frameBuffer: Uint8Array[] = [new Uint8Array(64 * 3)]
const updateQueue: Map<[number, number], DeltaPixelUpdate> = new Map()
let reqInFlight = false;


(<any> window).uq = updateQueue
frameBuffer[0].fill(0)

export function removeFrame(idx: number) {
    if (frameBuffer.length < 2) return
    frameBuffer.splice(frameIndex, 1)
    if (frameIndex >= frameBuffer.length) frameIndex--
}

export function addFrame(idx?: number) {
    const nframe = new Uint8Array(64 * 3)
    frameBuffer.push(nframe)
}

export function getFrameIndex() : number {
    return frameIndex
}

export function setVisibleFrame(idx: number) {
    console.log(`setting visible frame to ${idx}`)
    frameIndex = idx
    dom.frameSelector.querySelectorAll('.frame-preview').forEach(e => e.classList.remove('active'))
    dom.frameSelector.children[idx].children[0].classList.add('active')

    // set all cells
    for(let x = 0; x < 8; x++) {
        for(let y = 0; y < 8; y++) {
            const idx = (x + y * 8) * 3
            const r = frameBuffer[frameIndex][idx]
            const g = frameBuffer[frameIndex][idx + 1]
            const b = frameBuffer[frameIndex][idx + 2]
            dom.cells[x][y].style.backgroundColor = `rgb(${r},${g},${b})`
        }
    }

    uploadMatrix(frameIndex)
}

export function getFrameBuffer() : Uint8Array[] {
    return frameBuffer
}


export async function uploadMatrix(frameIndex: number) {
    console.log('Uploading full frame...')
    const res = await fetch(`http://${dom.ip.value}/all`, {
        headers: {
            'Content-Type': 'text/plain'
        },
        method: 'POST',
        body: frameBuffer[frameIndex]
    })

    if (res.status != 200) console.error(res)
}


interface DeltaPixelUpdate {
    x: number
    y: number
    r: number
    g: number
    b: number
}



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
export async function setPixelColor(x: number, y: number, r: number, g: number, b: number, sendDelta = true) {
    r = Math.min(255, Math.floor(r))
    g = Math.min(255, Math.floor(g))
    b = Math.min(255, Math.floor(b))
    const idx = (y * 8 + x) * 3
    frameBuffer[frameIndex][idx] = r
    frameBuffer[frameIndex][idx + 1] = g
    frameBuffer[frameIndex][idx + 2] = b

    dom.cells[x][y].style.backgroundColor = `rgb(${r},${g},${b})`

    if (sendDelta) {

        const dup: DeltaPixelUpdate = {
            x, y, r, g, b
        }

        updateQueue.set([x, y], dup)

        if (!reqInFlight) sendDeltaUpdate()
    }
}