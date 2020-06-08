interface DomElements {
    ip: HTMLInputElement,
    test: HTMLButtonElement
}

const dom: DomElements = {
    ip: null,
    test: null
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

window.onload = () => {
    dom.ip = <HTMLInputElement> document.getElementById('ip')
    dom.test = <HTMLButtonElement> document.getElementById('test')

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