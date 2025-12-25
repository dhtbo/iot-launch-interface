#ifndef DFROBOT_HTTPCLIENT_H
#define DFROBOT_HTTPCLIENT_H

#include <Arduino.h>

#if defined(ARDUINO_ARCH_ESP8266)
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#else
#include <HTTPClient.h>
#endif


class DFRobot_HTTPClient
{
public:
    void init();
    void addParam(const String& name, const String& value);
    void addParam(float name, const String& value) {this->addParam(String(name), value);}
    void addParam(const String& name, float value) {this->addParam(name, String(value));}
    void addParam(float name, float value) {this->addParam(String(name), String(value));}

    void addHeader(const String& name, const String& value);
    void addHeader(float name, const String& value) {this->addHeader(String(name), value);}
    void addHeader(const String& name, float value) {this->addHeader(name, String(value));}
    void addHeader(float name, float value) {this->addHeader(String(name), String(value));}

    void addString(const String& text);
    void addString(float text) {this->addString(String(text));}

    void GET(String url, float timeout = 10000);
    void POST(String url, float timeout = 10000);

    String getLine();
    String getString();
private:
    HTTPClient _httpclient;
    String _params, _body; 
    int _httpcode;
};

#endif
