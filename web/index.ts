interface DomElements {
    ip: HTMLInputElement,
    test: HTMLButtonElement
    update: HTMLButtonElement
    autoUpdate: HTMLInputElement
    colorSlider: Slider,
    matrix: HTMLDivElement,
    cells: HTMLDivElement[][]
}

const dom: DomElements = {
    ip: null,
    test: null,
    update: null,
    autoUpdate: null,
    colorSlider: null,
    matrix: null,
    cells: null
}

const matrixColors: Uint8Array = new Uint8Array(64 * 3)
matrixColors.fill(0)

class Slider {
    bar: HTMLDivElement
    knob: HTMLDivElement
    lastValue: number

    private function barXLimits(): {from: number, to: number} {
        const rect = this.bar.getBoundingClientRect()
        return {from: rect.left, to: rect.right}
    }

    constructor(bar: HTMLDivElement) {
        this.bar = bar
        this.lastValue = 0
        this.knob = bar.querySelector('.slider-knob')
        this.bar.onclick = evt => {
            let x = evt.layerX
            const {from, to} = this.barXLimits()
            
            x = Math.min(to, Math.max(from - 7, x - 7))

            this.knob.style.left = (x - 7) + 'px'

        }

        this.bar.ontouchstart = evt => {
            console.log('tstart', evt)
        }

        this.bar.ontouchmove = evt => {
            let x = evt.changedTouches[0].pageX
            const {from, to} = this.barXLimits()
            
            x = Math.min(to, Math.max(from - 15, x - 15))
            this.knob.style.left = (x - 7) + 'px'
        }

        this.bar.ontouchend = evt => {
            console.log('tend', evt)
        }
    
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

function uploadMatrix() {
    
}

function setPixelColor(x: number, y: nuber)

window.onload = () => {
    // --- get dom elements ---
    dom.ip = <HTMLInputElement> document.getElementById('ip')
    dom.test = <HTMLButtonElement> document.getElementById('test')
    dom.update = <HTMLButtonElement> document.getElementById('update')
    dom.autoUpdate = <HTMLInputElement> document.getElementById('autoupdate')
    dom.colorSlider = new Slider(<HTMLDivElement> document.getElementById('colorpicker-bar'))
    dom.matrix = <HTMLDivElement> document.getElementById('matrix')
    // ------------------------
    dom.cells = []

    for(let x = 0; x < 8; x++) {
        dom.cells[x] = []
        for(let y = 0; y < 8; y++) {
            let cell = document.createElement('div')
            dom.matrix.appendChild(cell)
            cell.style.gridRow = `${y + 1} / span 1`
            cell.style.gridColumn = `${x + 1} / span 1`
            
            dom.cells[x][y] = cell
            cell.onclick = () => {
                cell.style.backgroundColor = 'red'
                matrixColors
                uploadMatrix()
            }
        }
    }

    dom.ip.value = '192.168.178.55'

    dom.ip.oninput = () => {
        dom.test.classList.remove('valid')
        dom.test.classList.remove('invalid')
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
}