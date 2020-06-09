/*

Work in Progress GIF Decoder

Missing: Application blocks, decompression, get the whole package together

*/

function str2abPacked(str: string) : ArrayBuffer {
    let ab = new Uint8Array(str.length)
    for(let i = 0; i < str.length; i++) {
        ab[i] = str.charCodeAt(i)
    }
    return ab.buffer
}

function dvEqual(a: DataView, b: DataView) : boolean {
    if (a.byteLength != b.byteLength) return false
    let lastI = 0
    for(let i = 0; i < Math.floor(a.byteLength / 4); i++) {
        if (a.getInt32(i * 4) != b.getInt32(i * 4)) return false
        lastI = i
    }

    // check all remaining u8s
    for (let i = lastI + 4; i < a.byteLength; i++) {
        if (a.getInt8(i) != b.getInt8(i)) return false
    }

    return true

}

export async function loadRaw(file: File): Promise<ArrayBuffer> {
    const reader = new FileReader()
    return new Promise((res, rej) => {
        reader.onload = e => {
            console.log(e.target.result)
            res( <ArrayBuffer> e.target.result)
        }
        reader.onerror = rej
        reader.readAsArrayBuffer(file)
    })
}

interface GifBlock {}

interface GIFHeader {
    type: number,
    logicalWidth: number,
    logicalHeight: number
    colorResolution: number,
    sortGCT: boolean,
    backgroundColorIndex: number,
    pixelAspectRatio: number,
    globalColorTable: number[] | null
}

interface GCE extends GifBlock {
    disposalMethod: number,
    transparency?: number,
    delay: number
}

interface AppExtension extends GifBlock {
    appIdentifier: string,
    appAuthCode: string,

}

class Frame implements GifBlock {
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
    readonly localCT: number[] | null
    readonly interlaced: boolean
    readonly raster: number[]

    constructor(left, top, width, height, localCT, interlaced, raster) {
        this.left = left
        this.top = top
        this.width = width
        this.height = height
        this.localCT = localCT
        this.interlaced = interlaced
        this.raster = raster
    }

    static parseGCE(dv: DataView): [GCE, DataView] {
        if (dv.getUint16(0) != 0x21f9) throw new Error('not gce block')
        if (dv.getUint8(2) != 4) throw new Error('unexpected blocksize for gce')
        const flag = dv.getUint8(3)
        const disposalMethod = (flag >> 2) & 0b111
        const userInputFlag = (flag & 2) == 2
        const transaprentColorFlag = (flag & 1) == 1
        const delay = 0.01 * dv.getUint16(4, true)
        const transparentIndex = dv.getUint8(6)
        const term = dv.getUint8(7)
        if (term != 0) throw new Error('terminator not 0')
        if (userInputFlag || transaprentColorFlag) throw new Error('unimplemented flag in gce')

        return [{
            disposalMethod,
            delay,
            transparency: transaprentColorFlag ? transparentIndex : null
        }, new DataView(dv.buffer, dv.byteOffset + 8)]

    }
    

    static parseFrame(dv: DataView, globalCT: number[]): [Frame, DataView] {
        
        if (dv.getUint8(0) != 44) throw new Error('unknown block')
        

        const left   = dv.getUint16(1, true)
        const top    = dv.getUint16(3, true)
        const width  = dv.getUint16(5, true)
        const height = dv.getUint16(7, true)
        const flags  = dv.getUint8(9)
        const hasLCT = (flags & 0x80) == 1
        const interlaced = (flags & 0x40) == 1
        const bpp = 1 + (flags & 0b111)
        
        let lct: number[] = hasLCT ? 
            GIF.toColorTable(new DataView(dv.buffer, dv.byteOffset + 10, Math.pow(2, bpp) * 3)) : null
        if (interlaced) throw new Error('interlaced GIF unimplemented')
        
        const rv = new Uint8Array(dv.buffer, 
            dv.byteOffset + 10 + (hasLCT ? lct.length * 3 : 0))
        let raster = []

        const ct = hasLCT ? lct : globalCT

        for(let r = 0; r < width * height; r++) {
            const idx = rv[r]
            raster.push(ct[idx])
        }
        const frame = new Frame(left, top, width, height, lct, interlaced, raster)
        return [frame, new DataView(dv.buffer, rv.byteOffset + width * height)]
    }
}

export class GIF {


    readonly headerData: GIFHeader
    readonly blocks: GifBlock[]

    constructor(headerData: GIFHeader, blocks: GifBlock[]) {
        this.headerData = headerData
        this.blocks = blocks
    }

    static toColorTable(dv: DataView) : number[] {
        let ct = []
        if(dv.byteLength % 3 != 0) throw new Error('bytelength not mutliple of 3')
        for(let i = 0; i < Math.floor(dv.byteLength / 3); i++) {
            let c = dv.getUint8(i * 3 + 0) << 16 | 
                    dv.getUint8(i * 3 + 1) << 8 |
                    dv.getUint8(i * 3 + 2)
            ct.push(c)
        }
        return ct
    }

    static async fromFile(file: File): Promise<GIF> {
        const buf = await loadRaw(file)
        const file_prefix_87 = str2abPacked('GIF87a')
        const file_prefix_89 = str2abPacked('GIF89a')
        const file_dv = new DataView(buf)
        const f_begin = new DataView(buf, 0, 6)

        let ftype
        if (dvEqual(new DataView(file_prefix_87), f_begin)) ftype = 87
        else if (dvEqual(new DataView(file_prefix_89), f_begin)) ftype = 89
        else {
            console.error('expected GIF89a format')
            throw new Error('Unknown format')
        }

        const lsw = file_dv.getUint16(6, true)
        const lsh = file_dv.getUint16(8, true)
        const cdataflag = file_dv.getUint8(10)

        const hasGCT = (cdataflag & 0b1) == 1

        const colorResolution = ((cdataflag >> 1) & 0b111) + 1

        const sortGCT = (cdataflag & 0b1000) == 1

        const GCTsize = Math.pow(2, 1 + ((cdataflag >> 5) & 0b111))

        const BGCidx = file_dv.getUint8(11)
        const pAspectRatio = file_dv.getUint8(12)

        let gct: number[] = hasGCT ? GIF.toColorTable(new DataView(buf, 13, GCTsize * 3)) : null
        
        const header: GIFHeader = {
            type: ftype,
            logicalWidth: lsw,
            logicalHeight: lsh,
            colorResolution,
            sortGCT,
            backgroundColorIndex: BGCidx,
            pixelAspectRatio: pAspectRatio,
            globalColorTable: gct
        }
        
        const blocks: GifBlock[] = []

        let bv = new DataView(buf, 13 + GCTsize * 3)
        let finished = false
        while (!finished) {

            const fb = bv.getUint8(0)

            switch (fb) {

                case 0x2c: // image block
                    const r = Frame.parseFrame(bv, gct)
                    blocks.push(r[0])
                    bv = r[1]
                    break
                
                case 0x21: // extension block
                    const sb = bv.getUint8(1)
                    switch (sb) {
                        case 0xf9: // graphics control extension block
                            const r = Frame.parseGCE(bv)
                            blocks.push(r[0])
                            bv = r[1]
                            break;
                    
                        default:
                            console.warn('unknown extension block: ', sb)
                            finished = true
                            break;
                    }
                    break

                case 0x3b:
                    finished = true
                    break

                default:
                    console.warn('unknown block: ', fb)
                    finished = true
                    break
            }
            
        }


        return new GIF(header, blocks)
    }

}
