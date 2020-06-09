# arduino_matrix_web
Control an Adafruit LED Matrix with an Wemos D1 Mini Wifi and an Typescript frontend

This repo consists of the [arduino](./arduino) Server and the [webapp](./web).

You need to add a conf.h to arduino with `char *pw = "<wifi-password>"`

## web

Run with `parcel ./index.hml`


## protocol

The arduino provides the endpoints `/` and `/all`
It sends the CORS-header *Access-Control-Allow-Origin: \**
Change this if the arduino is open to the internet!


### GET /

The arduino returns `I'm alive!` as `text/plain` for checking if it's working

### POST /

The body contains a byte-string, first byte tells number n of delta-updates,
then n 5-byte chunks follow.
Each contains (x|y|r|g|b)

### POST /all

The body must contain 64 * 3 = 192 bytes of data.
Each LED is representend as 3 bytes (r, g, b).

**NOTE** The arduino code contains `DIM_FRACT` which divides each value by itself, so
when the matrix is powered via usb / board it doesn't crash because over-current.