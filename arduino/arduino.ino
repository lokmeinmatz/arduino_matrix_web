#include <Adafruit_NeoPixel.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>   // Include the WebServer library
#include "conf.h"

// Which pin on the Arduino is connected to the NeoPixels?
// On a Trinket or Gemma we suggest changing this to 1:
#define LED_PIN    2

// How many NeoPixels are attached to the Arduino?
#define LED_COUNT 64

#define DIM_FRACT 1

// Declare our NeoPixel strip object:
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

ESP8266WebServer server(80);


void postAllHandler() {
  Serial.println("post all");
  
  server.sendHeader("Access-Control-Allow-Origin", "*");

  if (!server.hasArg("plain")) { //Check if body received
    server.send(400, "text/plain", "Body not received");
    return;
  }

  String body = server.arg("plain");

  if (body.length() != 64 * 3) {
    server.send(400, "text/plain", "body must be 64 * 3 unsigned chars long!");
    return;
  }

  for(int i = 0; i < LED_COUNT; i++) {
    strip.setPixelColor(i, strip.Color(body.charAt(i * 3) / DIM_FRACT, body.charAt(i * 3 + 1) / DIM_FRACT, body.charAt(i * 3 + 2) / DIM_FRACT));
  }
  strip.show();
  server.send(200, "text/plain", "Set all leds");
}

void postDeltaHandler() {
  Serial.println("post delta");
  unsigned long startMillis = millis();
  
  server.sendHeader("Access-Control-Allow-Origin", "*");

  if (!server.hasArg("plain")) { //Check if body received
    server.send(400, "text/plain", "Body not received");
    return;
  }

  String body = server.arg("plain");

  if (body.length() < 6) {
    server.send(400, "text/plain", "body must be 6 bytes long");
    return;
  }

  unsigned char deltaUpdates = body.charAt(0);

  Serial.println(deltaUpdates);

  for(int u = 0; u < deltaUpdates; u++) {
    unsigned int bidx = (u * 5) + 1;
    unsigned char x = body.charAt(bidx + 0);
    unsigned char y = body.charAt(bidx + 1);
    unsigned char r = body.charAt(bidx + 2);
    unsigned char g = body.charAt(bidx + 3);
    unsigned char b = body.charAt(bidx + 4);
    strip.setPixelColor(x + y * 8, strip.Color(r / DIM_FRACT, g / DIM_FRACT, b / DIM_FRACT));
  }

 
  strip.show();
  server.send(200, "text/plain", "Set led");

  unsigned long elapsed = millis() - startMillis;
  Serial.println(elapsed);
}

void getHandler() {
  Serial.println("get");
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/plain", "I am alive!");
}

void setup() {
  Serial.begin(9600);
  strip.begin();
  delay(10);
  Serial.println("connecting wifi");
  /// TODO !!! nicht auf github pushen
  WiFi.begin("kitzBx2", pw);

  Serial.print("Connecting");
  unsigned int wifi_ct = 0;
  while (WiFi.status() != WL_CONNECTED)
  {
    strip.setPixelColor(wifi_ct % LED_COUNT, 
      ((wifi_ct / LED_COUNT) % 2 == 0) ? strip.Color(40, 0, 0) : strip.Color(0, 0, 30)
    );
    strip.show();
    wifi_ct++;
    delay(50);
    Serial.print(".");
  }
  Serial.print("Connected to ");
  Serial.println(WiFi.SSID());              // Tell us what network we're connected to
  Serial.print("IP address:\t");
  Serial.println(WiFi.localIP());

  server.on("/all", HTTP_POST, postAllHandler);
  server.on("/", HTTP_POST, postDeltaHandler);
  server.on("/", HTTP_GET, getHandler);
  server.begin();
  Serial.println("Webserver started");

  
  uint32_t black = strip.Color(0, 0, 0);
  for (unsigned int i = 0; i < LED_COUNT; i++) {
    strip.setPixelColor(i, black);
  }

  strip.show(); // Initialize all pixels to 'off'
}

void loop(void) {
  server.handleClient();                    // Listen for HTTP requests from clients
  //delay(5);
}
