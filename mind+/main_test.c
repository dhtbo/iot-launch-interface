/*!
 * MindPlus
 * DFRobot, 行空板 K10
 */
#include <DFRobot_Iot.h>
#include "unihiker_k10.h"
#include <DFRobot_HTTPClient.h>
// 创建对象
DFRobot_Iot myIot;
UNIHIKER_K10 k10;
uint8_t screen_dir=2;
DFRobot_HTTPClient http;

void onButtonAPressed();
void onButtonBPressed();

// 主程序开始
void setup() {
	k10.begin();
	k10.initScreen(screen_dir);
	k10.creatCanvas();
	k10.buttonA->setPressedCallback(onButtonAPressed);
	http.init();
	k10.buttonB->setPressedCallback(onButtonBPressed);
	myIot.wifiConnect("BCM-RJ", "bcm123456");
	while (!myIot.wifiStatus()) {}
	k10.canvas->canvasClear(1);
	k10.canvas->canvasText("行空版", 1, 0x0000FF);
	k10.canvas->updateCanvas();
}
void loop() {
	delay(1000);
}

// 事件回调函数
void onButtonAPressed() {
    http.init();
    // 使用 GET 请求触发，直接拼接到 URL ?apiKey=...&step=...
    http.GET("https://launchapi.ljcode.cn/api/steps/trigger?apiKey=iot-secret&step=step1", 10000);
    
    k10.canvas->canvasClear(2);
    k10.canvas->canvasText("发送1 (GET)", 2, 0x0000FF);
    k10.canvas->updateCanvas();
}
void onButtonBPressed() {
    http.init();
    http.GET("https://launchapi.ljcode.cn/api/steps/trigger?apiKey=iot-secret&step=step2", 10000);
    
    k10.canvas->canvasClear(2);
    k10.canvas->canvasText("发送2 (GET)", 2, 0x0000FF);
    k10.canvas->updateCanvas();
}
